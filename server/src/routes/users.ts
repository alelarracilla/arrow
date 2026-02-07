import { Router, Request, Response } from "express";
import db from "../db";
import { authRequired } from "../middleware/auth";
import { resolveEns, resolveEnsAddress } from "../ens";

const router = Router();

// POST /users/:id/resolve-ens — trigger on-chain ENS resolution for a user
router.post("/:id/resolve-ens", authRequired, async (req: Request, res: Response): Promise<void> => {
  const user = db
    .prepare("SELECT id, address FROM users WHERE id = ?")
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const ens = await resolveEns(user.address as string);

  if (ens.name || ens.avatar) {
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (ens.name) { updates.push("ens_name = ?"); vals.push(ens.name); }
    if (ens.avatar) { updates.push("avatar_url = ?"); vals.push(ens.avatar); }
    vals.push(user.id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
  }

  res.json({ ens_name: ens.name, avatar: ens.avatar });
});

// GET /users/ens/:name — look up user by ENS name (checks DB first, then on-chain)
router.get("/ens/:name", async (req: Request, res: Response): Promise<void> => {
  const ensName = req.params.name;

  // Check DB first
  const existing = db
    .prepare("SELECT id, address, username, bio, avatar_url, ens_name, is_leader FROM users WHERE ens_name = ?")
    .get(ensName) as Record<string, unknown> | undefined;

  if (existing) {
    res.json({ user: existing });
    return;
  }

  // Resolve on-chain: ENS name → address → check if user exists
  const address = await resolveEnsAddress(ensName as string);

  if (!address) {
    res.status(404).json({ error: "ENS name not found on-chain" });
    return;
  }

  const user = db
    .prepare("SELECT id, address, username, bio, avatar_url, ens_name, is_leader FROM users WHERE address = ?")
    .get(address.toLowerCase()) as Record<string, unknown> | undefined;

  if (!user) {
    res.status(404).json({ error: "No Arrow user with this ENS address" });
    return;
  }

  // Update their ENS name in DB if not set
  if (!user.ens_name) {
    db.prepare("UPDATE users SET ens_name = ? WHERE id = ?").run(ensName, user.id);
    user.ens_name = ensName;
  }

  res.json({ user });
});

router.get("/:id", (req: Request, res: Response): void => {
  const user = db
    .prepare("SELECT id, address, username, bio, avatar_url, ens_name, is_leader, created_at FROM users WHERE id = ?")
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const followerCount = (
    db.prepare("SELECT COUNT(*) as count FROM follows WHERE leader_id = ?").get(user.id as string) as { count: number }
  ).count;

  const followingCount = (
    db.prepare("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?").get(user.id as string) as { count: number }
  ).count;

  const postCount = (
    db.prepare("SELECT COUNT(*) as count FROM posts WHERE author_id = ?").get(user.id as string) as { count: number }
  ).count;

  const totalTips = (
    db.prepare("SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) as total FROM tips WHERE to_id = ?").get(user.id as string) as { total: number }
  ).total;

  let isFollowing = false;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const jwt = require("jsonwebtoken");
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || "arrow-dev-secret");
      if (payload.userId && payload.userId !== user.id) {
        const row = db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND leader_id = ?").get(payload.userId, user.id as string);
        isFollowing = !!row;
      }
    } catch {
    }
  }

  res.json({
    user: {
      ...user,
      follower_count: followerCount,
      following_count: followingCount,
      post_count: postCount,
      total_tips_received: totalTips,
      is_following: isFollowing,
    },
  });
});

router.get("/address/:address", (req: Request, res: Response): void => {
  const normalized = (req.params.address as string).toLowerCase();
  const user = db
    .prepare("SELECT id, address, username, bio, avatar_url, ens_name, is_leader, created_at FROM users WHERE address = ?")
    .get(normalized) as Record<string, unknown> | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

router.post("/:id/follow", authRequired, (req: Request, res: Response): void => {
  const leaderId = req.params.id;
  const followerId = req.user!.userId;

  if (leaderId === followerId) {
    res.status(400).json({ error: "Cannot follow yourself" });
    return;
  }

  const leader = db.prepare("SELECT id FROM users WHERE id = ?").get(leaderId);
  if (!leader) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const existing = db
    .prepare("SELECT 1 FROM follows WHERE follower_id = ? AND leader_id = ?")
    .get(followerId, leaderId);

  if (existing) {
    res.status(409).json({ error: "Already following" });
    return;
  }

  db.prepare("INSERT INTO follows (follower_id, leader_id) VALUES (?, ?)").run(followerId, leaderId);
  res.status(201).json({ ok: true });
});

router.delete("/:id/follow", authRequired, (req: Request, res: Response): void => {
  const leaderId = req.params.id;
  const followerId = req.user!.userId;

  const result = db
    .prepare("DELETE FROM follows WHERE follower_id = ? AND leader_id = ?")
    .run(followerId, leaderId);

  if (result.changes === 0) {
    res.status(404).json({ error: "Not following this user" });
    return;
  }

  res.json({ ok: true });
});

// this should be paginated
router.get("/:id/followers", (req: Request, res: Response): void => {
  const followers = db
    .prepare(
      `SELECT u.id, u.address, u.username, u.avatar_url, u.is_leader
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.leader_id = ?
       ORDER BY f.created_at DESC`
    )
    .all(req.params.id);

  res.json({ followers });
});

// this should be paginated
router.get("/:id/following", (req: Request, res: Response): void => {
  const following = db
    .prepare(
      `SELECT u.id, u.address, u.username, u.avatar_url, u.is_leader
       FROM follows f
       JOIN users u ON f.leader_id = u.id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC`
    )
    .all(req.params.id);

  res.json({ following });
});


// GET /users — leaderboard (top leaders by follower count)
router.get("/", (req: Request, res: Response): void => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const leaders = db
    .prepare(
      `SELECT u.id, u.address, u.username, u.avatar_url, u.is_leader,
              COUNT(f.follower_id) as follower_count
       FROM users u
       LEFT JOIN follows f ON u.id = f.leader_id
       GROUP BY u.id
       ORDER BY follower_count DESC
       LIMIT ?`
    )
    .all(limit);

  res.json({ users: leaders });
});

export default router;
