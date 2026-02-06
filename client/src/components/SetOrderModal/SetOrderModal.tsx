import { useState } from "react";
import styles from "./SetOrderModal.module.css";
import type { Post } from "../../api/client";
import { useWallet } from "../../context/WalletContext";
import { recordOrder } from "../../api/client";
import { parseEther, type Address } from "viem";

const HOOK_ADDRESS = (import.meta.env.VITE_HOOK_ADDRESS || "") as Address;

// placeLimitOrder ABI from ArrowCopyTradeHook
const PLACE_LIMIT_ORDER_ABI = [
  {
    name: "placeLimitOrder",
    type: "function",
    stateMutability: "nonpayable",
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
      { name: "zeroForOne", type: "bool" },
      { name: "amountSpecified", type: "int256" },
      { name: "triggerPrice", type: "uint160" },
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
  },
] as const;

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
  const [txHash, setTxHash] = useState("");

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
      const amountWei = parseEther(amount);
      const triggerPriceWei = parseEther(triggerPrice);

      // Build the PoolKey from post metadata
      const poolKey = {
        currency0: post.pair_address_0 as Address,
        currency1: post.pair_address_1 as Address,
        fee: post.pool_fee,
        tickSpacing: 60, // standard for 3000 fee tier
        hooks: HOOK_ADDRESS,
      };

      if (HOOK_ADDRESS) {
        // On-chain: call placeLimitOrder on the hook contract via Circle smart account
        const hash = await bundlerClient.sendUserOperation({
          calls: [
            {
              to: HOOK_ADDRESS,
              abi: PLACE_LIMIT_ORDER_ABI,
              functionName: "placeLimitOrder",
              args: [poolKey, direction === "buy", amountWei, triggerPriceWei],
            },
          ],
        });

        setTxHash(hash);

        // Also record in backend for the agent to track
        const encoder = new TextEncoder();
        const data = encoder.encode(
          `${post.pair_address_0}:${post.pair_address_1}:${post.pool_fee}`
        );
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const poolKeyHash = `0x${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}`;

        await recordOrder({
          post_id: post.id,
          pool_key_hash: poolKeyHash,
          zero_for_one: direction === "buy",
          amount,
          trigger_price: triggerPrice,
        });
      } else {
        // Hook not deployed yet — record in backend only, agent will handle
        const encoder = new TextEncoder();
        const data = encoder.encode(
          `${post.pair_address_0}:${post.pair_address_1}:${post.pool_fee}`
        );
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const poolKeyHash = `0x${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}`;

        await recordOrder({
          post_id: post.id,
          pool_key_hash: poolKeyHash,
          zero_for_one: direction === "buy",
          amount,
          trigger_price: triggerPrice,
        });
      }

      setStatus("success");
      setTimeout(onClose, 1500);
    } catch (err) {
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
