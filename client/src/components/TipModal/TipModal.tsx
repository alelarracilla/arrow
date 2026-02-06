import { useState } from "react";
import styles from "./TipModal.module.css";
import type { Post } from "../../api/client";
import { useWallet } from "../../context/WalletContext";
import { recordTip } from "../../api/client";
import { parseEther, type Address } from "viem";

// ArrowTipping ABI — only the tip function
const TIPPING_ABI = [
  {
    name: "tip",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "message", type: "string" },
    ],
    outputs: [],
  },
] as const;

const TIPPING_ADDRESS = (import.meta.env.VITE_TIPPING_ADDRESS || "") as Address;

interface TipModalProps {
  post: Post;
  onClose: () => void;
}

export const TipModal: React.FC<TipModalProps> = ({ post, onClose }) => {
  const { isConnected, bundlerClient } = useWallet();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  const presets = ["1", "5", "10", "25"];

  const handleTip = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }

    if (!isConnected || !bundlerClient) {
      setError("Connect your wallet first");
      return;
    }

    if (!post.address) {
      setError("Creator address not found");
      return;
    }

    setStatus("submitting");
    setError("");

    try {
      if (TIPPING_ADDRESS) {
        // Send tip via ArrowTipping contract using Circle bundlerClient
        const hash = await bundlerClient.sendUserOperation({
          calls: [
            {
              to: TIPPING_ADDRESS,
              value: parseEther(amount),
              abi: TIPPING_ABI,
              functionName: "tip",
              args: [post.address as Address, message],
            },
          ],
        });

        setTxHash(hash);

        // Record in backend
        await recordTip({
          to_id: post.author_id,
          amount,
          tx_hash: hash,
          message,
        });
      } else {
        // Direct native transfer (fallback if tipping contract not deployed, it isnt rn)
        const hash = await bundlerClient.sendUserOperation({
          calls: [
            {
              to: post.address as Address,
              value: parseEther(amount),
            },
          ],
        });

        setTxHash(hash);

        await recordTip({
          to_id: post.author_id,
          amount,
          tx_hash: hash,
          message,
        });
      }

      setStatus("success");
    } catch (err) {
      console.error("Tip error:", err);
      setError(err instanceof Error ? err.message : "Failed to send tip");
      setStatus("error");
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Tip @{post.username}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {status === "success" ? (
            <div className={styles.successBlock}>
              <div className={styles.successIcon}>✓</div>
              <p className={styles.successText}>
                Sent {amount} USDC to @{post.username}!
              </p>
              {txHash && (
                <p className={styles.txHash}>
                  Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </p>
              )}
              <button className={styles.doneBtn} onClick={onClose}>Done</button>
            </div>
          ) : (
            <>
              <div className={styles.presets}>
                {presets.map((p) => (
                  <button
                    key={p}
                    className={`${styles.presetBtn} ${amount === p ? styles.presetActive : ""}`}
                    onClick={() => setAmount(p)}
                  >
                    {p} USDC
                  </button>
                ))}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Custom Amount (USDC)</label>
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
                <label className={styles.label}>Message (optional)</label>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Great analysis!"
                  className={styles.input}
                  maxLength={140}
                />
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <button
                className={styles.submitBtn}
                onClick={handleTip}
                disabled={status === "submitting" || !isConnected}
              >
                {status === "submitting" ? "Sending..." : `Send ${amount || "0"} USDC`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
