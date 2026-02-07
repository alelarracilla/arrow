/**
 * Shared viem clients for Arc Testnet and Base Sepolia.
 * Singleton wallet clients ensure consistent nonce tracking across transactions.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config";

// ── Chain Definitions ──

export const arcTestnet = defineChain({
  id: config.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});

export { baseSepolia };

// ── Public Clients ──

export const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(config.rpcUrl),
});

export const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(config.baseSepoliaRpcUrl),
});

// ── Wallet Clients (singletons for nonce management) ──

export type TypedWalletClient = WalletClient<Transport, Chain, Account>;

let _arcWalletClient: TypedWalletClient | null = null;
export function getArcWalletClient(): TypedWalletClient {
  if (!config.agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY not set");
  if (!_arcWalletClient) {
    const account = privateKeyToAccount(config.agentPrivateKey);
    _arcWalletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(config.rpcUrl),
    });
  }
  return _arcWalletClient;
}

let _baseSepoliaWalletClient: TypedWalletClient | null = null;
export function getBaseSepoliaWalletClient(): TypedWalletClient {
  if (!config.agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY not set");
  if (!_baseSepoliaWalletClient) {
    const account = privateKeyToAccount(config.agentPrivateKey);
    _baseSepoliaWalletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(config.baseSepoliaRpcUrl),
    });
  }
  return _baseSepoliaWalletClient;
}

// ── Agent Account ──

export function getAgentAddress() {
  if (!config.agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY not set");
  return privateKeyToAccount(config.agentPrivateKey).address;
}

// ── Nonce Helpers ──
// viem caches nonces internally, which can go stale after rapid sequential TXs
// on the same chain. These helpers fetch the live on-chain nonce.

export async function getArcNonce(): Promise<number> {
  const address = getAgentAddress();
  return Number(await arcPublicClient.getTransactionCount({ address }));
}

export async function getBaseSepoliaNonce(): Promise<number> {
  const address = getAgentAddress();
  return Number(await baseSepoliaPublicClient.getTransactionCount({ address }));
}
