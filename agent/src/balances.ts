/**
 * Agent Balance Utilities
 *
 * Check agent wallet balances on Arc and Base Sepolia.
 */
import { type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";
import { arcPublicClient, baseSepoliaPublicClient } from "./clients";
import { ERC20_ABI } from "./abis/contracts";

export async function getAgentBalances() {
  if (!config.agentPrivateKey) return null;
  const account = privateKeyToAccount(config.agentPrivateKey);

  const [arcBalance, baseBalance] = await Promise.all([
    arcPublicClient.getBalance({ address: account.address }),
    baseSepoliaPublicClient.readContract({
      address: config.tokens.baseSepoliaUsdc as Address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);

  return {
    address: account.address,
    arcUsdc: arcBalance,
    baseSepoliaUsdc: baseBalance,
  };
}
