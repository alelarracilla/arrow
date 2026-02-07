/**
 * CCTP Bridge + Uniswap v4 Swap Library
 *
 * Flow: Arc Testnet → CCTP Bridge → Base Sepolia → Uniswap v4 Swap
 *
 * Uses Circle's Cross-Chain Transfer Protocol to burn USDC on Arc,
 * get attestation, mint on Base Sepolia, then swap via Uniswap v4.
 */
import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";

export const ARC_CHAIN_ID = 5042002;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// @Ale you might want to clean up this and to avoid the harcoded addys

// CCTP Domains
export const ARC_DOMAIN = 26;
export const BASE_SEPOLIA_DOMAIN = 6;

export const ARC_USDC = "0x3600000000000000000000000000000000000000" as Address;
export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;

// CCTP (same address on all testnet chains)
export const TOKEN_MESSENGER_V2 = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as Address;
export const MESSAGE_TRANSMITTER_V2 = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as Address;

// Uniswap v4 on Base Sepolia
export const POOL_MANAGER = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as Address;
export const POOL_SWAP_TEST = "0x8b5bcc363dde2614281ad875bad385e0a785d3b9" as Address;
export const UNIVERSAL_ROUTER = "0x492e6456d9528771018deb9e87ef7750ef184104" as Address;
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
export const QUOTER = "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba" as Address;

// Forwarding service hook data (magic bytes "cctp-forward" + version 0 + empty data length 0)
export const FORWARD_HOOK_DATA: Hex =
  "0x636374702d666f72776172640000000000000000000000000000000000000000";

// ── ABIs ──

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// CCTP TokenMessengerV2 — V2 signatures
export const TOKEN_MESSENGER_ABI = [
  {
    name: "depositForBurn",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [{ type: "uint64" }],
  },
  {
    name: "depositForBurnWithHook",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ type: "uint64" }],
  },
] as const;

// CCTP MessageTransmitterV2 — receiveMessage
export const MESSAGE_TRANSMITTER_ABI = [
  {
    name: "receiveMessage",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// Uniswap v4 PoolSwapTest — swap
export const POOL_SWAP_TEST_ABI = [
  {
    name: "swap",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "zeroForOne", type: "bool" },
          { name: "amountSpecified", type: "int256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
      {
        name: "testSettings",
        type: "tuple",
        components: [
          { name: "takeClaims", type: "bool" },
          { name: "settleUsingBurn", type: "bool" },
        ],
      },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ type: "int256" }],
  },
] as const;

// ── Public client for Base Sepolia (read-only) ──

export const baseSepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// ── Helper: address to bytes32 (CCTP format) ──

export function addressToBytes32(addr: Address): Hex {
  return ("0x" + addr.slice(2).padStart(64, "0")) as Hex;
}

// ── Step 1: Approve USDC on Arc for CCTP ──

export function buildApproveCalldata(amount: bigint) {
  return {
    to: ARC_USDC,
    value: 0n,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [TOKEN_MESSENGER_V2, amount],
    }),
  };
}

// ── Step 2: Burn USDC on Arc via CCTP ──

// Zero bytes32 — allows any address to call receiveMessage on destination
const ZERO_BYTES32: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function buildBurnCalldata(
  amount: bigint,
  destinationDomain: number,
  mintRecipient: Address,
) {
  return {
    to: TOKEN_MESSENGER_V2,
    value: 0n,
    data: encodeFunctionData({
      abi: TOKEN_MESSENGER_ABI,
      functionName: "depositForBurn",
      args: [
        amount,
        destinationDomain,
        addressToBytes32(mintRecipient),
        ARC_USDC,
        ZERO_BYTES32,  // destinationCaller — anyone can mint
        0n,            // maxFee — 0 for standard transfer (free)
        2000,          // minFinalityThreshold >= 2000 = standard transfer
      ],
    }),
  };
}

// ── Step 2b: Burn with Forwarding Service (gasless destination mint) ──

export function buildBurnWithForwardingCalldata(
  amount: bigint,
  destinationDomain: number,
  mintRecipient: Address,
  maxFee: bigint,
) {
  return {
    to: TOKEN_MESSENGER_V2,
    value: 0n,
    data: encodeFunctionData({
      abi: TOKEN_MESSENGER_ABI,
      functionName: "depositForBurnWithHook",
      args: [
        amount,
        destinationDomain,
        addressToBytes32(mintRecipient),
        ARC_USDC,
        // destinationCaller = 0 (no restriction, required for forwarding)
        "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
        maxFee,
        // minFinalityThreshold: 2000 = standard transfer
        2000,
        FORWARD_HOOK_DATA,
      ],
    }),
  };
}

