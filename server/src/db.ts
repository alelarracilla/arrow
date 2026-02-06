import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(__dirname, "..", "arrow.db");

const db = new Database(DB_PATH);

// better concurrent read performance, we don't need to be that strict here
// we don't have any complex transactions
// most of the stuff is just read, and arc txs
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    bio TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    ens_name TEXT DEFAULT '',
    is_leader INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id),
    leader_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, leader_id)
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    image_url TEXT DEFAULT '',
    pair TEXT DEFAULT '',
    pair_address_0 TEXT DEFAULT '',
    pair_address_1 TEXT DEFAULT '',
    pool_fee INTEGER DEFAULT 3000,
    is_premium INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tips (
    id TEXT PRIMARY KEY,
    from_id TEXT NOT NULL REFERENCES users(id),
    to_id TEXT NOT NULL REFERENCES users(id),
    amount TEXT NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    message TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS limit_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    post_id TEXT REFERENCES posts(id),
    pool_key_hash TEXT NOT NULL,
    zero_for_one INTEGER NOT NULL,
    amount TEXT NOT NULL,
    trigger_price TEXT NOT NULL,
    on_chain_order_id INTEGER,
    status TEXT DEFAULT 'pending',
    tx_hash TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id TEXT NOT NULL REFERENCES users(id),
    post_id TEXT NOT NULL REFERENCES posts(id),
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trade_proposals (
    id TEXT PRIMARY KEY,
    user_address TEXT NOT NULL,
    type TEXT NOT NULL,
    zero_for_one INTEGER NOT NULL,
    amount TEXT NOT NULL,
    token0 TEXT DEFAULT '',
    token1 TEXT DEFAULT '',
    pool_fee INTEGER DEFAULT 3000,
    leader_address TEXT DEFAULT '',
    ai_confidence REAL DEFAULT 0,
    ai_reason TEXT DEFAULT '',
    slippage_bps INTEGER DEFAULT 50,
    urgency TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    tx_hash TEXT DEFAULT '',
    expires_at TEXT DEFAULT (datetime('now', '+5 minutes')),
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations
try { db.exec("ALTER TABLE users ADD COLUMN ens_name TEXT DEFAULT ''"); } catch { /* column already exists */ }

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_follows_leader ON follows(leader_id);
  CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_tips_to ON tips(to_id);
  CREATE INDEX IF NOT EXISTS idx_tips_from ON tips(from_id);
  CREATE INDEX IF NOT EXISTS idx_limit_orders_user ON limit_orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_limit_orders_status ON limit_orders(status);
  CREATE INDEX IF NOT EXISTS idx_trade_proposals_user ON trade_proposals(user_address);
  CREATE INDEX IF NOT EXISTS idx_trade_proposals_status ON trade_proposals(status);
  CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
`);

export default db;
