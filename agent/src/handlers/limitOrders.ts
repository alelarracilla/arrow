/**
 * On-Chain Limit Order Checker
 *
 * Reads pending limit orders from ArrowCopyTradeHook on Base Sepolia.
 * AI evaluates whether trigger conditions are met, then creates
 * trade proposals and marks orders executed on-chain.
 */
import { formatUnits, type Address } from "viem";
import { config } from "../config";
import { baseSepoliaPublicClient, getBaseSepoliaWalletClient } from "../clients";
import { hookAbi } from "../abi";
import { evaluateLimitOrder, type AIDecision } from "../ai";
import { createTradeProposal, notifyBackend } from "../backend";

const processedOrders = new Set<number>();

export async function checkLimitOrders(): Promise<void> {
  if (!config.hookAddress) return;

  try {
    const orderCount = (await baseSepoliaPublicClient.readContract({
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
        const order = (await baseSepoliaPublicClient.readContract({
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

        // Read current pool price — in production via StateLibrary
        const currentPrice = "0";

        console.log(`  Order #${i}: owner=${owner}, trigger=${triggerPrice}`);

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
          await executeLimitOrder(i, owner, zeroForOne,
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

async function executeLimitOrder(
  orderId: number,
  owner: Address,
  zeroForOne: boolean,
  amount: string,
  decision: AIDecision,
): Promise<void> {
  try {
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

    // Mark the order as executed on-chain (onlyAgent modifier)
    const walletClient = getBaseSepoliaWalletClient();
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
