/**
 * Uniswap v4 Swap Logic on Base Sepolia
 *
 * Handles token approval and swap execution via PoolSwapTest.
 */
import { type Address, type Hex } from "viem";
import { config } from "./config";
import { baseSepoliaPublicClient, getBaseSepoliaWalletClient } from "./clients";
import { ERC20_ABI, POOL_SWAP_TEST_ABI } from "./abis/contracts";

// ── Types ──

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

// ── Swap Constants ──

const MIN_SQRT_PRICE = 4295128739n + 1n;
const MAX_SQRT_PRICE =
  1461446703485210103287273052203988822378723970342n - 1n;

// ── Swap Execution ──

export async function swapOnBaseSepolia(
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountIn: bigint,
): Promise<Hex> {
  const walletClient = getBaseSepoliaWalletClient();
  const inputToken = zeroForOne ? poolKey.currency0 : poolKey.currency1;

  // Approve input token for PoolSwapTest
  console.log(`[swap] Approving ${amountIn} of ${inputToken} for PoolSwapTest...`);
  const approveTx = await walletClient.writeContract({
    address: inputToken,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [config.uniswap.poolSwapTest as Address, amountIn],
  });
  await baseSepoliaPublicClient.waitForTransactionReceipt({ hash: approveTx });

  // Execute swap
  console.log(`[swap] Executing swap on Uniswap v4...`);
  const swapTx = await walletClient.writeContract({
    address: config.uniswap.poolSwapTest as Address,
    abi: POOL_SWAP_TEST_ABI,
    functionName: "swap",
    args: [
      {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks,
      },
      {
        zeroForOne,
        amountSpecified: -amountIn, // negative = exact input
        sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE,
      },
      {
        takeClaims: false,
        settleUsingBurn: false,
      },
      "0x" as Hex,
    ],
  });

  await baseSepoliaPublicClient.waitForTransactionReceipt({ hash: swapTx });
  console.log(`[swap] Swap executed on Base Sepolia. TX: ${swapTx}`);
  return swapTx;
}
