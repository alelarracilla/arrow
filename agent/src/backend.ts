/**
 * Backend API Client
 *
 * All HTTP calls to the Arrow server (proposals, orders, notifications).
 * Centralizes auth headers and error handling.
 */
import { config } from "./config";

// ── Types ──

export interface PendingOrder {
  id: string;
  user_id: string;
  user_address: string;
  username: string;
  pool_key_hash: string;
  zero_for_one: number;
  amount: string;
  trigger_price: string;
  pair: string;
  pair_address_0: string;
  pair_address_1: string;
  pool_fee: number;
}

export interface IdeaPost {
  id: string;
  author_id: string;
  content: string;
  pair: string;
  pair_address_0: string;
  pair_address_1: string;
  pool_fee: number;
  side: string;
  price: string;
  username: string;
  address: string;
  is_leader: number;
}

// ── Helpers ──

function agentHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-agent-secret": config.agentSecret,
  };
}

// ── Trade Proposals ──

export async function createTradeProposal(params: {
  userAddress: string;
  type: "copy-trade" | "limit-order" | "ai-suggestion";
  zeroForOne: boolean;
  amount: string;
  token0?: string;
  token1?: string;
  poolFee?: number;
  leaderAddress?: string;
  aiConfidence: number;
  aiReason: string;
  slippageBps?: number;
  urgency?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${config.backendUrl}/trade-proposals`, {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({
        user_address: params.userAddress,
        type: params.type,
        zero_for_one: params.zeroForOne,
        amount: params.amount,
        token0: params.token0 || "",
        token1: params.token1 || "",
        pool_fee: params.poolFee || 3000,
        leader_address: params.leaderAddress || "",
        ai_confidence: params.aiConfidence,
        ai_reason: params.aiReason,
        slippage_bps: params.slippageBps || 50,
        urgency: params.urgency || "medium",
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("  Failed to create trade proposal:", body);
      return false;
    }

    const { proposal } = (await res.json()) as { proposal: { id: string } };
    console.log(`  Trade proposal created: ${proposal.id}`);
    return true;
  } catch (err) {
    console.error("  Error creating trade proposal:", err);
    return false;
  }
}

// ── Orders ──

export async function fetchPendingOrders(): Promise<PendingOrder[]> {
  try {
    const res = await fetch(`${config.backendUrl}/orders/agent/pending`, {
      headers: { "x-agent-secret": config.agentSecret },
    });
    if (!res.ok) return [];
    const { orders } = (await res.json()) as { orders: PendingOrder[] };
    return orders;
  } catch {
    return [];
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: "executed" | "failed",
  txHash?: string,
): Promise<void> {
  try {
    await fetch(`${config.backendUrl}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: agentHeaders(),
      body: JSON.stringify({ status, tx_hash: txHash || "" }),
    });
  } catch {
    // Backend might not be running
  }
}

// ── Idea Posts ──

export async function fetchUnprocessedIdeas(): Promise<IdeaPost[]> {
  try {
    const res = await fetch(`${config.backendUrl}/posts/agent/unprocessed-ideas`, {
      headers: { "x-agent-secret": config.agentSecret },
    });
    if (!res.ok) return [];
    const { ideas } = (await res.json()) as { ideas: IdeaPost[] };
    return ideas;
  } catch {
    return [];
  }
}

export async function markIdeaProcessed(postId: string): Promise<void> {
  try {
    await fetch(`${config.backendUrl}/posts/agent/mark-processed`, {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({ post_id: postId }),
    });
  } catch {
    // Backend might not be running
  }
}

// ── Notifications ──

export async function notifyBackend(
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${config.backendUrl}/agent/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data, timestamp: Date.now() }),
    });
  } catch {
    // Backend might not be running
  }
}
