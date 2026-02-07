/**
 * CCTP Bridge + Uniswap v4 Swap — Barrel Re-export
 *
 * This file re-exports from the modular files for backward compatibility.
 * New code should import directly from the specific modules:
 *   - ./cctp      — CCTP bridge logic
 *   - ./swap      — Uniswap v4 swap logic
 *   - ./balances  — Agent balance checks
 *   - ./clients   — Shared viem clients
 */

// CCTP bridge
export {
  bridgeFromArc,
  waitForAttestation,
  mintOnBaseSepolia,
  bridgeBackToArc,
  mintOnArc,
} from "./cctp";

// Uniswap v4 swap
export { swapOnBaseSepolia, type PoolKey } from "./swap";

// Full cross-chain flow
export {
  executeBridgeAndSwap,
  type BridgeSwapResult,
} from "./handlers/pendingOrders";

// Balances
export { getAgentBalances } from "./balances";
