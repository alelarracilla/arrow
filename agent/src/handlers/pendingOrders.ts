/**
 * Pending Order Executor
 *
 * Polls the backend for pending limit orders, then executes the full
 * cross-chain flow: Arc → CCTP → Base Sepolia → Uniswap v4 swap.
 */
import { type Address, type Hex } from "viem";
import { config } from "../config";
import { getAgentAddress, baseSepoliaPublicClient } from "../clients";
import { bridgeFromArc, waitForAttestation, mintOnBaseSepolia, bridgeBackToArc, mintOnArc } from "../cctp";
import { swapOnBaseSepolia, type PoolKey } from "../swap";
import { ERC20_ABI } from "../abis/contracts";
import { fetchPendingOrders, updateOrderStatus, notifyBackend } from "../backend";

// ── Types ──

export interface BridgeSwapResult {
  bridgeToBaseTx: Hex;
  mintOnBaseTx: Hex;
  swapTx: Hex;
  bridgeBackTx: Hex;
  mintOnArcTx: Hex;
}

// ── State ──

const processedOrderIds = new Set<string>();

// ── Full Bridge + Swap Flow ──

export async function executeBridgeAndSwap(
  amount: bigint,
  poolKey: PoolKey,
  zeroForOne: boolean,
  userAddress: Address,
): Promise<BridgeSwapResult> {
  const agentAddress = getAgentAddress();

  console.log(`\n[bridge+swap] Starting cross-chain swap flow`);
  console.log(`  Amount: ${amount}`);
  console.log(`  Pool: ${poolKey.currency0}/${poolKey.currency1}`);
  console.log(`  Direction: ${zeroForOne ? "0→1" : "1→0"}`);
  console.log(`  User: ${userAddress}`);
  console.log(`  Agent: ${agentAddress}\n`);

  // Step 1+2: Bridge USDC from Arc to Base Sepolia
  const { txHash: burnTxHash } = await bridgeFromArc(
    amount,
    config.cctp.baseSepoliaDomain,
    agentAddress,
  );

  // Step 3: Wait for attestation (~0.5s for Arc standard transfer)
  const { messageBytes, attestation } = await waitForAttestation(
    config.cctp.arcDomain,
    burnTxHash,
  );

  // Step 4: Mint USDC on Base Sepolia
  const mintOnBaseTx = await mintOnBaseSepolia(messageBytes, attestation);

  // Step 5+6: Swap on Uniswap v4
  const swapTx = await swapOnBaseSepolia(poolKey, zeroForOne, amount);

  // Check output balance to bridge back
  const outputToken = zeroForOne ? poolKey.currency1 : poolKey.currency0;
  const outputBalance = await baseSepoliaPublicClient.readContract({
    address: outputToken,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [agentAddress],
  });

  console.log(`[bridge+swap] Swap output: ${outputBalance} of ${outputToken}`);

  // Step 7: Bridge output back to Arc (only if output is USDC)
  let bridgeBackTx: Hex = "0x" as Hex;
  let mintOnArcTx: Hex = "0x" as Hex;

  if (outputToken.toLowerCase() === config.tokens.baseSepoliaUsdc.toLowerCase() && outputBalance > 0n) {
    const { txHash: backBurnTx } = await bridgeBackToArc(outputBalance, userAddress);
    const backAttestation = await waitForAttestation(
      config.cctp.baseSepoliaDomain,
      backBurnTx,
    );
    mintOnArcTx = await mintOnArc(backAttestation.messageBytes, backAttestation.attestation);
    bridgeBackTx = backBurnTx;
  } else {
    console.log(`[bridge+swap] Output token is not USDC — keeping on Base Sepolia for now`);
  }

  console.log(`\n[bridge+swap] ✅ Cross-chain swap complete!`);
  console.log(`  Burn on Arc: ${burnTxHash}`);
  console.log(`  Mint on Base: ${mintOnBaseTx}`);
  console.log(`  Swap: ${swapTx}`);
  if (bridgeBackTx !== "0x") {
    console.log(`  Bridge back: ${bridgeBackTx}`);
    console.log(`  Mint on Arc: ${mintOnArcTx}`);
  }

  return { bridgeToBaseTx: burnTxHash, mintOnBaseTx, swapTx, bridgeBackTx, mintOnArcTx };
}

// ── Order Processing Loop ──

export async function processPendingOrders(): Promise<void> {
  const orders = await fetchPendingOrders();
  if (orders.length === 0) return;

  const newOrders = orders.filter((o) => !processedOrderIds.has(o.id));
  if (newOrders.length === 0) return;

  console.log(`\n[agent] Found ${newOrders.length} pending order(s) to execute`);

  for (const order of newOrders) {
    processedOrderIds.add(order.id);

    console.log(`\n[order-exec] Processing order #${order.id.slice(0, 8)}`);
    console.log(`  User:      @${order.username} (${order.user_address?.slice(0, 10)}...)`);
    console.log(`  Direction: ${order.zero_for_one ? "BUY (0→1)" : "SELL (1→0)"}`);
    console.log(`  Amount:    ${order.amount} USDC`);
    console.log(`  Trigger:   ${order.trigger_price}`);
    console.log(`  Pair:      ${order.pair || "unknown"}`);

    try {
      if (!config.agentPrivateKey) {
        console.log(`  [SKIP] No AGENT_PRIVATE_KEY — cannot execute on-chain`);
        continue;
      }

      // Parse amount (USDC 6 decimals on both Arc ERC-20 wrapper and Base Sepolia)
      const amountBigInt = BigInt(Math.floor(parseFloat(order.amount) * 1e6));

      // Build pool key for Uniswap v4 swap
      const poolKey: PoolKey = {
        currency0: (order.pair_address_0 || config.tokens.baseSepoliaUsdc) as Address,
        currency1: (order.pair_address_1 || config.tokens.baseSepoliaUsdc) as Address,
        fee: order.pool_fee || 3000,
        tickSpacing: 60,
        hooks: config.hookAddress as Address,
      };

      console.log(`  Pool: ${poolKey.currency0.slice(0, 10)}/${poolKey.currency1.slice(0, 10)} fee=${poolKey.fee}`);
      console.log(`  Hook: ${poolKey.hooks}`);

      // Execute the full cross-chain flow
      console.log(`  Executing bridge + swap...`);
      const result = await executeBridgeAndSwap(
        amountBigInt,
        poolKey,
        !!order.zero_for_one,
        order.user_address as Address,
      );

      // Update order status in backend
      console.log(`  Updating order status to 'executed'...`);
      await updateOrderStatus(order.id, "executed", result.swapTx);

      console.log(`  ✅ Order #${order.id.slice(0, 8)} executed! Swap TX: ${result.swapTx}`);
      await notifyBackend("order-executed", {
        orderId: order.id,
        swapTx: result.swapTx,
        bridgeTx: result.bridgeToBaseTx,
        user: order.user_address,
      });
    } catch (err) {
      console.error(`  ❌ Order #${order.id.slice(0, 8)} failed:`, err instanceof Error ? err.message : err);
      await updateOrderStatus(order.id, "failed");
    }
  }
}
