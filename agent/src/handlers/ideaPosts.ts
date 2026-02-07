/**
 * Idea Post Processor (RAG-style: DB → AI → Trade Proposal)
 *
 * Fetches unprocessed idea posts from the backend, runs them through
 * AI evaluation, and creates trade proposals for the author's followers.
 */
import { type Address } from "viem";
import { config } from "../config";
import { baseSepoliaPublicClient } from "../clients";
import { hookAbi } from "../abi";
import { analyzeIdeaPost, type IdeaDecision } from "../ai";
import {
  fetchUnprocessedIdeas,
  markIdeaProcessed,
  createTradeProposal,
} from "../backend";

export async function processIdeaPosts(): Promise<void> {
  const ideas = await fetchUnprocessedIdeas();
  if (ideas.length === 0) return;

  console.log(`\n[agent] Processing ${ideas.length} new idea post(s)...`);

  for (const idea of ideas) {
    try {
      console.log(`  Idea by @${idea.username}: ${idea.pair} ${idea.side.toUpperCase()}${idea.price ? ` @ ${idea.price}` : " (market)"}`);

      // Run through AI for evaluation
      const decision: IdeaDecision = await analyzeIdeaPost({
        postId: idea.id,
        content: idea.content,
        pair: idea.pair,
        side: idea.side as "buy" | "sell",
        price: idea.price,
        authorUsername: idea.username,
        authorAddress: idea.address,
        isLeader: !!idea.is_leader,
        pairAddress0: idea.pair_address_0,
        pairAddress1: idea.pair_address_1,
      });

      console.log(`  AI: ${decision.action} (${decision.confidence}) — ${decision.reason}`);
      console.log(`  Order type: ${decision.order_type}`);

      // If AI says execute, get followers and create trade proposals
      if (decision.action === "execute" && decision.confidence >= 0.5) {
        let followers: string[] = [];
        if (config.hookAddress) {
          try {
            followers = (await baseSepoliaPublicClient.readContract({
              address: config.hookAddress,
              abi: hookAbi,
              functionName: "getFollowers",
              args: [idea.address as Address],
            })) as string[];
          } catch {
            console.log("  Could not fetch on-chain followers, using author only");
          }
        }

        // Always include the author themselves
        const targets = followers.length > 0 ? followers : [idea.address];

        // zeroForOne: sell = true (selling token0 for token1), buy = false
        const zeroForOne = idea.side === "sell";
        const amount = decision.suggested_amount || "10";

        console.log(`  Creating ${decision.order_type} proposals for ${targets.length} user(s)...`);

        for (const target of targets) {
          await createTradeProposal({
            userAddress: target,
            type: decision.order_type === "limit" ? "limit-order" : "ai-suggestion",
            zeroForOne,
            amount,
            token0: idea.pair_address_0,
            token1: idea.pair_address_1,
            poolFee: idea.pool_fee,
            leaderAddress: idea.address,
            aiConfidence: decision.confidence,
            aiReason: `[Idea by @${idea.username}] ${decision.reason}`,
            slippageBps: decision.suggested_slippage_bps || decision.adjustments?.slippage_bps,
            urgency: decision.adjustments?.urgency,
          });
        }
      }

      // Mark as processed regardless of decision
      await markIdeaProcessed(idea.id);
    } catch (err) {
      console.error(`  Error processing idea ${idea.id}:`, err);
    }
  }
}