// ── Step 3: Poll Circle attestation API ──

const ATTESTATION_API_V2 = "https://iris-api-sandbox.circle.com/v2/messages";

export interface AttestationResponse {
  attestation: string;
  message: string;
  status: "complete" | "pending_confirmations";
}

export async function pollAttestation(
  sourceDomain: number,
  transactionHash: string,
  maxAttempts = 60,
  intervalMs = 5000,
): Promise<AttestationResponse> {
  const url = `${ATTESTATION_API_V2}/${sourceDomain}?transactionHash=${transactionHash}`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        // Expected while waiting
      } else if (res.ok) {
        const data = await res.json();
        if (data?.messages?.[0]?.status === "complete") {
          return {
            attestation: data.messages[0].attestation,
            message: data.messages[0].message,
            status: "complete",
          };
        }
      }
    } catch (err) {
      console.warn(`[cctp] Attestation poll attempt ${i + 1} failed:`, err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Attestation timeout — try again later");
}

// ── Step 4: Mint USDC on Base Sepolia ──
// (Only needed if NOT using forwarding service)

export function buildMintCalldata(message: Hex, attestation: Hex) {
  return {
    to: MESSAGE_TRANSMITTER_V2,
    value: 0n,
    data: encodeFunctionData({
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: "receiveMessage",
      args: [message, attestation],
    }),
  };
}

// ── Step 5: Swap on Uniswap v4 (Base Sepolia) ──

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export function buildSwapCalldata(
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountSpecified: bigint,
  sqrtPriceLimitX96?: bigint,
) {
  // Default price limits: min or max sqrt price
  const MIN_SQRT_PRICE = 4295128739n + 1n;
  const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n - 1n;

  return {
    to: POOL_SWAP_TEST,
    value: 0n,
    data: encodeFunctionData({
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
          amountSpecified,
          sqrtPriceLimitX96: sqrtPriceLimitX96 ?? (zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE),
        },
        {
          takeClaims: false,
          settleUsingBurn: false,
        },
        "0x" as Hex,
      ],
    }),
  };
}

// ── Full Bridge Flow Helper ──

export interface BridgeAndSwapParams {
  amount: string; // USDC amount (human readable, e.g. "10.5")
  recipientOnBaseSepolia: Address; // Where to mint USDC on Base Sepolia
  useForwardingService?: boolean; // Use Circle forwarding for gasless mint
  maxFee?: string; // Max fee for forwarding service (USDC)
}

/**
 * Build the calldata for Step 1+2 (approve + burn on Arc).
 * Returns an array of raw calls { to, value, data } for bundlerClient.sendUserOperation.
 */
export function buildBridgeToBaseSepoliaCalls(params: BridgeAndSwapParams) {
  // Arc USDC ERC-20 wrapper has 6 decimals
  const amount = parseUnits(params.amount, 6);

  const calls: { to: Address; value: bigint; data: Hex }[] = [
    // 1. Approve USDC for TokenMessenger
    buildApproveCalldata(amount),
  ];

  if (params.useForwardingService) {
    // 2b. Burn with forwarding (Circle mints on destination for us)
    const maxFee = parseUnits(params.maxFee || "0.50", 6); // 0.50 USDC default
    calls.push(
      buildBurnWithForwardingCalldata(
        amount,
        BASE_SEPOLIA_DOMAIN,
        params.recipientOnBaseSepolia,
        maxFee,
      )
    );
  } else {
    // 2. Standard burn (we mint on destination ourselves)
    calls.push(
      buildBurnCalldata(
        amount,
        BASE_SEPOLIA_DOMAIN,
        params.recipientOnBaseSepolia,
      )
    );
  }

  return calls;
}

// ── Utility: Get USDC balance on Base Sepolia ──

export async function getBaseSepoliaUsdcBalance(address: Address): Promise<bigint> {
  const balance = await baseSepoliaClient.readContract({
    address: BASE_SEPOLIA_USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  return balance;
}
