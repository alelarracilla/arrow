import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import db from "./db";

const USERS = [
  {
    id: uuidv4(),
    address: "0xaabb000000000000000000000000000000000077",
    username: "alan",
    bio: "Heavy leverager",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0xaabb000000000000000000000000000000000001",
    username: "crypto_whale",
    bio: "Full-time trader. ETH maximalist.",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0xaabb000000000000000000000000000000000067",
    username: "0xaDanteees",
    bio: "Full-time [redacted]. tape ghost.",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0xaabb0000000000000000000000000000000000421",
    username: "alelarracilla",
    bio: "Closet crypto trader",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0xaabb000000000000000000000000000000000002",
    username: "defi_sarah",
    bio: "DeFi researcher @ Arrow. On-chain analytics.",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0xaabb000000000000000000000000000000000003",
    username: "chart_master",
    bio: "Technical analysis. Order blocks & liquidity sweeps.",
    is_leader: 1,
  },
  {
    id: uuidv4(),
    address: "0xaabb000000000000000000000000000000000004",
    username: "alice_trades",
    bio: "Learning to trade. Following the best.",
    is_leader: 0,
  },
  {
    id: uuidv4(),
    address: "0xaabb000000000000000000000000000000000005",
    username: "bob_hodl",
    bio: "Long-term holder. Occasional swing trades.",
    is_leader: 0,
  },
];

const insertUser = db.prepare(
  "INSERT OR IGNORE INTO users (id, address, username, bio, is_leader) VALUES (?, ?, ?, ?, ?)"
);

for (const u of USERS) {
  insertUser.run(u.id, u.address, u.username, u.bio, u.is_leader);
}

console.log(`Seeded ${USERS.length} users`);

// Posts with pair metadata (the ones that show "Set Order")
const POSTS = [
  {
    author: "crypto_whale",
    content:
      "Price is currently moving into the order block area. Risk is clearly defined — patience is key here.",
    pair: "ETH/USDT",
    pair_address_0: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    pair_address_1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    pool_fee: 3000,
    post_type: "idea" as const,
    side: "buy",
    price: "",
    is_premium: 0,
  },
  {
    author: "defi_sarah",
    content:
      "BTC breaking above the 200 EMA on the 4H. If we hold this level, expecting a push to 72k. Setting a limit buy at 68.5k with tight stop.",
    pair: "BTC/USDC",
    pair_address_0: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    pair_address_1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    pool_fee: 3000,
    post_type: "idea" as const,
    side: "buy",
    price: "68500",
    is_premium: 1,
  },
  {
    author: "chart_master",
    content:
      "LINK showing a clean bullish divergence on the RSI. Accumulation zone between $12-13. This is where smart money is loading up.",
    pair: "LINK/USDC",
    pair_address_0: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    pair_address_1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    pool_fee: 3000,
    post_type: "idea" as const,
    side: "buy",
    price: "12.50",
    is_premium: 0,
  },
  {
    author: "defi_sarah",
    content:
      "New Uniswap v4 hooks are a game changer for DeFi. The ability to add custom logic to swaps opens up limit orders, copy trading, and more. Arrow is building exactly this.",
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
    author: "crypto_whale",
    content:
      "ARB looking strong at support. Watching for a bounce off the 0.618 fib. If it holds, targeting $1.80.",
    pair: "ARB/USDC",
    pair_address_0: "0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1",
    pair_address_1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    pool_fee: 3000,
    post_type: "idea" as const,
    side: "sell",
    price: "",
    is_premium: 1,
  },
  {
    author: "alice_trades",
    content:
      "Just started following @crypto_whale — his ETH calls have been on point. Copy trading makes it so easy to mirror positions.",
    pair: "",
    pair_address_0: "",
    pair_address_1: "",
    pool_fee: 3000,
    post_type: "post" as const,
    side: "",
    price: "",
    is_premium: 0,
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

console.log(`Seeded ${POSTS.length} posts`);

// Follows: alice and bob follow the leaders
const insertFollow = db.prepare(
  "INSERT OR IGNORE INTO follows (follower_id, leader_id) VALUES (?, ?)"
);

const alice = USERS.find((u) => u.username === "alice_trades")!;
const bob = USERS.find((u) => u.username === "bob_hodl")!;
const leaders = USERS.filter((u) => u.is_leader);

for (const leader of leaders) {
  insertFollow.run(alice.id, leader.id);
  insertFollow.run(bob.id, leader.id);
}

console.log(`Seeded follows (${leaders.length * 2} relationships)`);

// Tips
const insertTip = db.prepare(
  "INSERT INTO tips (id, from_id, to_id, amount, tx_hash, message) VALUES (?, ?, ?, ?, ?, ?)"
);

insertTip.run(uuidv4(), alice.id, leaders[0].id, "5.0", "0xfake_tip_hash_001", "Great ETH call!");
insertTip.run(uuidv4(), bob.id, leaders[1].id, "10.0", "0xfake_tip_hash_002", "Love the analysis");
insertTip.run(uuidv4(), alice.id, leaders[2].id, "2.5", "0xfake_tip_hash_003", "");

console.log("Seeded 3 tips");
console.log("Done!");
