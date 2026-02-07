import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const SYSTEM_PROMPT = `You are the Arrow Trading Agent — an autonomous AI that operates on Uniswap v4 via the ArrowCopyTradeHook smart contract on Arc Testnet.

Your responsibilities:
1. Analyze LeaderSwap events and decide whether to relay them to followers
2. Evaluate pending limit orders against current market conditions and decide whether to execute
3. Interpret post metadata from the Arrow social feed to understand trading context

When analyzing a trade or order, respond with a JSON object (no markdown, no explanation):
{
  "action": "execute" | "skip" | "wait",
  "reason": "brief explanation",
  "confidence": 0.0-1.0,
  "adjustments": {
    "slippage_bps": number (optional, default 50),
    "urgency": "high" | "medium" | "low"
  }
}

Rules:
- USDC is the native currency on Arc Testnet (18 decimals)
- Always consider gas costs vs trade size
- For copy-trades: relay if the leader has a good track record and the follower has sufficient balance
- For limit orders: execute if the current price has crossed the trigger price
- If unsure, respond with "wait" — never execute a trade you're not confident about
- You are risk-averse by default. Protect user funds.`;

export interface AIDecision {
  action: "execute" | "skip" | "wait";
  reason: string;
  confidence: number;
  adjustments?: {
    slippage_bps?: number;
    urgency?: "high" | "medium" | "low";
  };
}

export async function evaluateLeaderSwap(context: {
  leader: string;
  followerCount: number;
  zeroForOne: boolean;
  amountSpecified: string;
  delta0: string;
  delta1: string;
  leaderTradeCount: number;
}): Promise<AIDecision> {
  const prompt = `A leader just swapped on Uniswap v4. Should I relay this to their followers?

Leader: ${context.leader}
Followers: ${context.followerCount}
Direction: ${context.zeroForOne ? "token0 → token1 (buy)" : "token1 → token0 (sell)"}
Amount: ${context.amountSpecified}
Delta0: ${context.delta0}
Delta1: ${context.delta1}
Leader's total trade count: ${context.leaderTradeCount}

Evaluate and respond with the JSON decision.`;

  return callAI(prompt);
}

export async function evaluateLimitOrder(context: {
  orderId: number;
  owner: string;
  zeroForOne: boolean;
  amountSpecified: string;
  triggerPrice: string;
  currentPrice: string;
  createdAt: number;
}): Promise<AIDecision> {
  const prompt = `A user has a pending limit order. Should I execute it now?

Order ID: ${context.orderId}
Owner: ${context.owner}
Direction: ${context.zeroForOne ? "buy (zeroForOne)" : "sell (oneForZero)"}
Amount: ${context.amountSpecified}
Trigger Price: ${context.triggerPrice}
Current Pool Price (sqrtPriceX96): ${context.currentPrice}
Created: ${new Date(context.createdAt * 1000).toISOString()}
Age: ${Math.floor((Date.now() / 1000 - context.createdAt) / 3600)} hours

Evaluate whether the current price has crossed the trigger price and respond with the JSON decision.`;

  return callAI(prompt);
}

export async function analyzePostForTrading(context: {
  content: string;
  pair: string;
  authorUsername: string;
  isLeader: boolean;
}): Promise<AIDecision & { sentiment?: "bullish" | "bearish" | "neutral" }> {
  const prompt = `Analyze this trading post from the Arrow social feed:

Author: @${context.authorUsername} ${context.isLeader ? "(Leader)" : ""}
Pair: ${context.pair || "N/A"}
Content: "${context.content}"

Provide your analysis as JSON with an additional "sentiment" field ("bullish", "bearish", or "neutral").`;

  const decision = await callAI(prompt);
  return decision as AIDecision & { sentiment?: "bullish" | "bearish" | "neutral" };
}

export interface IdeaDecision extends AIDecision {
  order_type: "market" | "limit";
  suggested_amount?: string;
  suggested_slippage_bps?: number;
}

export async function analyzeIdeaPost(context: {
  postId: string;
  content: string;
  pair: string;
  side: "buy" | "sell";
  price: string;
  authorUsername: string;
  authorAddress: string;
  isLeader: boolean;
  pairAddress0: string;
  pairAddress1: string;
}): Promise<IdeaDecision> {
  const hasPrice = !!context.price && context.price !== "0";
  const orderType = hasPrice ? "limit" : "market";

  const prompt = `You are processing a trade idea from the Arrow social feed. This idea was posted by a leader and needs to be converted into a trade proposal for their followers.

=== IDEA POST DATA ===
Post ID: ${context.postId}
Author: @${context.authorUsername} ${context.isLeader ? "(Leader)" : "(Regular user)"}
Author Address: ${context.authorAddress}
Pair: ${context.pair}
Token0: ${context.pairAddress0 || "unknown"}
Token1: ${context.pairAddress1 || "unknown"}
Side: ${context.side.toUpperCase()}
Price: ${hasPrice ? context.price : "NOT SET (market order)"}
Description: "${context.content}"
Order Type: ${orderType}

=== YOUR TASK ===
Evaluate this trade idea and decide whether it should generate trade proposals for the author's followers.

Respond with JSON:
{
  "action": "execute" | "skip" | "wait",
  "reason": "brief explanation of your evaluation",
  "confidence": 0.0-1.0,
  "order_type": "${orderType}",
  "suggested_amount": "suggested trade amount in USDC (e.g. '10')",
  "suggested_slippage_bps": number (default 50, max 500),
  "adjustments": {
    "slippage_bps": number,
    "urgency": "high" | "medium" | "low"
  }
}

Rules:
- If the author is a Leader, give higher confidence
- ${orderType === "market" ? "No price was set — this is a MARKET order. The agent should execute at current market price." : `Price ${context.price} was set — this is a LIMIT order. Only execute when price reaches ${context.price}.`}
- side "${context.side}" means the leader wants to ${context.side === "buy" ? "buy token0 with token1 (zeroForOne=false)" : "sell token0 for token1 (zeroForOne=true)"}
- Be conservative with amounts — suggest reasonable sizes
- If the idea description is vague or low quality, skip it`;

  const decision = await callAI(prompt);
  return {
    ...decision,
    order_type: orderType,
    suggested_amount: (decision as unknown as Record<string, unknown>).suggested_amount as string | undefined,
    suggested_slippage_bps: (decision as unknown as Record<string, unknown>).suggested_slippage_bps as number | undefined,
  };
}

async function callAI(prompt: string): Promise<AIDecision> {
  if (!config.anthropicApiKey) {
    console.log("[ai] No ANTHROPIC_API_KEY set, using default skip decision");
    return {
      action: "skip",
      reason: "AI not configured — ANTHROPIC_API_KEY not set",
      confidence: 0,
    };
  }

  try {
    const response = await client.messages.create({
      model: config.aiModel,
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response — handle potential markdown wrapping
    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr) as AIDecision;

    // Validate
    if (!["execute", "skip", "wait"].includes(parsed.action)) {
      throw new Error(`Invalid action: ${parsed.action}`);
    }

    return parsed;
  } catch (err) {
    console.error("[ai] Error calling Anthropic:", err);
    return {
      action: "wait",
      reason: `AI error: ${err instanceof Error ? err.message : "unknown"}`,
      confidence: 0,
    };
  }
}
