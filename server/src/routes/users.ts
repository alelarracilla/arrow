import { Router, Request, Response } from "express";
import db from "../db";
import { authRequired } from "../middleware/auth";

const router = Router();

router.get("/:id", (req: Request, res: Response): void => {
  const user = db
    .prepare("SELECT id, address, username, bio, avatar_url, is_leader, created_at FROM users WHERE id = ?")
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

  res.json({
    user: {
      ...user,
      follower_count: followerCount,
      following_count: followingCount,
      post_count: postCount,
      total_tips_received: totalTips,
    },
  });
});

router.get("/address/:address", (req: Request, res: Response): void => {
  const normalized = (req.params.address as string).toLowerCase();
  const user = db
    .prepare("SELECT id, address, username, bio, avatar_url, is_leader, created_at FROM users WHERE address = ?")
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
