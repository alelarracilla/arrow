/**
 * Arrow DB Seeder
 *
 * Seeds the database with test data for the cross-chain CCTP + Uniswap v4 flow.
 * Uses real wallet addresses and Base Sepolia token addresses.
 *
 * Usage:
 *   npx ts-node src/seed.ts          # seed (additive)
 *   npx ts-node src/seed.ts --reset  # wipe DB + re-seed
 */
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import db from "./db";

// ── Reset mode ──
if (process.argv.includes("--reset")) {
  console.log("[seed] Resetting database...");
  db.exec("DELETE FROM comments");
  db.exec("DELETE FROM likes");
  db.exec("DELETE FROM trade_proposals");
  db.exec("DELETE FROM limit_orders");
  db.exec("DELETE FROM tips");
  db.exec("DELETE FROM follows");
  db.exec("DELETE FROM posts");
  db.exec("DELETE FROM users");
  console.log("[seed] All tables cleared.\n");
}

// ── Base Sepolia token addresses (where Uniswap v4 swaps happen) ──
const TOKENS = {
  // Base Sepolia USDC (bridged from Arc via CCTP)
  USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  // Base Sepolia WETH
  WETH: "0x4200000000000000000000000000000000000006",
  // Base Sepolia DAI (test)
  DAI: "0x7683022d84F726a96c4A6611cD31DBf5409c0Ac9",
};

// ── Users — real wallets ──
const USERS = [
  {
    id: uuidv4(),
    address: "0x55fddae69dc97e0267c5d6029ff6f00787c57a83",
    username: "alelarracilla",
    bio: "Builder @ Arrow. Cross-chain degen.",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0xabdf3f67090b07aa0a9442ea650cc950b5810a2b",
    username: "0xaDanteees",
    bio: "Tape reader. Liquidity hunter.",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0xa946ab63953c07eb9e723d2adcc326fbf00f2989",
    username: "dan_arc",
    bio: "Arc testnet OG. USDC maximalist.",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0x0000000000000000000000000000000000000001",
    username: "defi_sarah",
    bio: "DeFi researcher. On-chain analytics & Uniswap v4 hooks.",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0x0000000000000000000000000000000000000002",
    username: "chart_master",
    bio: "Technical analysis. Order blocks & liquidity sweeps.",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0x0000000000000000000000000000000000000003",
    username: "alice_trades",
    bio: "Learning to trade. Following the best on Arrow.",
    is_leader: 0,
  },
  {
    id: uuidv4(),
    address: "0x0000000000000000000000000000000000000004",
    username: "bob_hodl",
    bio: "Long-term holder. Occasional swing trades via CCTP bridge.",
    is_leader: 0,
  },
];

const insertUser = db.prepare(
  "INSERT OR IGNORE INTO users (id, address, username, bio, is_leader) VALUES (?, ?, ?, ?, ?)"
);

for (const u of USERS) {
  insertUser.run(u.id, u.address, u.username, u.bio, u.is_leader);
}
console.log(`[seed] ${USERS.length} users`);

