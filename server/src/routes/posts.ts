import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { authRequired } from "../middleware/auth";

const router = Router();

// GET /posts — feed (all posts, newest first)
// this should be paginated, wont due to time (prolly)
router.get("/", (req: Request, res: Response): void => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;

  const posts = db
    .prepare(
      `SELECT p.*, u.username, u.address, u.avatar_url, u.is_leader
       FROM posts p
       JOIN users u ON p.author_id = u.id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Record<string, unknown>[];

  // Attach tip count :3
  const enriched = posts.map((p) => {
    const tipCount = (
      db
        .prepare("SELECT COUNT(*) as count FROM tips WHERE to_id = ?")
        .get(p.author_id as string) as { count: number }
    ).count;

    return { ...p, author_tip_count: tipCount };
  });

  res.json({ posts: enriched });
});

// GET /posts/:id
router.get("/:id", (req: Request, res: Response): void => {
  const post = db
    .prepare(
      `SELECT p.*, u.username, u.address, u.avatar_url, u.is_leader
       FROM posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.id = ?`
    )
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json({ post });
});

// POST /posts — create a post (with optional pair metadata for "Set Order")
// dunno if we will be able to ship metadata before deadline, looking back at 
// this later
router.post("/", authRequired, (req: Request, res: Response): void => {
  const {
    content,
    image_url,
    pair,
    pair_address_0,
    pair_address_1,
    pool_fee,
    is_premium,
  } = req.body;

  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const id = uuidv4();

  db.prepare(
    `INSERT INTO posts (id, author_id, content, image_url, pair, pair_address_0, pair_address_1, pool_fee, is_premium)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user!.userId,
    content,
    image_url || "",
    pair || "",
    pair_address_0 || "",
    pair_address_1 || "",
    pool_fee || 3000,
    is_premium ? 1 : 0
  );

  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(id);
  res.status(201).json({ post });
});

// DELETE /posts/:id
router.delete("/:id", authRequired, (req: Request, res: Response): void => {
  const post = db
    .prepare("SELECT * FROM posts WHERE id = ?")
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  if (post.author_id !== req.user!.userId) {
    res.status(403).json({ error: "Not your post" });
    return;
  }

  db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// GET /posts/user/:userId — posts by a specific user
router.get("/user/:userId", (req: Request, res: Response): void => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;

  const posts = db
    .prepare(
      `SELECT p.*, u.username, u.address, u.avatar_url, u.is_leader
       FROM posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.author_id = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(req.params.userId, limit, offset);

  res.json({ posts });
});

// GET /posts/feed/following — posts from users I follow
router.get("/feed/following", authRequired, (req: Request, res: Response): void => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;

  const posts = db
    .prepare(
      `SELECT p.*, u.username, u.address, u.avatar_url, u.is_leader
       FROM posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.author_id IN (
         SELECT leader_id FROM follows WHERE follower_id = ?
       )
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(req.user!.userId, limit, offset);

  res.json({ posts });
});

export default router;
