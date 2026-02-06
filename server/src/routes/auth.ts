import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db";
import { signToken, authRequired } from "../middleware/auth";

const router = Router();

// POST /auth/wallet — authenticate with wallet address
// Circle smart accounts don't have private keys to sign messages,
// so we authenticate by address (passkey auth happens client-side via Circle SDK)
// if we really wanted to optimized this we should store them in binary format
// or something like that, but for now this is good enough
router.post("/wallet", (req: Request, res: Response): void => {
  const { address, username } = req.body;

  if (!address || typeof address !== "string") {
    res.status(400).json({ error: "address is required" });
    return;
  }

  const normalized = address.toLowerCase();

  let user = db
    .prepare("SELECT * FROM users WHERE address = ?")
    .get(normalized) as Record<string, unknown> | undefined;

  if (!user) {
    const id = uuidv4();
    const name = username || `user_${normalized.slice(2, 8)}`;

    db.prepare(
      "INSERT INTO users (id, address, username) VALUES (?, ?, ?)"
    ).run(id, normalized, name);

    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown>;
  }

  const token = signToken({
    userId: user!.id as string,
    address: normalized,
  });

  res.json({
    token,
    user: {
      id: user!.id,
      address: user!.address,
      username: user!.username,
      bio: user!.bio,
      avatar_url: user!.avatar_url,
      ens_name: user!.ens_name,
      is_leader: user!.is_leader,
    },
  });
});

router.get("/me", authRequired, (req: Request, res: Response): void => {
  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(req.user!.userId) as Record<string, unknown> | undefined;

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

  res.json({
    user: {
      id: user.id,
      address: user.address,
      username: user.username,
      bio: user.bio,
      avatar_url: user.avatar_url,
      ens_name: user.ens_name,
      is_leader: user.is_leader,
      follower_count: followerCount,
      following_count: followingCount,
    },
  });
});

router.patch("/me", authRequired, (req: Request, res: Response): void => {
  const { username, bio, avatar_url, ens_name } = req.body;
  const userId = req.user!.userId;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (username !== undefined) {
    fields.push("username = ?");
    values.push(username);
  }
  if (bio !== undefined) {
    fields.push("bio = ?");
    values.push(bio);
  }
  if (avatar_url !== undefined) {
    fields.push("avatar_url = ?");
    values.push(avatar_url);
  }
  if (ens_name !== undefined) {
    fields.push("ens_name = ?");
    values.push(ens_name);
  }

  if (fields.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  values.push(userId);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as Record<string, unknown>;

  res.json({ user });
});

export default router;
