import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  formatUnits,
  type Address,
  type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";
import { hookAbi } from "./abi";
import {
  evaluateLeaderSwap,
  evaluateLimitOrder,
  analyzePostForTrading,
  type AIDecision,
} from "./ai";

const arcTestnet = {
  id: config.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
} as const;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(config.rpcUrl),
});

function getWalletClient() {
  if (!config.agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY not set");
  const account = privateKeyToAccount(config.agentPrivateKey);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(config.rpcUrl),
  });
}

let lastProcessedBlock = 0n;
const processedOrders = new Set<number>();
const processedTxHashes = new Set<string>();

// ── LeaderSwap Watcher ──

async function watchLeaderSwaps(): Promise<void> {
  if (!config.hookAddress) return;

  const leaderSwapEvent = parseAbiItem(
    "event LeaderSwap(address indexed leader, bytes32 indexed poolId, bool zeroForOne, int256 amountSpecified, int128 delta0, int128 delta1, uint256 timestamp)"
  );

  try {
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock =
      lastProcessedBlock > 0n ? lastProcessedBlock + 1n : currentBlock - 100n;

    const logs = await publicClient.getLogs({
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
    followers = (await publicClient.readContract({
      address: config.hookAddress!,
      abi: hookAbi,
      functionName: "getFollowers",
      args: [leader],
    })) as Address[];

    const trades = (await publicClient.readContract({
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
        // Create a trade proposal in the backend.
        // The follower's frontend will poll for pending proposals,
        // show a notification, and the user signs the tx with their passkey.
        // The agent NEVER holds user private keys.
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

// ── Limit Order Executor ──

async function checkLimitOrders(): Promise<void> {
  if (!config.hookAddress) return;

  try {
    const orderCount = (await publicClient.readContract({
      address: config.hookAddress,
      abi: hookAbi,
      functionName: "getLimitOrderCount",
    })) as bigint;

    const count = Number(orderCount);
    if (count === 0) return;

    console.log(`\n[agent] Checking ${count} limit orders...`);

    for (let i = 0; i < count; i++) {
      if (processedOrders.has(i)) continue;

      try {
        const order = (await publicClient.readContract({
          address: config.hookAddress,
          abi: hookAbi,
          functionName: "limitOrders",
          args: [BigInt(i)],
        })) as unknown[];

        // Tuple: (owner, key, zeroForOne, amountSpecified, triggerPrice, executed, createdAt)
        const owner = order[0] as Address;
        const zeroForOne = order[2] as boolean;
        const amountSpecified = order[3] as bigint;
        const triggerPrice = order[4] as bigint;
        const executed = order[5] as boolean;
        const createdAt = order[6] as bigint;

        if (executed) {
          processedOrders.add(i);
          continue;
        }

        // Read current pool price (sqrtPriceX96) — in production via StateLibrary
        // For now we pass "0" and let the AI decide based on order age + context
        const currentPrice = "0";

        console.log(`  Order #${i}: owner=${owner}, trigger=${triggerPrice}`);

        // Ask AI whether to execute
        const decision = await evaluateLimitOrder({
          orderId: i,
          owner,
          zeroForOne,
          amountSpecified: formatUnits(
            amountSpecified < 0n ? -amountSpecified : amountSpecified,
            18
          ),
          triggerPrice: triggerPrice.toString(),
          currentPrice,
          createdAt: Number(createdAt),
        });

        console.log(`  AI: ${decision.action} (${decision.confidence}) — ${decision.reason}`);

        if (decision.action === "execute" && decision.confidence >= 0.7) {
          await executeLimitOrder(
            i,
            owner,
            zeroForOne,
            formatUnits(amountSpecified < 0n ? -amountSpecified : amountSpecified, 18),
            decision
          );
          processedOrders.add(i);
        }
      } catch (err) {
        console.error(`  Error checking order #${i}:`, err);
      }
    }
  } catch (err) {
    console.error("[agent] Error checking limit orders:", err);
  }
}

async function executeLimitOrder(orderId: number, owner: Address, zeroForOne: boolean, amount: string, decision: AIDecision): Promise<void> {
  try {
    // Step 1: Create a trade proposal for the user to approve via their passkey.
    // The user's frontend will sign the actual swap tx.
    console.log(`  Creating limit-order proposal for ${owner}...`);
    const created = await createTradeProposal({
      userAddress: owner,
      type: "limit-order",
      zeroForOne,
      amount,
      aiConfidence: decision.confidence,
      aiReason: decision.reason,
      slippageBps: decision.adjustments?.slippage_bps,
      urgency: decision.adjustments?.urgency,
    });

    if (!created) return;

    // Step 2: Mark the order as executed on-chain so it's not re-processed.
    // The agent wallet is authorized to do this (onlyAgent modifier).
    const walletClient = getWalletClient();
    const hash = await walletClient.writeContract({
      address: config.hookAddress!,
      abi: hookAbi,
      functionName: "markLimitOrderExecuted",
      args: [BigInt(orderId)],
    });

    console.log(`  Marked order #${orderId} executed on-chain, tx: ${hash}`);
    await notifyBackend("order-executed", { orderId, txHash: hash });
  } catch (err) {
    console.error(`  Error executing order #${orderId}:`, err);
  }
}

// ── Post Analysis (polls backend for new posts with pair metadata) ──

async function analyzeNewPosts(): Promise<void> {
  if (!config.anthropicApiKey) return;

  try {
    const res = await fetch(`${config.backendUrl}/posts?limit=5`);
    if (!res.ok) return;

    const { posts } = (await res.json()) as {
      posts: Array<{
        id: string;
        content: string;
        pair: string;
        username: string;
        is_leader: number;
      }>;
    };

    for (const post of posts) {
      if (!post.pair) continue;

      const analysis = await analyzePostForTrading({
        content: post.content,
        pair: post.pair,
        authorUsername: post.username,
        isLeader: !!post.is_leader,
      });

      if (analysis.confidence > 0.5) {
        console.log(
          `\n[agent] Post by @${post.username} (${post.pair}): ` +
            `${analysis.sentiment} — ${analysis.reason}`
        );
      }
    }
  } catch {
    // Backend might not be running
  }
}

// ── Backend Notification ──

async function notifyBackend(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${config.backendUrl}/agent/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data, timestamp: Date.now() }),
    });
  } catch {
    // Backend might not be running
  }
}

// ── Trade Proposal Creation ──
// The agent creates proposals in the backend DB.
// The user's frontend polls for pending proposals and signs the tx with their passkey.
// This way the agent NEVER holds user private keys.

async function createTradeProposal(params: {
  userAddress: string;
  type: "copy-trade" | "limit-order" | "ai-suggestion";
  zeroForOne: boolean;
  amount: string;
  token0?: string;
  token1?: string;
  poolFee?: number;
  leaderAddress?: string;
  aiConfidence: number;
  aiReason: string;
  slippageBps?: number;
  urgency?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${config.backendUrl}/trade-proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-secret": config.agentSecret,
      },
      body: JSON.stringify({
        user_address: params.userAddress,
        type: params.type,
        zero_for_one: params.zeroForOne,
        amount: params.amount,
        token0: params.token0 || "",
        token1: params.token1 || "",
        pool_fee: params.poolFee || 3000,
        leader_address: params.leaderAddress || "",
        ai_confidence: params.aiConfidence,
        ai_reason: params.aiReason,
        slippage_bps: params.slippageBps || 50,
        urgency: params.urgency || "medium",
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("  Failed to create trade proposal:", body);
      return false;
    }

    const { proposal } = (await res.json()) as { proposal: { id: string } };
    console.log(`  Trade proposal created: ${proposal.id}`);
    return true;
  } catch (err) {
    console.error("  Error creating trade proposal:", err);
    return false;
  }
}

// ── Main ──

async function main(): Promise<void> {
  console.log("========================================");
  console.log("  Arrow Agent v2.0 — AI-Powered");
  console.log("  Uniswap v4 Copy-Trade & Limit Orders");
  console.log("========================================\n");
  console.log(`  RPC:       ${config.rpcUrl}`);
  console.log(`  Hook:      ${config.hookAddress || "NOT SET"}`);
  console.log(`  Router:    ${config.swapRouterAddress || "NOT SET"}`);
  console.log(`  AI Model:  ${config.aiModel}`);
  console.log(`  AI Key:    ${config.anthropicApiKey ? "SET" : "NOT SET"}`);
  console.log(`  Agent Key: ${config.agentPrivateKey ? "SET" : "NOT SET"}`);
  console.log(`  Backend:   ${config.backendUrl}`);
  console.log(`  Poll:      ${config.pollInterval}ms\n`);

  if (!config.hookAddress) {
    console.log("[agent] Running in dry-run mode (no HOOK_ADDRESS)");
    console.log("[agent] Will analyze posts from backend if AI key is set\n");
  }

  await watchLeaderSwaps();
  await checkLimitOrders();
  await analyzeNewPosts();

  // Poll loop
  // this should be a lambda or something
  let tick = 0;
  setInterval(async () => {
    tick++;
    await watchLeaderSwaps();
    await checkLimitOrders();

    // Analyze posts less frequently (every 5th tick)
    if (tick % 5 === 0) {
      await analyzeNewPosts();
    }
  }, config.pollInterval);
}

main().catch((err) => {
  console.error("[agent] Fatal error:", err);
  process.exit(1);
});
