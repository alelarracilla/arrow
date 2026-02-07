import { useState, useEffect, useCallback } from "react";
import styles from "./TradeProposals.module.css";
import { useWallet } from "../../context/WalletContext";
import { useAuth } from "../../context/AuthContext";
import {
  getPendingProposals,
  approveProposal,
  rejectProposal,
  confirmProposalExecuted,
  type TradeProposal,
} from "../../api/client";
import { buildBridgeToBaseSepoliaCalls } from "../../lib/cctp";
import type { Address } from "viem";



// sorry for this mess, Ale lol
// needed to test my stuff
const POLL_INTERVAL = 10_000;

interface ProposalCardProps {
  proposal: TradeProposal;
  onAction: () => void;
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt + "Z").getTime() - Date.now();
  if (diff <= 0) return "expired";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function ProposalCard({ proposal, onAction }: ProposalCardProps) {
  const { bundlerClient } = useWallet();
  const [status, setStatus] = useState<"idle" | "signing" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(timeLeft(proposal.expires_at));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(timeLeft(proposal.expires_at));
    }, 1000);
    return () => clearInterval(interval);
  }, [proposal.expires_at]);

  const handleApprove = async () => {
    if (!bundlerClient) return;

    setStatus("signing");
    setError("");

    try {
      console.log(`[proposal] Approving #${proposal.id.slice(0, 8)}...`);
      console.log(`[proposal] Type: ${proposal.type} | ${proposal.zero_for_one ? "SELL" : "BUY"} ${proposal.amount} USDC`);

      // Step 1: Mark as approved in backend
      await approveProposal(proposal.id);
      console.log(`[proposal] Backend approved`);

      // Step 2: Bridge USDC from Arc to Base Sepolia via CCTP
      // The user's smart account on Arc burns USDC, Circle attests, agent mints + swaps on Base Sepolia
      const userAddress = bundlerClient.account?.address;
      if (!userAddress) throw new Error("No wallet address");

      console.log(`[bridge] Building CCTP bridge calls: ${proposal.amount} USDC Arc -> Base Sepolia`);
      console.log(`[bridge] Recipient on Base Sepolia: ${userAddress}`);

      const calls = buildBridgeToBaseSepoliaCalls({
        amount: proposal.amount,
        recipientOnBaseSepolia: userAddress as Address,
        useForwardingService: true, // gasless mint on Base Sepolia
        maxFee: "0.50",
      });

      console.log(`[bridge] Sending ${calls.length} calls via bundlerClient (approve + burn)...`);

      const hash = await bundlerClient.sendUserOperation({ calls });

      console.log(`[bridge] UserOp submitted: ${hash}`);
      console.log(`[bridge] USDC burned on Arc. Waiting for CCTP attestation (~0.5s)...`);
      console.log(`[bridge] Agent will mint on Base Sepolia + execute Uniswap v4 swap`);

      // Step 3: Confirm execution in backend with the Arc burn tx hash
      await confirmProposalExecuted(proposal.id, hash);
      console.log(`[proposal] Marked as executed in backend`);

      setStatus("success");
      setTimeout(onAction, 1500);
    } catch (err) {
      console.error("[proposal] Approval error:", err);
      setError(err instanceof Error ? err.message : "Failed to sign transaction");
      setStatus("error");
    }
  };

  const handleReject = async () => {
    try {
      await rejectProposal(proposal.id);
      onAction();
    } catch (err) {
      console.error("Reject error:", err);
    }
  };

  const typeClass =
    proposal.type === "copy-trade"
      ? styles.copyTrade
      : proposal.type === "limit-order"
        ? styles.limitOrder
        : styles.aiSuggestion;

  const urgencyClass =
    proposal.urgency === "high"
      ? styles.urgencyHigh
      : proposal.urgency === "low"
        ? styles.urgencyLow
        : styles.urgencyMedium;

  const isBuy = !!proposal.zero_for_one;

  return (
    <div className={`${styles.card} ${urgencyClass}`}>
      <div className={styles.cardHeader}>
        <span className={`${styles.typeBadge} ${typeClass}`}>
          {proposal.type.replace("-", " ")}
        </span>
        <span className={styles.timer}>{remaining}</span>
      </div>

      <div className={`${styles.direction} ${isBuy ? styles.dirBuy : styles.dirSell}`}>
        {isBuy ? "↑ Buy" : "↓ Sell"}
      </div>

      <div className={styles.amount}>{proposal.amount} USDC</div>

      {proposal.leader_address && (
        <div className={styles.leader}>
          Copying: {proposal.leader_address.slice(0, 6)}...{proposal.leader_address.slice(-4)}
        </div>
      )}

      <div className={styles.aiInfo}>
        <span className={styles.confidence}>
          {Math.round(proposal.ai_confidence * 100)}% confidence
        </span>
        {" — "}
        {proposal.ai_reason}
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {status === "success" ? (
        <div className={styles.successMsg}>Trade executed!</div>
      ) : (
        <div className={styles.actions}>
          <button
            className={styles.approveBtn}
            onClick={handleApprove}
            disabled={status === "signing" || remaining === "expired"}
          >
            {status === "signing" ? "Signing..." : "Approve & Sign"}
          </button>
          <button
            className={styles.rejectBtn}
            onClick={handleReject}
            disabled={status === "signing"}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export function TradeProposals() {
  const { isConnected } = useWallet();
  const { isAuthenticated } = useAuth();
  const [proposals, setProposals] = useState<TradeProposal[]>([]);

  const fetchProposals = useCallback(async () => {
    if (!isConnected || !isAuthenticated) return;
    try {
      const { proposals: pending } = await getPendingProposals();
      setProposals(pending);
    } catch {
      // Backend might not be running
    }
  }, [isConnected, isAuthenticated]);

  useEffect(() => {
    const controller = new AbortController();
    const poll = () => {
      if (!controller.signal.aborted) fetchProposals();
    };
    // Initial fetch after a microtask to avoid sync setState in effect
    const timeout = setTimeout(poll, 0);
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      controller.abort();
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchProposals]);

  if (proposals.length === 0) return null;

  return (
    <div className={styles.container}>
      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} onAction={fetchProposals} />
      ))}
    </div>
  );
}
