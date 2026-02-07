# Arrow TC

A social trading platform built on **Uniswap v4** and **Circle's Arc Testnet**. Users follow top traders, copy their trades via an AI agent, tip creators with native USDC, and place limit orders — all secured by passkey-based smart accounts.

Built for **ETHGlobal HackMoney 2026** targeting **Uniswap v4 Agentic Finance**, **Arc**, **Yellow Network**, and **ENS** bounties.

## Architecture

```text
arrow/
├── client/          React + Vite + TailwindCSS + Circle Modular Wallets SDK
├── server/          Express + SQLite (better-sqlite3) REST API
├── agent/           AI trading agent (Anthropic Claude + viem)
└── contracts/       Solidity (Foundry) — Uniswap v4 hook + tipping
```

### How It Works

```text
┌─────────────────────────────────────────────────────────┐
│                    ARROW FLOW                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Leader posts Idea (pair, side, price)                  │
│        │                                                │
│        ▼                                                │
│  Server stores idea post (post_type = "idea")           │
│        │                                                │
│        ▼                                                │
│  Agent polls /posts/agent/unprocessed-ideas              │
│        │                                                │
│        ▼                                                │
│  AI evaluates idea → decides market or limit order      │
│  (no price = market, with price = limit)                │
│        │                                                │
│        ▼                                                │
│  Agent creates trade proposals for followers            │
│        │                                                │
│        ▼                                                │
│  Client polls /trade-proposals/pending                  │
│  User approves + signs with passkey                     │
│        │                                                │
│        ▼                                                │
│  Circle smart account executes swap on Uniswap v4      │
│                                                         │
│  ─── On-chain path (when hook is deployed) ───          │
│  Leader swaps on Uniswap v4                             │
│        │                                                │
│        ▼                                                │
│  ArrowCopyTradeHook (afterSwap) emits LeaderSwap        │
│        │                                                │
│        ▼                                                │
│  Agent watches events → same AI evaluation flow         │
└─────────────────────────────────────────────────────────┘
```

Tips flow directly: user signs a `tip()` call on `ArrowTipping` via their Circle smart account. Native USDC is sent to the creator minus a configurable platform fee.

## Tech Stack

| Layer | Technology |
| ------- | ----------- |
| **Chain** | Arc Testnet (chain ID `5042002`, native USDC 18 decimals) |
| **DEX** | Uniswap v4 (afterSwap hook for copy-trading + limit orders) |
| **Wallets** | Circle Modular Wallets SDK (passkey auth, ERC-4337 smart accounts) |
| **Frontend** | React 18, Vite, TailwindCSS, viem |
| **Backend** | Express, SQLite (WAL mode), JWT auth |
| **Agent** | Anthropic Claude, viem, polling-based |
| **Contracts** | Solidity 0.8.26, Foundry, OpenZeppelin |

## Quick Start

### Prerequisites

- Node.js 18+
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for contracts)
- A Circle developer account (for Modular Wallets SDK keys)

### 1. Clone and install

```bash
git clone https://github.com/alelarracilla/arrow.git
cd arrow
npm install
```

### 2. Environment variables

