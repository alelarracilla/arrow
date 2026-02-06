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
  res.status(201).json({ order });
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

// agent updates order status
// this we should enqueue prolly
router.patch("/:id/status", authRequired, (req: Request, res: Response): void => {
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
  res.json({ order: updated });
});

export default router;