// ── Posts — use Base Sepolia token addresses for idea pairs ──
const POSTS = [
  {
    author: "alelarracilla",
    content:
      "WETH/USDC on Base Sepolia looking interesting. Bridging USDC from Arc via CCTP to take a position. The cross-chain flow is smooth — burn on Arc, mint on Base, swap on Uniswap v4.",
    pair: "WETH/USDC",
    pair_address_0: TOKENS.WETH,
    pair_address_1: TOKENS.USDC,
    pool_fee: 3000,
    post_type: "idea" as const,
    side: "buy",
    price: "",
    is_premium: 0,
  },
  {
    author: "0xaDanteees",
    content:
      "DAI/USDC spread is widening on Base Sepolia. Good arb opportunity if you bridge USDC from Arc. Setting a limit sell at 1.002.",
    pair: "DAI/USDC",
    pair_address_0: TOKENS.DAI,
    pair_address_1: TOKENS.USDC,
    pool_fee: 500,
    post_type: "idea" as const,
    side: "sell",
    price: "1.002",
    is_premium: 1,
  },
  {
    author: "dan_arc",
    content:
      "Testing the full CCTP bridge flow: Arc → Base Sepolia → Uniswap v4 swap → CCTP back to Arc. Attestation takes ~0.5s from Arc. Incredibly fast.",
    pair: "WETH/USDC",
    pair_address_0: TOKENS.WETH,
    pair_address_1: TOKENS.USDC,
    pool_fee: 3000,
    post_type: "idea" as const,
    side: "buy",
    price: "",
    is_premium: 0,
  },
  {
    author: "defi_sarah",
    content:
      "Uniswap v4 hooks on Base Sepolia are live. Arrow's copy-trade hook uses afterSwap to emit LeaderSwap events. The agent picks these up and creates proposals for followers. No seed phrases needed — passkey auth via Circle smart accounts.",
    pair: "",
    pair_address_0: "",
    pair_address_1: "",
    pool_fee: 3000,
    post_type: "post" as const,
    side: "",
    price: "",
    is_premium: 0,
  },
  {
    author: "chart_master",
    content:
      "WETH showing a clean bullish divergence on the 4H RSI. Accumulation zone around current levels. Bridging 50 USDC from Arc to go long via PoolSwapTest.",
    pair: "WETH/USDC",
    pair_address_0: TOKENS.WETH,
    pair_address_1: TOKENS.USDC,
    pool_fee: 3000,
    post_type: "idea" as const,
    side: "buy",
    price: "",
    is_premium: 0,
  },
  {
    author: "alelarracilla",
    content:
      "Arrow architecture: your USDC lives on Arc (native gas token, 18 decimals). When you want to swap, we bridge via Circle CCTP to Base Sepolia where Uniswap v4 is deployed. Swap happens there, then we bridge the output back. All signed with your passkey.",
    pair: "",
    pair_address_0: "",
    pair_address_1: "",
    pool_fee: 3000,
    post_type: "post" as const,
    side: "",
    price: "",
    is_premium: 0,
  },
  {
    author: "alice_trades",
    content:
      "Just started following @alelarracilla and @0xaDanteees — their cross-chain trade ideas are on point. Copy trading through Arrow makes it so easy.",
    pair: "",
    pair_address_0: "",
    pair_address_1: "",
    pool_fee: 3000,
    post_type: "post" as const,
    side: "",
    price: "",
    is_premium: 0,
  },
  {
    author: "0xaDanteees",
    content:
      "WETH/USDC market sell. Taking profit on the bounce. Bridging output USDC back to Arc via CCTP.",
    pair: "WETH/USDC",
    pair_address_0: TOKENS.WETH,
    pair_address_1: TOKENS.USDC,
    pool_fee: 3000,
    post_type: "idea" as const,
    side: "sell",
    price: "",
    is_premium: 1,
  },
];

const insertPost = db.prepare(
  `INSERT INTO posts (id, author_id, content, pair, pair_address_0, pair_address_1, pool_fee, post_type, side, price, is_premium)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

for (const p of POSTS) {
  const user = USERS.find((u) => u.username === p.author);
  if (!user) continue;
  insertPost.run(
    uuidv4(),
    user.id,
    p.content,
    p.pair,
    p.pair_address_0,
    p.pair_address_1,
    p.pool_fee,
    p.post_type,
    p.side,
    p.price,
    p.is_premium
  );
}
console.log(`[seed] ${POSTS.length} posts`);

// ── Follows ──
const insertFollow = db.prepare(
  "INSERT OR IGNORE INTO follows (follower_id, leader_id) VALUES (?, ?)"
);

const alice = USERS.find((u) => u.username === "alice_trades")!;
const bob = USERS.find((u) => u.username === "bob_hodl")!;
const leaders = USERS.filter((u) => u.is_leader);

// alice and bob follow all leaders
for (const leader of leaders) {
  insertFollow.run(alice.id, leader.id);
  insertFollow.run(bob.id, leader.id);
}

// dan follows alelarracilla and 0xaDanteees
const dan = USERS.find((u) => u.username === "dan_arc")!;
const ale = USERS.find((u) => u.username === "alelarracilla")!;
const dante = USERS.find((u) => u.username === "0xaDanteees")!;
insertFollow.run(dan.id, ale.id);
insertFollow.run(dan.id, dante.id);

// alelarracilla follows 0xaDanteees and vice versa
insertFollow.run(ale.id, dante.id);
insertFollow.run(dante.id, ale.id);

const followCount = leaders.length * 2 + 4;
console.log(`[seed] ${followCount} follows`);

// ── Tips (USDC amounts — Arc native, 18 decimals displayed as human-readable) ──
const insertTip = db.prepare(
  "INSERT INTO tips (id, from_id, to_id, amount, tx_hash, message) VALUES (?, ?, ?, ?, ?, ?)"
);

insertTip.run(uuidv4(), alice.id, ale.id, "5.0", "0xseed_tip_001", "Great CCTP bridge guide!");
insertTip.run(uuidv4(), bob.id, dante.id, "10.0", "0xseed_tip_002", "Love the tape reading");
insertTip.run(uuidv4(), alice.id, dan.id, "2.5", "0xseed_tip_003", "Nice cross-chain flow demo");
insertTip.run(uuidv4(), dan.id, ale.id, "15.0", "0xseed_tip_004", "Arrow is going to be huge");
insertTip.run(uuidv4(), bob.id, ale.id, "7.5", "0xseed_tip_005", "");

console.log("[seed] 5 tips");
console.log("[seed] Done!");