Copy the example env files and fill in your values:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
cp agent/.env.example agent/.env
cp contracts/.env.example contracts/.env
```

**Client** (`client/.env`):

```env
VITE_CIRCLE_CLIENT_KEY=<your Circle client key>
VITE_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
VITE_API_URL=http://localhost:3001
VITE_TIPPING_ADDRESS=<deployed ArrowTipping address>
VITE_HOOK_ADDRESS=<deployed ArrowCopyTradeHook address>
VITE_SWAP_ROUTER_ADDRESS=<swap router address>
```

**Server** (`server/.env`):

```env
PORT=3001
JWT_SECRET=<random secret>
AGENT_SECRET=arrow-agent-secret
```

**Agent** (`agent/.env`):

```env
ARC_RPC_URL=https://rpc.testnet.arc.network
HOOK_ADDRESS=<deployed hook address>
TIPPING_ADDRESS=<deployed tipping address>
SWAP_ROUTER_ADDRESS=<swap router address>
AGENT_PRIVATE_KEY=<agent EOA private key>
ANTHROPIC_API_KEY=<your Anthropic API key>
AI_MODEL=claude-sonnet-4-20250514
POLL_INTERVAL=12000
BACKEND_URL=http://localhost:3001
AGENT_SECRET=arrow-agent-secret
```

**Contracts** (`contracts/.env`):

```env
PRIVATE_KEY=<deployer EOA private key>
FEE_RECIPIENT=<address to receive platform fees>
FEE_BPS=100
POOL_MANAGER=<Uniswap v4 PoolManager address>
AGENT_ADDRESS=<agent EOA address>
```

### 3. Run everything

```bash
npm run dev
```

This starts the server (port 3001), client (port 5173), and agent concurrently.

Or run individually:

```bash
npm run dev:server    # Express API
npm run dev:client    # Vite dev server
npm run dev:agent     # AI trading agent
```

## Contracts

### ArrowTipping (`contracts/src/ArrowTipping.sol`)

Tip creators with native USDC on Arc. Supports a configurable platform fee (max 5%).

- `tip(address to, string message)` — send USDC tip (payable, native currency)
- `setFee(uint256 feeBps)` — owner sets fee (max 500 bps)
- `setFeeRecipient(address)` — owner sets fee recipient
- Tracks `totalTipsReceived`, `totalTipsSent`, `uniqueTipperCount` per address
- Emits `Tip(from, to, amount, fee, message, timestamp)`

### ArrowCopyTradeHook (`contracts/src/ArrowCopyTradeHook.sol`)

Uniswap v4 `afterSwap` hook for copy-trading and limit orders.

- **Leaders** register and trade normally; the hook logs their swaps
- **Followers** follow a leader; the off-chain agent relays trades as proposals
- **Limit orders** are placed on-chain; the agent monitors and proposes execution
- `registerAsLeader()` / `followLeader(address)` / `unfollowLeader()`
- `placeLimitOrder(PoolKey, bool, int256, uint160)` — user places limit order
- `markLimitOrderExecuted(uint256 orderId)` — agent-only, marks order done
- Emits `LeaderSwap`, `LimitOrderCreated`, `LimitOrderExecuted`

### Deploying

**ArrowTipping** (no Uniswap dependency — deploy to Arc testnet directly):

```bash
cd contracts
source .env
forge script script/DeployArrow.s.sol --rpc-url arc_testnet --broadcast
```

**ArrowCopyTradeHook** (requires Uniswap v4 PoolManager on the target chain):

```bash
cd contracts
source .env
forge script script/DeployHook.s.sol --rpc-url arc_testnet --broadcast
```

> **Note:** Uniswap v4 is not yet officially deployed on Arc Testnet. The hook deployment requires a PoolManager address. When available, set `POOL_MANAGER` in your `.env`.

### Testing

```bash
cd contracts
forge test -vv              # unit tests
forge test -vvvv            # full execution traces
forge test --gas-report     # gas costs per function
```

## Server API

Base URL: `http://localhost:3001`

### Auth

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/auth/wallet` | — | Authenticate with wallet address, returns JWT. Auto-creates user if new. |
| GET | `/auth/me` | JWT | Get current user profile with follower/following counts |
| PATCH | `/auth/me` | JWT | Update profile (`username`, `bio`, `avatar_url`, `ens_name`) |

### Users

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/users` | — | Leaderboard (top users by follower count). `?limit=20` |
| GET | `/users/:id` | Optional | User profile + stats (`follower_count`, `following_count`, `post_count`, `total_tips_received`, `is_following`) |
| GET | `/users/address/:address` | — | Lookup user by wallet address |
| POST | `/users/:id/follow` | JWT | Follow a user |
| DELETE | `/users/:id/follow` | JWT | Unfollow a user |
| GET | `/users/:id/followers` | — | List followers |
| GET | `/users/:id/following` | — | List following |

### Posts

Two types: **Post** (simple text) and **Idea** (trade idea with pair/side/price).

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/posts` | Optional | Feed (newest first). `?limit=20&offset=0` |
| GET | `/posts/:id` | Optional | Single post with enriched data |
| POST | `/posts` | JWT | Create post or idea (see body below) |
| DELETE | `/posts/:id` | JWT | Delete own post |
| GET | `/posts/user/:userId` | Optional | Posts by a specific user |
| GET | `/posts/feed/following` | JWT | Posts from users you follow |

**Create Post body:**

```json
{
  "content": "string (required)",
  "post_type": "post | idea",
  "visibility": "everyone | community",
  "image_url": "string (optional)",
  "pair": "ETH/USDC (required for ideas)",
  "pair_address_0": "0x... (optional)",
  "pair_address_1": "0x... (optional)",
  "pool_fee": 3000,
  "side": "buy | sell (required for ideas)",
  "price": "68500 (optional — empty = market order, set = limit order)"
}
```

- `visibility: "everyone"` → public post (`is_premium = 0`)
- `visibility: "community"` → premium/followers-only (`is_premium = 1`)
- Ideas without `price` → agent creates **market order** proposals
- Ideas with `price` → agent creates **limit order** proposals

Response includes: `like_count`, `comment_count`, `author_tip_count`, `is_liked`, `post_type`, `side`, `price`.

### Posts — Agent Endpoints

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/posts/agent/unprocessed-ideas` | `x-agent-secret` | Fetch idea posts not yet processed by the agent |
| POST | `/posts/agent/mark-processed` | `x-agent-secret` | Mark an idea as processed. Body: `{ "post_id": "..." }` |

