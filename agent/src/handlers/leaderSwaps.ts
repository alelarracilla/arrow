/**
 * LeaderSwap Event Watcher
 *
 * Monitors ArrowCopyTradeHook for LeaderSwap events on Base Sepolia.
 * When a leader swaps, the AI evaluates whether to relay to followers
 * and creates trade proposals if approved.
 */
import { parseAbiItem, formatUnits, type Address, type Log } from "viem";
import { config } from "../config";
import { baseSepoliaPublicClient } from "../clients";
import { hookAbi } from "../abi";
import { evaluateLeaderSwap, type AIDecision } from "../ai";
import { createTradeProposal } from "../backend";

let lastProcessedBlock = 0n;
const processedTxHashes = new Set<string>();

export async function watchLeaderSwaps(): Promise<void> {
  if (!config.hookAddress) return;

  const leaderSwapEvent = parseAbiItem(
    "event LeaderSwap(address indexed leader, bytes32 indexed poolId, bool zeroForOne, int256 amountSpecified, int128 delta0, int128 delta1, uint256 timestamp)"
  );

  try {
    const currentBlock = await baseSepoliaPublicClient.getBlockNumber();
    const fromBlock =
      lastProcessedBlock > 0n ? lastProcessedBlock + 1n : currentBlock - 100n;

    const logs = await baseSepoliaPublicClient.getLogs({
      address: config.hookAddress,
      event: leaderSwapEvent,
      fromBlock: fromBlock > 0n ? fromBlock : 0n,
      toBlock: currentBlock,
    });

    for (const log of logs) {
      const txHash = log.transactionHash;
      if (txHash && processedTxHashes.has(txHash)) continue;
      if (txHash) processedTxHashes.add(txHash);

      await handleLeaderSwap(log);
    }

    lastProcessedBlock = currentBlock;
  } catch (err) {
    console.error("[agent] Error watching LeaderSwap events:", err);
  }
}

async function handleLeaderSwap(log: Log): Promise<void> {
  const args = (log as unknown as { args: Record<string, unknown> }).args;
  const leader = args.leader as Address;
  const zeroForOne = args.zeroForOne as boolean;
  const amountSpecified = args.amountSpecified as bigint;
  const delta0 = args.delta0 as bigint;
  const delta1 = args.delta1 as bigint;

  const absAmount =
    amountSpecified < 0n ? -amountSpecified : amountSpecified;

  console.log(`\n[agent] LeaderSwap detected:`);
  console.log(`  Leader:    ${leader}`);
  console.log(`  Direction: ${zeroForOne ? "token0 -> token1" : "token1 -> token0"}`);
  console.log(`  Amount:    ${formatUnits(absAmount, 18)}`);
  console.log(`  Block:     ${log.blockNumber}`);

  // Get followers from on-chain
  let followers: Address[] = [];
  let leaderTradeCount = 0;
  try {
    followers = (await baseSepoliaPublicClient.readContract({
      address: config.hookAddress!,
      abi: hookAbi,
      functionName: "getFollowers",
      args: [leader],
    })) as Address[];

    const trades = (await baseSepoliaPublicClient.readContract({
      address: config.hookAddress!,
      abi: hookAbi,
      functionName: "getLeaderTrades",
      args: [leader],
    })) as unknown[];
    leaderTradeCount = trades.length;
  } catch (err) {
    console.error("  Error reading on-chain data:", err);
  }

  if (followers.length === 0) {
    console.log("  No followers — skipping AI evaluation");
    return;
  }

  // Ask AI whether to relay this trade
  console.log(`  Asking AI to evaluate relay to ${followers.length} followers...`);
  const decision: AIDecision = await evaluateLeaderSwap({
    leader,
    followerCount: followers.length,
    zeroForOne,
    amountSpecified: formatUnits(absAmount, 18),
    delta0: delta0.toString(),
    delta1: delta1.toString(),
    leaderTradeCount,
  });

  console.log(`  AI decision: ${decision.action} (confidence: ${decision.confidence})`);
  console.log(`  Reason: ${decision.reason}`);

  if (decision.action === "execute" && decision.confidence >= 0.6) {
    console.log(`  Creating trade proposals for ${followers.length} followers...`);

    for (const follower of followers) {
      try {
        console.log(`    -> Proposal for ${follower}`);
        await createTradeProposal({
          userAddress: follower,
          type: "copy-trade",
          zeroForOne,
          amount: formatUnits(absAmount, 18),
          leaderAddress: leader,
          aiConfidence: decision.confidence,
          aiReason: decision.reason,
          slippageBps: decision.adjustments?.slippage_bps,
          urgency: decision.adjustments?.urgency,
        });
      } catch (err) {
        console.error(`    Error creating proposal for ${follower}:`, err);
      }
    }
  } else {
    console.log(`  Skipping relay: ${decision.reason}`);
  }
}
