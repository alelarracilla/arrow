import "dotenv/config";

export const config = {
  // ── Arc Testnet (home chain) ──
  rpcUrl: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
  chainId: 5042002,

  hookAddress: process.env.HOOK_ADDRESS as `0x${string}` | undefined,
  tippingAddress: process.env.TIPPING_ADDRESS as `0x${string}` | undefined,
  swapRouterAddress: process.env.SWAP_ROUTER_ADDRESS as `0x${string}` | undefined,

  agentPrivateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined,

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  aiModel: process.env.AI_MODEL || "claude-sonnet-4-20250514",

  pollInterval: Number(process.env.POLL_INTERVAL) || 12_000,

  backendUrl: process.env.BACKEND_URL || "http://localhost:3001",
  agentSecret: process.env.AGENT_SECRET || "arrow-agent-secret",

  // ── Base Sepolia (swap chain — Uniswap v4 deployed here) ──
  baseSepoliaRpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  baseSepoliaChainId: 84532,

  // ── CCTP ──
  cctp: {
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as `0x${string}`,
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as `0x${string}`,
    attestationApi: "https://iris-api-sandbox.circle.com/v2/attestations",
    arcDomain: 26,
    baseSepoliaDomain: 6,
  },

  // ── Token Addresses ──
  tokens: {
    arcUsdc: "0x3600000000000000000000000000000000000000" as `0x${string}`,
    baseSepoliaUsdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
  },

  // ── Uniswap v4 on Base Sepolia ──
  uniswap: {
    poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as `0x${string}`,
    poolSwapTest: "0x8b5bcc363dde2614281ad875bad385e0a785d3b9" as `0x${string}`,
    universalRouter: "0x492e6456d9528771018deb9e87ef7750ef184104" as `0x${string}`,
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as `0x${string}`,
    quoter: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba" as `0x${string}`,
  },
};
