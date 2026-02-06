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
import { parseEther, type Address } from "viem";

const SWAP_ROUTER_ADDRESS = (import.meta.env.VITE_SWAP_ROUTER_ADDRESS || "") as Address;
const HOOK_ADDRESS = (import.meta.env.VITE_HOOK_ADDRESS || "") as Address;

const POLL_INTERVAL = 10_000;

const SWAP_ROUTER_ABI = [
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
      { name: "testSettings", type: "bytes" },
    ],
    outputs: [{ name: "delta", type: "int256" }],
  },
] as const;

// sqrtPriceX96 limits for max slippage
const MIN_SQRT_PRICE = BigInt("4295128739") + 1n;
const MAX_SQRT_PRICE = BigInt("1461446703485210103287273052203988822378723970342") - 1n;

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
      // Step 1: Mark as approved in backend
      await approveProposal(proposal.id);

      // Step 2: Build and sign the swap tx with the user's passkey
      const amountWei = parseEther(proposal.amount);
      const zeroForOne = !!proposal.zero_for_one;

      if (SWAP_ROUTER_ADDRESS && HOOK_ADDRESS) {
        const poolKey = {
          currency0: (proposal.token0 || "0x0000000000000000000000000000000000000000") as Address,
          currency1: (proposal.token1 || "0x0000000000000000000000000000000000000000") as Address,
          fee: proposal.pool_fee || 3000,
          tickSpacing: 60,
          hooks: HOOK_ADDRESS,
        };

        const swapParams = {
          zeroForOne,
          amountSpecified: -amountWei, // negative = exact input
          sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE,
        };

        const hash = await bundlerClient.sendUserOperation({
          calls: [
            {
              to: SWAP_ROUTER_ADDRESS,
              abi: SWAP_ROUTER_ABI,
              functionName: "swap",
              args: [poolKey, swapParams, "0x"],
            },
          ],
        });

        // Step 3: Confirm execution in backend
        await confirmProposalExecuted(proposal.id, hash);
        setStatus("success");
      } else {
        // Contracts not deployed — just mark approved for demo
        setStatus("success");
      }

      setTimeout(onAction, 1500);
    } catch (err) {
      console.error("Trade approval error:", err);
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
