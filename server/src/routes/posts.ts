import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { authRequired } from "../middleware/auth";

const router = Router();

function getRequestingUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const jwt = require("jsonwebtoken");
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || "arrow-dev-secret");
    return payload.userId || null;
  } catch {
    return null;
  }
}

function enrichPosts(posts: Record<string, unknown>[], requestingUserId: string | null) {
  return posts.map((p) => {
    const likeCount = (
      db.prepare("SELECT COUNT(*) as count FROM likes WHERE post_id = ?").get(p.id as string) as { count: number }
    ).count;

    const commentCount = (
      db.prepare("SELECT COUNT(*) as count FROM comments WHERE post_id = ?").get(p.id as string) as { count: number }
    ).count;

    const tipCount = (
      db.prepare("SELECT COUNT(*) as count FROM tips WHERE to_id = ?").get(p.author_id as string) as { count: number }
    ).count;

    let isLiked = false;
    if (requestingUserId) {
      isLiked = !!db.prepare("SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?").get(requestingUserId, p.id as string);
    }

    return { ...p, like_count: likeCount, comment_count: commentCount, author_tip_count: tipCount, is_liked: isLiked };
  });
}

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

  res.json({ posts: enrichPosts(posts, getRequestingUserId(req)) });
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

  const [enriched] = enrichPosts([post], getRequestingUserId(req));
  res.json({ post: enriched });
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
    .all(req.params.userId, limit, offset) as Record<string, unknown>[];

  res.json({ posts: enrichPosts(posts, getRequestingUserId(req)) });
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
    .all(req.user!.userId, limit, offset) as Record<string, unknown>[];

  res.json({ posts: enrichPosts(posts, req.user!.userId) });
});

export default router;
