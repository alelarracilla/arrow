import { useState } from "react";
import styles from "./SetOrderModal.module.css";
import type { Post } from "../../api/client";
import { useWallet } from "../../context/WalletContext";
import { recordOrder } from "../../api/client";

interface SetOrderModalProps {
  post: Post;
  onClose: () => void;
}

export const SetOrderModal: React.FC<SetOrderModalProps> = ({ post, onClose }) => {
  const { isConnected, bundlerClient } = useWallet();
  const [amount, setAmount] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [txHash] = useState("");

  const handleSubmit = async () => {
    if (!amount || !triggerPrice) {
      setError("Amount and trigger price are required");
      return;
    }

    if (!isConnected || !bundlerClient) {
      setError("Connect your wallet first");
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      console.log(`[order] Placing ${direction.toUpperCase()} order: ${amount} USDC @ ${triggerPrice} for ${post.pair}`);
      console.log(`[order] Pair: ${post.pair_address_0} / ${post.pair_address_1} (fee: ${post.pool_fee})`);

      // Compute pool key hash for backend tracking
      const encoder = new TextEncoder();
      const data = encoder.encode(
        `${post.pair_address_0}:${post.pair_address_1}:${post.pool_fee}`
      );
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const poolKeyHash = `0x${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}`;

      // Record order in backend — the agent monitors and executes via CCTP bridge + Uniswap v4
      // Hook is on Base Sepolia, so direct on-chain calls from Arc need bridging first
      console.log(`[order] Recording in backend (pool_key_hash: ${poolKeyHash.slice(0, 14)}...)`);
      const result = await recordOrder({
        post_id: post.id,
        pool_key_hash: poolKeyHash,
        zero_for_one: direction === "buy",
        amount,
        trigger_price: triggerPrice,
      });

      console.log(`[order] Created:`, result);
      setStatus("success");
      setTimeout(onClose, 1500);
    } catch (err) {
      console.error("[order] Failed:", err);
      setError(err instanceof Error ? err.message : "Failed to place order");
      setStatus("error");
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Set Order — {post.pair}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Direction</label>
            <div className={styles.directionToggle}>
              <button
                className={`${styles.dirBtn} ${direction === "buy" ? styles.dirActive : ""}`}
                onClick={() => setDirection("buy")}
              >
                Buy
              </button>
              <button
                className={`${styles.dirBtn} ${direction === "sell" ? styles.dirActive : ""}`}
                onClick={() => setDirection("sell")}
              >
                Sell
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Amount (USDC)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={styles.input}
              step="0.01"
              min="0"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Trigger Price (USD)</label>
            <input
              type="number"
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(e.target.value)}
              placeholder="0.00"
              className={styles.input}
              step="0.01"
              min="0"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {status === "success" ? (
            <div className={styles.success}>
              Order placed successfully!
              {txHash && (
                <span className={styles.note} style={{ display: "block", marginTop: "0.5rem" }}>
                  Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </span>
              )}
            </div>
          ) : (
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={status === "submitting" || !isConnected}
            >
              {status === "submitting" ? "Placing Order..." : "Place Limit Order"}
            </button>
          )}

          <p className={styles.note}>
            The Arrow agent will execute this order when the trigger price is reached on Uniswap v4.
          </p>
        </div>
      </div>
    </div>
  );
};
