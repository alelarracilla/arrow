import "dotenv/config";

export const config = {
  rpcUrl: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",

  hookAddress: process.env.HOOK_ADDRESS as `0x${string}` | undefined,
  tippingAddress: process.env.TIPPING_ADDRESS as `0x${string}` | undefined,
  swapRouterAddress: process.env.SWAP_ROUTER_ADDRESS as `0x${string}` | undefined,

  agentPrivateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined,

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  aiModel: process.env.AI_MODEL || "claude-sonnet-4-20250514",

  pollInterval: Number(process.env.POLL_INTERVAL) || 12_000,

  backendUrl: process.env.BACKEND_URL || "http://localhost:3001",
  agentSecret: process.env.AGENT_SECRET || "arrow-agent-secret",

  chainId: 5042002,
};
