# Arrow — Deployment

## Architecture

``` diagram
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Vercel    │     │   Railway #1     │     │   Railway #2     │
│   (client)  │────▶│   (server)       │◀────│   (agent)        │
│   React+Vite│     │   Express+SQLite │     │   Node.js daemon │
└─────────────┘     └──────────────────┘     └──────────────────┘
```

- **Client** → Vercel (static site, free)
- **Server** → Railway (persistent Node.js)
- **Agent** → Railway (background worker, we could migrate to aws ec2/lambda later)

---

## Step 1: Deploy Server on Railway

### 1a. Install Railway CLI

```bash
npm i -g @railway/cli
railway login
```

### 1b. Create project + link repo

```bash
# From repo root
railway init
# Name it: arrow
# Select: link to GitHub repo (Ale is the owner)
```

### 1c. Configure Server service

Go to **railway.app dashboard** → your project:

1. Click the service that was created → **Settings**:
   - **Root Directory**: `server`
   - **Build Command**: `npm ci && npx tsc`
   - **Start Command**: `node dist/index.js`

2. **Variables** tab — add:

   ``` bash
   PORT=3001
   JWT_SECRET=<run: openssl rand -hex 32>
   AGENT_SECRET=<pick a shared secret>
   ETH_RPC_URL=https://eth.llamarpc.com
   ```

3. **Networking** tab → **Generate Domain**
   - Note the URL: `https://arrow-server-xxxx.up.railway.app`

4. **Seed the DB** (one-time, via Railway CLI):

   ```bash
   railway run --service server -- npx ts-node src/seed.ts --reset
   ```

   Or just let the server auto-create tables on first boot (schema is in `db.ts`).

---

## Step 2: Deploy Agent on Railway

### 2a. Add second service in same project

Dashboard → **+ New** → **GitHub Repo** → same `arrow` repo.

### 2b. Configure Agent service

1. **Settings**:
   - **Root Directory**: leave **empty** (repo root — agent needs `abis/` folder)
   - **Build Command**: `cd agent && npm ci && npx tsc`
   - **Start Command**: `cd agent && node dist/src/index.js`

2. **Variables** tab — add:

   ``` bash
   AGENT_PRIVATE_KEY=0xa67a...
   ANTHROPIC_API_KEY=sk-ant-...
   BACKEND_URL=https://arrow-server-xxxx.up.railway.app
   AGENT_SECRET=<same as server>
   HOOK_ADDRESS=0x446e60d8EF420c68D1207557Be0BF72fEb7c8040
   ARC_RPC_URL=https://rpc.testnet.arc.network
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   POLL_INTERVAL=12000
   AI_MODEL=claude-sonnet-4-20250514
   ```

3. **No public domain needed** — agent is a background worker that polls the server.

---

## Step 3: Frontend on Vercel (teammate)

Send your teammate these instructions:

### Quick setup

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import the `arrow` GitHub repo
2. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Environment Variables**:

   ``` bash
   VITE_API_URL=https://arrow-server-xxxx.up.railway.app
   VITE_CIRCLE_CLIENT_KEY=TEST_CLIENT_KEY:655551cc82e27aff0940b942588a5cf3:f3400d3552ba31bf5ac9f22c00f534da
   VITE_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
   VITE_TIPPING_ADDRESS=0xDe4b20f3ea6D7C24bbbAa1dfea741b86B3B628da
   ```

4. Deploy → done. Auto-deploys on push to `main`.

---

## Env Vars guide sheet

| Service | Variable | Value |
| --------- | ---------- | ------- |
| Server | `PORT` | `3001` |
| Server | `JWT_SECRET` | `openssl rand -hex 32` |
| Server | `AGENT_SECRET` | shared secret |
| Server | `ETH_RPC_URL` | `https://eth.llamarpc.com` |
| Agent | `AGENT_PRIVATE_KEY` | `0x...` (agent EOA) |
| Agent | `ANTHROPIC_API_KEY` | `sk-ant-...` |
| Agent | `BACKEND_URL` | Railway server URL |
| Agent | `AGENT_SECRET` | same as server |
| Agent | `HOOK_ADDRESS` | `0x446e60d8...8040` |
| Agent | `ARC_RPC_URL` | `https://rpc.testnet.arc.network` |
| Agent | `BASE_SEPOLIA_RPC_URL` | `https://sepolia.base.org` |
| Agent | `POLL_INTERVAL` | `12000` |
| Agent | `AI_MODEL` | `claude-sonnet-4-20250514` |
| Client | `VITE_API_URL` | Railway server URL |
| Client | `VITE_CIRCLE_CLIENT_KEY` | Circle test key |
| Client | `VITE_CIRCLE_CLIENT_URL` | Circle SDK URL |
| Client | `VITE_TIPPING_ADDRESS` | `0xDe4b20f3...28da` |

---

## Verify Deployment

```bash
# 1. Server health
curl https://arrow-server-xxxx.up.railway.app/posts

# 2. Agent logs (Railway dashboard → agent service → Logs)
# Should see:
#   Arrow Agent v4.0 — Cross-Chain
#   Agent address: 0x2618B864...
#   Arc USDC: ...
#   Base Sep USDC: ...

# 3. Frontend
# Open Vercel URL → connect wallet → create order → watch agent execute
```

---

## CORS Note

The server uses `cors()` with no origin restriction (open). I know
we should not be doing this, but for the hackathon this is fine...
Also, if anythin I need the vercel deployment first.
