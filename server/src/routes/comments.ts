import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { authRequired } from "../middleware/auth";

const router = Router();

router.get("/:postId/comments", (req: Request, res: Response): void => {
  const postId = req.params.postId;
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const comments = db
    .prepare(
      `SELECT c.*, u.username, u.avatar_url, u.is_leader
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC
       LIMIT ?`
    )
    .all(postId, limit);

  res.json({ comments });
});

router.post("/:postId/comments", authRequired, (req: Request, res: Response): void => {
  const postId = req.params.postId;
  const userId = req.user!.userId;
  const { content } = req.body;

  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(postId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const id = uuidv4();
  db.prepare("INSERT INTO comments (id, post_id, author_id, content) VALUES (?, ?, ?, ?)").run(
    id, postId, userId, content
  );

  const comment = db
    .prepare(
      `SELECT c.*, u.username, u.avatar_url, u.is_leader
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.id = ?`
    )
    .get(id);

  res.status(201).json({ comment });
});

router.delete("/:postId/comments/:commentId", authRequired, (req: Request, res: Response): void => {
  const commentId = req.params.commentId;
  const userId = req.user!.userId;

  const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(commentId) as Record<string, unknown> | undefined;

  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  if (comment.author_id !== userId) {
    res.status(403).json({ error: "Not your comment" });
    return;
  }

  db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
  res.json({ ok: true });
});

export default router;
