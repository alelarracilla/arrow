const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

let authToken: string | null = localStorage.getItem("arrow_token");

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("arrow_token", token);
  } else {
    localStorage.removeItem("arrow_token");
  }
}

export function getToken(): string | null {
  return authToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ── Auth ──

export async function authWallet(address: string, username?: string) {
  return request<{ token: string; user: User }>("/auth/wallet", {
    method: "POST",
    body: JSON.stringify({ address, username }),
  });
}

export async function getMe() {
  return request<{ user: User }>("/auth/me");
}

// ── Posts ──

export interface Post {
  id: string;
  author_id: string;
  content: string;
  image_url: string;
  pair: string;
  pair_address_0: string;
  pair_address_1: string;
  pool_fee: number;
  is_premium: number;
  created_at: string;
  username?: string;
  address?: string;
  avatar_url?: string;
  is_leader?: number;
  author_tip_count?: number;
}

export interface User {
  id: string;
  address: string;
  username: string;
  bio: string;
  avatar_url: string;
  is_leader: number;
  follower_count?: number;
  following_count?: number;
  post_count?: number;
  total_tips_received?: number;
}

export async function getPosts(limit = 20, offset = 0) {
  return request<{ posts: Post[] }>(`/posts?limit=${limit}&offset=${offset}`);
}

export async function getFollowingFeed(limit = 20, offset = 0) {
  return request<{ posts: Post[] }>(`/posts/feed/following?limit=${limit}&offset=${offset}`);
}

export async function createPost(data: {
  content: string;
  image_url?: string;
  pair?: string;
  pair_address_0?: string;
  pair_address_1?: string;
  pool_fee?: number;
  is_premium?: boolean;
}) {
  return request<{ post: Post }>("/posts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Users ──

export async function getUser(id: string) {
  return request<{ user: User }>(`/users/${id}`);
}

export async function followUser(id: string) {
  return request<{ ok: boolean }>(`/users/${id}/follow`, { method: "POST" });
}

export async function unfollowUser(id: string) {
  return request<{ ok: boolean }>(`/users/${id}/follow`, { method: "DELETE" });
}

export async function getLeaderboard(limit = 20) {
  return request<{ users: User[] }>(`/users?limit=${limit}`);
}

// ── Tips ──

export async function recordTip(data: {
  to_id: string;
  amount: string;
  tx_hash: string;
  message?: string;
}) {
  return request<{ tip: unknown }>("/tips", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Orders ──

export async function recordOrder(data: {
  post_id?: string;
  pool_key_hash: string;
  zero_for_one: boolean;
  amount: string;
  trigger_price: string;
  on_chain_order_id?: number;
}) {
  return request<{ order: unknown }>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyOrders(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return request<{ orders: unknown[] }>(`/orders${qs}`);
}

export interface TradeProposal {
  id: string;
  user_address: string;
  type: "copy-trade" | "limit-order" | "ai-suggestion";
  zero_for_one: number;
  amount: string;
  token0: string;
  token1: string;
  pool_fee: number;
  leader_address: string;
  ai_confidence: number;
  ai_reason: string;
  slippage_bps: number;
  urgency: string;
  status: "pending" | "approved" | "executed" | "rejected" | "expired";
  tx_hash: string;
  expires_at: string;
  created_at: string;
}

export async function getPendingProposals() {
  return request<{ proposals: TradeProposal[] }>("/trade-proposals/pending");
}

export async function getProposalHistory(limit = 20) {
  return request<{ proposals: TradeProposal[] }>(`/trade-proposals?limit=${limit}`);
}

export async function approveProposal(id: string) {
  return request<{ proposal: TradeProposal }>(`/trade-proposals/${id}/approve`, {
    method: "PATCH",
  });
}

export async function rejectProposal(id: string) {
  return request<{ proposal: TradeProposal }>(`/trade-proposals/${id}/reject`, {
    method: "PATCH",
  });
}

export async function confirmProposalExecuted(id: string, txHash: string) {
  return request<{ proposal: TradeProposal }>(`/trade-proposals/${id}/executed`, {
    method: "PATCH",
    body: JSON.stringify({ tx_hash: txHash }),
  });
}
