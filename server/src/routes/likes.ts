import { Router, Request, Response } from "express";
import db from "../db";
import { authRequired } from "../middleware/auth";

const router = Router();

router.post("/:postId/like", authRequired, (req: Request, res: Response): void => {
  const postId = req.params.postId;
  const userId = req.user!.userId;

  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(postId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const existing = db.prepare("SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?").get(userId, postId);
  if (existing) {
    res.status(409).json({ error: "Already liked" });
    return;
  }

  db.prepare("INSERT INTO likes (user_id, post_id) VALUES (?, ?)").run(userId, postId);

  const count = (
    db.prepare("SELECT COUNT(*) as count FROM likes WHERE post_id = ?").get(postId) as { count: number }
  ).count;

  res.status(201).json({ ok: true, like_count: count });
});

router.delete("/:postId/like", authRequired, (req: Request, res: Response): void => {
  const postId = req.params.postId;
  const userId = req.user!.userId;

  const result = db.prepare("DELETE FROM likes WHERE user_id = ? AND post_id = ?").run(userId, postId);

  if (result.changes === 0) {
    res.status(404).json({ error: "Like not found" });
    return;
  }

  const count = (
    db.prepare("SELECT COUNT(*) as count FROM likes WHERE post_id = ?").get(postId) as { count: number }
  ).count;

  res.json({ ok: true, like_count: count });
});

export default router;
