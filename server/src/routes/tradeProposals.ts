import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { authRequired } from "../middleware/auth";

const router = Router();

const AGENT_SECRET = process.env.AGENT_SECRET || "arrow-agent-secret";

// Agent creates a trade proposal ──

router.post("/", (req: Request, res: Response): void => {
  const agentKey = req.headers["x-agent-secret"];
  if (agentKey !== AGENT_SECRET) {
    res.status(403).json({ error: "Invalid agent secret" });
    return;
  }

  const {
    user_address,
    type,
    zero_for_one,
    amount,
    token0,
    token1,
    pool_fee,
    leader_address,
    ai_confidence,
    ai_reason,
    slippage_bps,
    urgency,
  } = req.body;

  if (!user_address || !type || zero_for_one === undefined || !amount) {
    res.status(400).json({ error: "user_address, type, zero_for_one, amount required" });
    return;
  }

  if (!["copy-trade", "limit-order", "ai-suggestion"].includes(type)) {
    res.status(400).json({ error: "type must be copy-trade, limit-order, or ai-suggestion" });
    return;
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO trade_proposals
       (id, user_address, type, zero_for_one, amount, token0, token1, pool_fee,
        leader_address, ai_confidence, ai_reason, slippage_bps, urgency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    user_address.toLowerCase(),
    type,
    zero_for_one ? 1 : 0,
    String(amount),
    token0 || "",
    token1 || "",
    pool_fee || 3000,
    leader_address || "",
    ai_confidence || 0,
    ai_reason || "",
    slippage_bps || 50,
    urgency || "medium"
  );

  const proposal = db.prepare("SELECT * FROM trade_proposals WHERE id = ?").get(id);
  console.log(`[trade-proposal] Created ${type} proposal ${id} for ${user_address}`);
  res.status(201).json({ proposal });
});

router.get("/pending", authRequired, (req: Request, res: Response): void => {
  const userAddress = req.user!.address.toLowerCase();

  const proposals = db.prepare(
    `SELECT * FROM trade_proposals
     WHERE user_address = ? AND status = 'pending'
       AND expires_at > datetime('now')
     ORDER BY created_at DESC
     LIMIT 20`
  ).all(userAddress);

  res.json({ proposals });
});

// user fetches all their proposals

router.get("/", authRequired, (req: Request, res: Response): void => {
  const userAddress = req.user!.address.toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const proposals = db.prepare(
    `SELECT * FROM trade_proposals
     WHERE user_address = ?
     ORDER BY created_at DESC
     LIMIT ?`
  ).all(userAddress, limit);

  res.json({ proposals });
});

// user approves a proposal (marks as approved, frontend will sign + submit tx)

router.patch("/:id/approve", authRequired, (req: Request, res: Response): void => {
  const userAddress = req.user!.address.toLowerCase();
  const proposal = db.prepare("SELECT * FROM trade_proposals WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;

  if (!proposal) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  if ((proposal.user_address as string).toLowerCase() !== userAddress) {
    res.status(403).json({ error: "Not your proposal" });
    return;
  }

  if (proposal.status !== "pending") {
    res.status(400).json({ error: `Proposal already ${proposal.status}` });
    return;
  }

  db.prepare("UPDATE trade_proposals SET status = 'approved' WHERE id = ?").run(req.params.id);

  const updated = db.prepare("SELECT * FROM trade_proposals WHERE id = ?").get(req.params.id);
  res.json({ proposal: updated });
});

router.patch("/:id/executed", authRequired, (req: Request, res: Response): void => {
  const userAddress = req.user!.address.toLowerCase();
  const { tx_hash } = req.body;

  const proposal = db.prepare("SELECT * FROM trade_proposals WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;

  if (!proposal) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  if ((proposal.user_address as string).toLowerCase() !== userAddress) {
    res.status(403).json({ error: "Not your proposal" });
    return;
  }

  db.prepare("UPDATE trade_proposals SET status = 'executed', tx_hash = ? WHERE id = ?").run(
    tx_hash || "",
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM trade_proposals WHERE id = ?").get(req.params.id);
  res.json({ proposal: updated });
});


router.patch("/:id/reject", authRequired, (req: Request, res: Response): void => {
  const userAddress = req.user!.address.toLowerCase();

  const proposal = db.prepare("SELECT * FROM trade_proposals WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;

  if (!proposal) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  if ((proposal.user_address as string).toLowerCase() !== userAddress) {
    res.status(403).json({ error: "Not your proposal" });
    return;
  }

  if (proposal.status !== "pending") {
    res.status(400).json({ error: `Proposal already ${proposal.status}` });
    return;
  }

  db.prepare("UPDATE trade_proposals SET status = 'rejected' WHERE id = ?").run(req.params.id);

  const updated = db.prepare("SELECT * FROM trade_proposals WHERE id = ?").get(req.params.id);
  res.json({ proposal: updated });
});

export default router;