### Likes & Comments

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/posts/:postId/like` | JWT | Like a post. Returns `like_count`. |
| DELETE | `/posts/:postId/like` | JWT | Unlike a post. Returns `like_count`. |
| GET | `/posts/:postId/comments` | — | List comments (with author info). `?limit=20` |
| POST | `/posts/:postId/comments` | JWT | Add comment. Body: `{ "content": "..." }` |
| DELETE | `/posts/:postId/comments/:id` | JWT | Delete own comment |

### Tips

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/tips` | JWT | Record a tip after on-chain tx. Body: `{ "to_id", "amount", "tx_hash", "message" }` |
| GET | `/tips/received/:userId` | — | Tips received by user. `?limit=20&offset=0` |
| GET | `/tips/sent` | JWT | Tips sent by current user |

### Orders

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/orders` | JWT | Record a limit order. Body: `{ "pool_key_hash", "zero_for_one", "amount", "trigger_price", "post_id?", "on_chain_order_id?" }` |
| GET | `/orders` | JWT | List your orders. `?status=pending&limit=20` |
| PATCH | `/orders/:id/status` | JWT | Update order status. Body: `{ "status": "pending\|executed\|cancelled\|failed", "tx_hash?" }` |

### Trade Proposals

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/trade-proposals` | `x-agent-secret` | Agent creates proposal. Body: `{ "user_address", "type", "zero_for_one", "amount", "token0?", "token1?", "pool_fee?", "leader_address?", "ai_confidence", "ai_reason", "slippage_bps?", "urgency?" }` |
| GET | `/trade-proposals/pending` | JWT | User's pending proposals (not expired) |
| GET | `/trade-proposals` | JWT | User's full proposal history. `?limit=20` |
| PATCH | `/trade-proposals/:id/approve` | JWT | Approve a pending proposal |
| PATCH | `/trade-proposals/:id/reject` | JWT | Reject a pending proposal |
| PATCH | `/trade-proposals/:id/executed` | JWT | Confirm on-chain execution. Body: `{ "tx_hash" }` |

Proposal types: `copy-trade`, `limit-order`, `ai-suggestion`.

### Agent Events

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/agent/events` | — | Agent notifies backend of events (order executions, etc.) |

## Agent

The AI agent (`agent/`) processes trade ideas and on-chain events:

1. **Processes Idea posts** — polls `/posts/agent/unprocessed-ideas`, evaluates with Claude AI, creates trade proposals
2. **Watches `LeaderSwap` events** from the ArrowCopyTradeHook contract (when deployed)
3. **Evaluates with AI** — considers leader track record, trade size, market conditions
4. **Creates trade proposals** for followers (market or limit based on idea price)
5. **Monitors limit orders** — checks trigger prices, proposes execution
6. **Marks executed orders** on-chain after user approval

The agent **never holds user private keys**. Users approve and sign all transactions locally with their Circle passkey.

### Idea → Trade Proposal Flow

```text
Idea post (post_type="idea", pair="ETH/USDC", side="buy", price="")
  → Agent fetches from /posts/agent/unprocessed-ideas
  → AI analyzes: confidence, suggested amount, slippage
  → No price? → market order proposal (type="ai-suggestion")
  → Has price? → limit order proposal (type="limit-order")
  → Proposal created for each follower
  → Agent marks idea as processed
```

### Agent AI Decision Format

```json
{
  "action": "execute | skip | wait",
  "reason": "brief explanation",
  "confidence": 0.0-1.0,
  "order_type": "market | limit",
  "suggested_amount": "10",
  "suggested_slippage_bps": 50,
  "adjustments": {
    "slippage_bps": 50,
    "urgency": "high | medium | low"
  }
}
```

Proposals are only created when `action === "execute"` and `confidence >= 0.5`.

## Key Design Decisions

- **Native USDC**: Arc Testnet uses USDC as the native currency (18 decimals). Tips and gas are paid in USDC via `msg.value`.
- **Passkey auth**: No seed phrases. Users authenticate with device biometrics via Circle Modular Wallets SDK.
- **Smart accounts**: All user wallets are ERC-4337 smart accounts. Transactions are sent as UserOperations via the bundler client.
- **Agent proposals**: The agent never executes trades directly. It proposes, the user approves, and the user's smart account executes. This keeps the user in full control.
- **Dual post types**: Regular posts for social content; Idea posts for actionable trade signals that the AI agent processes.
- **SQLite**: Lightweight, zero-config database. WAL mode for concurrent reads. Good enough for a hackathon; swap for Postgres in production.

## Network Details

| Property | Value |
| -------- | ----- |
| **Chain** | Arc Testnet |
| **Chain ID** | `5042002` |
| **RPC** | `https://rpc.testnet.arc.network` |
| **Explorer** | `https://testnet.arcscan.app` |
| **Native Currency** | USDC (18 decimals) |
| **Faucet** | [Arc Testnet Faucet](https://faucet.arc.network) |

## Deployed Contracts (Arc Testnet)

| Contract | Address |
| -------- | ------- |
| **ArrowTipping** | `0xDe4b20f3ea6D7C24bbbAa1dfea741b86B3B628da` |
| **ArrowCopyTradeHook** | Pending (requires PoolManager with Cancun EVM support) |
| **PoolManager** | Pending (Uniswap v4 uses EIP-1153 transient storage) |
