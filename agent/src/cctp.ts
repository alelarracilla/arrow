/**
 * CCTP V2 Bridge Logic
 *
 * Handles cross-chain USDC transfers via Circle's Cross-Chain Transfer Protocol:
 * - Approve + burn USDC on source chain
 * - Poll attestation API for signed message
 * - Mint USDC on destination chain
 */
import { type Address, type Hex } from "viem";
import { config } from "./config";
import {
  arcPublicClient,
  baseSepoliaPublicClient,
  getArcWalletClient,
  getBaseSepoliaWalletClient,
} from "./clients";
import { ERC20_ABI, TOKEN_MESSENGER_ABI, MESSAGE_TRANSMITTER_ABI } from "./abis/contracts";

// ── Constants ──

const ZERO_BYTES32: Hex =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const STANDARD_TRANSFER_MAX_FEE = 0n;
const STANDARD_FINALITY_THRESHOLD = 2000;

// ── Helpers ──

function addressToBytes32(addr: Address): Hex {
  return ("0x" + addr.slice(2).padStart(64, "0")) as Hex;
}

// ── Burn USDC on Arc ──

export async function bridgeFromArc(
  amount: bigint,
  destinationDomain: number,
  mintRecipient: Address,
): Promise<{ txHash: Hex }> {
  const walletClient = getArcWalletClient();

  console.log(`[bridge] Approving ${amount} USDC for TokenMessenger on Arc...`);
  const approveTx = await walletClient.writeContract({
    address: config.tokens.arcUsdc as Address,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [config.cctp.tokenMessenger as Address, amount],
  });
  await arcPublicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log(`[bridge] Approved. TX: ${approveTx}`);

  console.log(`[bridge] Burning ${amount} USDC on Arc → domain ${destinationDomain}...`);
  const burnTx = await walletClient.writeContract({
    address: config.cctp.tokenMessenger as Address,
    abi: TOKEN_MESSENGER_ABI,
    functionName: "depositForBurn",
    args: [
      amount,
      destinationDomain,
      addressToBytes32(mintRecipient),
      config.tokens.arcUsdc as Address,
      ZERO_BYTES32,
      STANDARD_TRANSFER_MAX_FEE,
      STANDARD_FINALITY_THRESHOLD,
    ],
  });

  await arcPublicClient.waitForTransactionReceipt({ hash: burnTx });
  console.log(`[bridge] Burned. TX: ${burnTx}`);
  return { txHash: burnTx };
}

// ── Poll Attestation (V2 API) ──

interface AttestationMessage {
  message: string;
  attestation: string;
  status: string;
}

interface AttestationResponse {
  messages: AttestationMessage[];
}

export async function waitForAttestation(
  sourceDomain: number,
  transactionHash: Hex,
  maxAttempts = 120,
  intervalMs = 5000,
): Promise<{ messageBytes: Hex; attestation: Hex }> {
  console.log(`[bridge] Polling V2 attestation for tx ${transactionHash} on domain ${sourceDomain}...`);

  const url = `https://iris-api-sandbox.circle.com/v2/messages/${sourceDomain}?transactionHash=${transactionHash}`;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);

      if (res.status === 404) {
        // Expected while waiting
      } else if (res.status === 429) {
        console.log(`[bridge] Rate limited, waiting 60s...`);
        await new Promise((r) => setTimeout(r, 60_000));
        continue;
      } else if (res.ok) {
        const data = (await res.json()) as AttestationResponse;
        if (data?.messages?.[0]?.status === "complete") {
          console.log(`[bridge] Attestation received after ${i + 1} attempts`);
          return {
            messageBytes: data.messages[0].message as Hex,
            attestation: data.messages[0].attestation as Hex,
          };
        }
      }
    } catch {
      // Retry
    }

    if (i % 10 === 0 && i > 0) {
      console.log(`[bridge] Still waiting for attestation... (attempt ${i + 1})`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Attestation timeout");
}

// ── Mint USDC on Base Sepolia ──

export async function mintOnBaseSepolia(
  messageBytes: Hex,
  attestation: Hex,
): Promise<Hex> {
  const walletClient = getBaseSepoliaWalletClient();

  console.log("[bridge] Minting USDC on Base Sepolia...");
  const mintTx = await walletClient.writeContract({
    address: config.cctp.messageTransmitter as Address,
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: "receiveMessage",
    args: [messageBytes, attestation],
  });

  await baseSepoliaPublicClient.waitForTransactionReceipt({ hash: mintTx });
  console.log(`[bridge] Minted on Base Sepolia. TX: ${mintTx}`);
  return mintTx;
}

// ── Bridge back: Burn on Base Sepolia → Mint on Arc ──

export async function bridgeBackToArc(
  amount: bigint,
  mintRecipient: Address,
): Promise<{ txHash: Hex }> {
  const walletClient = getBaseSepoliaWalletClient();

  console.log(`[bridge] Approving ${amount} USDC for bridge back to Arc...`);
  const approveTx = await walletClient.writeContract({
    address: config.tokens.baseSepoliaUsdc as Address,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [config.cctp.tokenMessenger as Address, amount],
  });
  await baseSepoliaPublicClient.waitForTransactionReceipt({ hash: approveTx });

  console.log(`[bridge] Burning USDC on Base Sepolia → Arc (domain ${config.cctp.arcDomain})...`);
  const burnTx = await walletClient.writeContract({
    address: config.cctp.tokenMessenger as Address,
    abi: TOKEN_MESSENGER_ABI,
    functionName: "depositForBurn",
    args: [
      amount,
      config.cctp.arcDomain,
      addressToBytes32(mintRecipient),
      config.tokens.baseSepoliaUsdc as Address,
      ZERO_BYTES32,
      STANDARD_TRANSFER_MAX_FEE,
      STANDARD_FINALITY_THRESHOLD,
    ],
  });

  await baseSepoliaPublicClient.waitForTransactionReceipt({ hash: burnTx });
  console.log(`[bridge] Burned on Base Sepolia. TX: ${burnTx}`);
  return { txHash: burnTx };
}

export async function mintOnArc(
  messageBytes: Hex,
  attestation: Hex,
): Promise<Hex> {
  const walletClient = getArcWalletClient();

  console.log("[bridge] Minting USDC on Arc...");
  const mintTx = await walletClient.writeContract({
    address: config.cctp.messageTransmitter as Address,
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: "receiveMessage",
    args: [messageBytes, attestation],
  });

  await arcPublicClient.waitForTransactionReceipt({ hash: mintTx });
  console.log(`[bridge] Minted on Arc. TX: ${mintTx}`);
  return mintTx;
}
