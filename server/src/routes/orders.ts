import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { authRequired } from "../middleware/auth";

const router = Router();

// POST /orders — record a limit order (called after on-chain placeLimitOrder tx)
router.post("/", authRequired, (req: Request, res: Response): void => {
  const {
    post_id,
    pool_key_hash,
    zero_for_one,
    amount,
    trigger_price,
    on_chain_order_id,
  } = req.body;

  if (!pool_key_hash || zero_for_one === undefined || !amount || !trigger_price) {
    res.status(400).json({ error: "pool_key_hash, zero_for_one, amount, trigger_price required" });
    return;
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO limit_orders (id, user_id, post_id, pool_key_hash, zero_for_one, amount, trigger_price, on_chain_order_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user!.userId,
    post_id || null,
    pool_key_hash,
    zero_for_one ? 1 : 0,
    String(amount),
    String(trigger_price),
    on_chain_order_id ?? null
  );

  const order = db.prepare("SELECT * FROM limit_orders WHERE id = ?").get(id);
  console.log(`[order] Created #${id.slice(0,8)} | user=${req.user!.userId.slice(0,8)} | ${zero_for_one ? 'SELL' : 'BUY'} ${amount} @ ${trigger_price} | pool=${pool_key_hash?.slice(0,10)}`);
  res.status(201).json({ order });
});

// Agent polls for pending orders to execute via CCTP bridge + Uniswap v4 swap
router.get("/agent/pending", (req: Request, res: Response): void => {
  const AGENT_SECRET = process.env.AGENT_SECRET || "arrow-agent-secret";
  const agentKey = req.headers["x-agent-secret"];
  if (agentKey !== AGENT_SECRET) {
    res.status(403).json({ error: "Invalid agent secret" });
    return;
  }

  const orders = db.prepare(
    `SELECT o.*, u.address as user_address, u.username,
            p.pair, p.pair_address_0, p.pair_address_1, p.pool_fee
     FROM limit_orders o
     JOIN users u ON o.user_id = u.id
     LEFT JOIN posts p ON o.post_id = p.id
     WHERE o.status = 'pending'
     ORDER BY o.created_at ASC
     LIMIT 20`
  ).all();

  if (orders.length > 0) {
    console.log(`[orders] Agent polling: ${orders.length} pending order(s)`);
  }

  res.json({ orders });
});

// current
router.get("/", authRequired, (req: Request, res: Response): void => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  let query = `SELECT o.*, p.pair, p.content as post_content
               FROM limit_orders o
               LEFT JOIN posts p ON o.post_id = p.id
               WHERE o.user_id = ?`;
  const params: unknown[] = [req.user!.userId];

  if (status) {
    query += " AND o.status = ?";
    params.push(status);
  }

  query += " ORDER BY o.created_at DESC LIMIT ?";
  params.push(limit);

  const orders = db.prepare(query).all(...params);
  res.json({ orders });
});

// Agent creates a test order (for testing/seeding)
router.post("/agent/create", (req: Request, res: Response): void => {
  const AGENT_SECRET = process.env.AGENT_SECRET || "arrow-agent-secret";
  const agentKey = req.headers["x-agent-secret"];
  if (agentKey !== AGENT_SECRET) {
    res.status(403).json({ error: "Invalid agent secret" });
    return;
  }

  const { user_id, post_id, pool_key_hash, zero_for_one, amount, trigger_price } = req.body;
  if (!user_id || !pool_key_hash || zero_for_one === undefined || !amount || !trigger_price) {
    res.status(400).json({ error: "user_id, pool_key_hash, zero_for_one, amount, trigger_price required" });
    return;
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO limit_orders (id, user_id, post_id, pool_key_hash, zero_for_one, amount, trigger_price)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, user_id, post_id || null, pool_key_hash, zero_for_one ? 1 : 0, String(amount), String(trigger_price));

  const order = db.prepare("SELECT * FROM limit_orders WHERE id = ?").get(id);
  console.log(`[order] Agent created #${id.slice(0,8)} | ${zero_for_one ? 'BUY' : 'SELL'} ${amount} @ ${trigger_price}`);
  res.status(201).json({ order });
});

// agent or user updates order status
router.patch("/:id/status", (req: Request, res: Response): void => {
  // Accept either JWT auth or agent secret
  const AGENT_SECRET = process.env.AGENT_SECRET || "arrow-agent-secret";
  const agentKey = req.headers["x-agent-secret"];
  const isAgent = agentKey === AGENT_SECRET;

  if (!isAgent) {
    // Fall back to JWT auth
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "Auth required (JWT or agent secret)" });
      return;
    }
  }

  const { status, tx_hash } = req.body;

  if (!status || !["pending", "executed", "cancelled", "failed"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const order = db.prepare("SELECT * FROM limit_orders WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  db.prepare("UPDATE limit_orders SET status = ?, tx_hash = ? WHERE id = ?").run(
    status,
    tx_hash || "",
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM limit_orders WHERE id = ?").get(req.params.id);
  console.log(`[order] Status update #${req.params.id.slice(0,8)} -> ${status}${tx_hash ? ` tx=${tx_hash.slice(0,10)}` : ''} ${isAgent ? '(agent)' : '(user)'}`);
  res.json({ order: updated });
});

export default router;
