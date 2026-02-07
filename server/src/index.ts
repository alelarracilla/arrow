import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

import authRoutes from "./routes/auth";
import postsRoutes from "./routes/posts";
import usersRoutes from "./routes/users";
import tipsRoutes from "./routes/tips";
import ordersRoutes from "./routes/orders";
import tradeProposalsRoutes from "./routes/tradeProposals";
import likesRoutes from "./routes/likes";
import commentsRoutes from "./routes/comments";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Request logging middleware ──
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 400 ? "\x1b[31m" : status >= 300 ? "\x1b[33m" : "\x1b[32m";
    const reset = "\x1b[0m";

    // Skip noisy polling endpoints in logs
    const quiet = originalUrl.includes("/pending") || originalUrl === "/health";
    if (quiet && status < 400) return;

    console.log(`${color}${method} ${originalUrl} ${status}${reset} ${ms}ms`);

    // Log request body for mutations (POST/PATCH/DELETE)
    if (["POST", "PATCH", "DELETE"].includes(method) && req.body && Object.keys(req.body).length > 0) {
      const body = JSON.stringify(req.body).slice(0, 300);
      console.log(`  body: ${body}`);
    }
  });

  next();
});

app.use("/auth", authRoutes);
app.use("/posts", postsRoutes);
app.use("/users", usersRoutes);
app.use("/tips", tipsRoutes);
app.use("/orders", ordersRoutes);
app.use("/trade-proposals", tradeProposalsRoutes);
app.use("/posts", likesRoutes);
app.use("/posts", commentsRoutes);

// Agent events endpoint (receives notifications from the AI agent)
app.post("/agent/events", (req, res) => {
  const { event, data } = req.body;
  console.log(`[agent-event] ${event}`, JSON.stringify(data).slice(0, 200));
  res.json({ ok: true });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Arrow Server v3.0`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Agent Secret: ${process.env.AGENT_SECRET ? "SET (" + process.env.AGENT_SECRET.slice(0, 10) + "...)" : "DEFAULT"}`);
  console.log(`========================================\n`);
});

export default app;
