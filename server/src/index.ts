import "dotenv/config";
import express from "express";
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
  const { event, data, timestamp } = req.body;
  console.log(`[agent-event] ${event}`, JSON.stringify(data).slice(0, 200));
  // In production: persist to DB, push via WebSocket to connected clients
  // For now, just log it
  res.json({ ok: true });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Arrow server running on http://localhost:${PORT}`);
});

export default app;
