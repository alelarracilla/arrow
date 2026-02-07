/**
 * Arrow Agent — Entrypoint
 *
 * Slim orchestrator that wires together the modular handlers
 * and runs the polling loop.
 */
import { formatUnits } from "viem";
import { config } from "./config";
import { getAgentBalances } from "./balances";
import { watchLeaderSwaps } from "./handlers/leaderSwaps";
import { checkLimitOrders } from "./handlers/limitOrders";
import { processIdeaPosts } from "./handlers/ideaPosts";
import { processPendingOrders } from "./handlers/pendingOrders";

// ── Main ──

async function main(): Promise<void> {
  console.log("========================================");
  console.log("  Arrow Agent v4.0 — Cross-Chain");
  console.log("  Arc ↔ CCTP ↔ Base Sepolia ↔ Uniswap v4");
  console.log("========================================\n");
  console.log(`  Arc RPC:         ${config.rpcUrl}`);
  console.log(`  Base Sepolia:    ${config.baseSepoliaRpcUrl}`);
  console.log(`  Hook (Base Sep): ${config.hookAddress || "NOT SET"}`);
  console.log(`  Router:          ${config.swapRouterAddress || "NOT SET"}`);
  console.log(`  PoolSwapTest:    ${config.uniswap.poolSwapTest}`);
  console.log(`  AI Model:        ${config.aiModel}`);
  console.log(`  AI Key:          ${config.anthropicApiKey ? "SET" : "NOT SET"}`);
  console.log(`  Agent Key:       ${config.agentPrivateKey ? "SET" : "NOT SET"}`);
  console.log(`  Backend:         ${config.backendUrl}`);
  console.log(`  Poll:            ${config.pollInterval}ms`);
  console.log(`  CCTP Domains:    Arc(${config.cctp.arcDomain}) ↔ Base Sepolia(${config.cctp.baseSepoliaDomain})\n`);

  // Show agent balances on both chains
  try {
    const balances = await getAgentBalances();
    if (balances) {
      console.log(`  Agent address:   ${balances.address}`);
      console.log(`  Arc USDC:        ${formatUnits(balances.arcUsdc, 18)}`);
      console.log(`  Base Sep USDC:   ${formatUnits(balances.baseSepoliaUsdc, 6)}\n`);
    }
  } catch {
    console.log("  (Could not fetch agent balances)\n");
  }

  if (!config.hookAddress) {
    console.log("[agent] Running in dry-run mode (no HOOK_ADDRESS)");
    console.log("[agent] Will analyze posts from backend if AI key is set\n");
  } else {
    console.log(`[agent] Watching ArrowCopyTradeHook on Base Sepolia`);
    console.log(`[agent] Hook: ${config.hookAddress}\n`);
  }

  // Initial run
  await watchLeaderSwaps();
  await checkLimitOrders();
  await processPendingOrders();
  await processIdeaPosts();

  // Poll loop
  let tick = 0;
  setInterval(async () => {
    tick++;
    await watchLeaderSwaps();
    await checkLimitOrders();
    await processPendingOrders();

    // Process idea posts less frequently (every 5th tick)
    if (tick % 5 === 0) {
      await processIdeaPosts();
    }
  }, config.pollInterval);
}

main().catch((err) => {
  console.error("[agent] Fatal error:", err);
  process.exit(1);
});
