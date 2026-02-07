/**
 * ENS Resolution Service
 *
 * Resolves ENS names and avatars from Ethereum mainnet.
 * Used to auto-populate user profiles when they connect with a wallet address.
 */
import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(
    process.env.ETH_RPC_URL || "https://eth.llamarpc.com"
  ),
});

export interface EnsProfile {
  name: string | null;
  avatar: string | null;
}

/**
 * Resolve ENS name and avatar for a given Ethereum address.
 * Returns null values if no ENS name is set.
 */
export async function resolveEns(address: string): Promise<EnsProfile> {
  try {
    const ensName = await publicClient.getEnsName({
      address: address as Address,
    });

    if (!ensName) {
      return { name: null, avatar: null };
    }

    let avatar: string | null = null;
    try {
      avatar = await publicClient.getEnsAvatar({
        name: normalize(ensName),
      });
    } catch {
      // Avatar resolution can fail for various reasons
    }

    return { name: ensName, avatar };
  } catch (err) {
    console.error(`[ens] Failed to resolve ${address}:`, err);
    return { name: null, avatar: null };
  }
}

/**
 * Resolve ENS address from a name (forward resolution).
 */
export async function resolveEnsAddress(name: string): Promise<string | null> {
  try {
    const address = await publicClient.getEnsAddress({
      name: normalize(name),
    });
    return address;
  } catch {
    return null;
  }
}
