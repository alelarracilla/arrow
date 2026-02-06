import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { authRequired } from "../middleware/auth";

const router = Router();

// called after tx confirms
router.post("/", authRequired, (req: Request, res: Response): void => {
  const { to_id, amount, tx_hash, message } = req.body;

  if (!to_id || !amount || !tx_hash) {
    res.status(400).json({ error: "to_id, amount, and tx_hash are required" });
    return;
  }

  const recipient = db.prepare("SELECT id FROM users WHERE id = ?").get(to_id);
  if (!recipient) {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }

  const existing = db.prepare("SELECT id FROM tips WHERE tx_hash = ?").get(tx_hash);
  if (existing) {
    res.status(409).json({ error: "Tip already recorded" });
    return;
  }

  const id = uuidv4();
  db.prepare(
    "INSERT INTO tips (id, from_id, to_id, amount, tx_hash, message) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, req.user!.userId, to_id, String(amount), tx_hash, message || "");

  const tip = db.prepare("SELECT * FROM tips WHERE id = ?").get(id);
  res.status(201).json({ tip });
});

router.get("/received/:userId", (req: Request, res: Response): void => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;

  const tips = db
    .prepare(
      `SELECT t.*, u.username as from_username, u.avatar_url as from_avatar
       FROM tips t
       JOIN users u ON t.from_id = u.id
       WHERE t.to_id = ?
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(req.params.userId, limit, offset);

  res.json({ tips });
});

router.get("/sent", authRequired, (req: Request, res: Response): void => {
  const tips = db
    .prepare(
      `SELECT t.*, u.username as to_username, u.avatar_url as to_avatar
       FROM tips t
       JOIN users u ON t.to_id = u.id
       WHERE t.from_id = ?
       ORDER BY t.created_at DESC
       LIMIT 50`
    )
    .all(req.user!.userId);

  res.json({ tips });
});

export default router;
