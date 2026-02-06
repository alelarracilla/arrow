# Arrow TC

A social trading platform built on **Uniswap v4** and **Circle's Arc Testnet**. Users follow top traders, copy their trades via an AI agent, tip creators with native USDC, and place limit orders — all secured by passkey-based smart accounts.

Built for **ETHGlobal 2026** targeting Uniswap v4, Circle/Arc, and ENS bounties.

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
Leader swaps on Uniswap v4
        │
        ▼
ArrowCopyTradeHook (afterSwap) emits LeaderSwap event
        │
        ▼
Agent watches events → evaluates with Claude AI
        │
        ▼
Agent POSTs trade proposal to server (pending approval)
        │
        ▼
Client polls proposals → user approves + signs with passkey
        │
        ▼
Circle smart account executes swap on Uniswap v4
```

Tips flow directly: user signs a `tip()` call on `ArrowTipping` via their Circle smart account. Native USDC is sent to the creator minus a configurable platform fee.

## Tech Stack

| Layer | Technology |
| ------- | ----------- |
| **Chain** | Arc Testnet (chain ID `5042002`, native USDC 18 decimals) |
| **DEX** | Uniswap v4 (afterSwap hook) |
| **Wallets** | Circle Modular Wallets SDK (passkey auth, smart accounts) |
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
forge script script/DeployTipping.s.sol --rpc-url arc_testnet --broadcast
```

**ArrowCopyTradeHook** (requires Uniswap v4 PoolManager on the target chain):

```bash
cd contracts
source .env
forge script script/DeployArrow.s.sol --rpc-url arc_testnet --broadcast
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
|--------|----------|------|-------------|
| POST | `/auth/wallet` | — | Authenticate with wallet address, returns JWT |
| GET | `/auth/me` | JWT | Get current user profile |
| PATCH | `/auth/me` | JWT | Update profile (username, bio, avatar_url, ens_name) |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | — | Leaderboard (top by follower count) |
| GET | `/users/:id` | Optional | User profile + stats + `is_following` |
| GET | `/users/address/:address` | — | Lookup user by wallet address |
| POST | `/users/:id/follow` | JWT | Follow a user |
| DELETE | `/users/:id/follow` | JWT | Unfollow a user |
| GET | `/users/:id/followers` | — | List followers |
| GET | `/users/:id/following` | — | List following |

### Posts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/posts` | Optional | Feed (all posts, newest first) |
| GET | `/posts/:id` | Optional | Single post |
| POST | `/posts` | JWT | Create post |
| DELETE | `/posts/:id` | JWT | Delete own post |
| GET | `/posts/user/:userId` | Optional | Posts by user |
| GET | `/posts/feed/following` | JWT | Posts from followed users |

Posts include `like_count`, `comment_count`, `is_liked` (when authenticated).

### Likes & Comments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/posts/:postId/like` | JWT | Like a post |
| DELETE | `/posts/:postId/like` | JWT | Unlike a post |
| GET | `/posts/:postId/comments` | — | List comments |
| POST | `/posts/:postId/comments` | JWT | Add comment |
| DELETE | `/posts/:postId/comments/:id` | JWT | Delete own comment |

### Tips

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/tips` | JWT | Record a tip (after on-chain tx) |
| GET | `/tips/received/:userId` | — | Tips received by user |
| GET | `/tips/sent` | JWT | Tips sent by current user |

### Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | JWT | Record a limit order |
| GET | `/orders` | — | List orders (filterable by user_id, status) |

### Trade Proposals

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/trade-proposals` | Agent secret | Agent creates proposal |
| GET | `/trade-proposals/pending` | JWT | User's pending proposals |
| GET | `/trade-proposals` | JWT | User's proposal history |
| PATCH | `/trade-proposals/:id/approve` | JWT | Approve proposal |
| PATCH | `/trade-proposals/:id/reject` | JWT | Reject proposal |
| PATCH | `/trade-proposals/:id/executed` | JWT | Confirm on-chain execution |

## Agent

The AI agent (`agent/`) monitors on-chain events and creates trade proposals:

1. **Watches `LeaderSwap` events** from the ArrowCopyTradeHook contract
2. **Evaluates trades with Claude AI** — considers leader track record, trade size, market conditions
3. **Creates trade proposals** in the backend for each follower
4. **Monitors limit orders** — checks if trigger prices are met, proposes execution
5. **Marks executed orders** on-chain after user approval

The agent never holds user private keys. Users approve and sign all transactions locally with their Circle passkey.

### Agent AI Decision Format

```json
{
  "action": "execute | skip | wait",
  "reason": "brief explanation",
  "confidence": 0.0-1.0,
  "adjustments": {
    "slippage_bps": 50,
    "urgency": "high | medium | low"
  }
}
```

Proposals are only created when `action === "execute"` and `confidence >= 0.6`.

## Key Design Decisions

- **Native USDC**: Arc Testnet uses USDC as the native currency (18 decimals). Tips and gas are paid in USDC via `msg.value`.
- **Passkey auth**: No seed phrases. Users authenticate with device biometrics via Circle Modular Wallets SDK.
- **Smart accounts**: All user wallets are ERC-4337 smart accounts. Transactions are sent as UserOperations via the bundler client.
- **Agent proposals**: The agent never executes trades directly. It proposes, the user approves, and the user's smart account executes. This keeps the user in full control.
- **SQLite**: Lightweight, zero-config database. WAL mode for concurrent reads. Good enough for a hackathon; swap for Postgres in production.

## Network Details

| Property | Value |
|----------|-------|
| **Chain** | Arc Testnet |
| **Chain ID** | `5042002` |
| **RPC** | `https://rpc.testnet.arc.network` |
| **Explorer** | `https://testnet.arcscan.app` |
| **Native Currency** | USDC (18 decimals) |
| **Faucet** | [Arc Testnet Faucet](https://faucet.arc.network) |

## Deployed Contracts (Arc Testnet)

| Contract | Address |
|----------|--------|
| **ArrowTipping** | `0xDe4b20f3ea6D7C24bbbAa1dfea741b86B3B628da` |
| **ArrowCopyTradeHook** | Pending (requires PoolManager with cancun EVM support) |
| **PoolManager** | Pending (Uniswap v4 uses EIP-1153 transient storage) |
