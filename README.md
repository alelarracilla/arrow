# Arrow TC

A social trading platform built on **Circle's Arc Testnet** with cross-chain swaps on **Uniswap v4** via **CCTP**. Users follow top traders, copy their trades via an AI agent, tip creators with native USDC, and place limit orders — all secured by passkey-based smart accounts.

Built for **ETHGlobal HackMoney 2026** targeting **Uniswap v4 Agentic Finance**, **Arc**, **Yellow Network**, and **ENS** bounties.

## Architecture

```text
arrow/
├── client/          React + Vite + TailwindCSS + Circle Modular Wallets SDK
├── server/          Express + SQLite (better-sqlite3) REST API
├── agent/           AI trading agent (Anthropic Claude + viem + CCTP bridge)
└── contracts/       Solidity (Foundry) — Uniswap v4 hook + tipping
```

### Cross-Chain Swap Flow

```text
┌──────────────────────────────────────────────────────────────┐
│                  ARC TESTNET (home chain)                     │
│  User holds USDC · Circle smart account · passkey auth       │
│                                                              │
│  1. Leader posts Idea (pair, side, price)                    │
│  2. Agent evaluates via AI → creates trade proposal          │
│  3. User approves proposal with passkey                      │
│          │                                                   │
│          ▼                                                   │
│  4. Approve USDC → CCTP TokenMessengerV2.depositForBurn()    │
│     Burns USDC on Arc (domain 26)                            │
└──────────┬───────────────────────────────────────────────────┘
           │  CCTP attestation (~0.5s from Arc)
           ▼
┌──────────────────────────────────────────────────────────────┐
│                BASE SEPOLIA (swap chain)                      │
│  Uniswap v4 PoolManager · PoolSwapTest · Permit2            │
│                                                              │
│  5. MessageTransmitterV2.receiveMessage() → mints USDC      │
│  6. Approve USDC → PoolSwapTest.swap() on Uniswap v4        │
│          │                                                   │
│          ▼                                                   │
│  7. CCTP bridge output back to Arc                           │
└──────────┬───────────────────────────────────────────────────┘
           │  CCTP attestation
           ▼
┌──────────────────────────────────────────────────────────────┐
│                  ARC TESTNET (home chain)                     │
│  8. Mint swapped tokens on Arc → user's smart account        │
└──────────────────────────────────────────────────────────────┘
```

### Key Addresses

| Contract | Arc Testnet | Base Sepolia |
| --- | --- | --- |
| **USDC** | `0x3600...0000` | `0x036CbD...3dCF7e` |
| **TokenMessengerV2** | `0x8FE6B9...42DAA` | `0x8FE6B9...42DAA` |
| **MessageTransmitterV2** | `0xE737e5...CE275` | `0xE737e5...CE275` |
| **CCTP Domain** | 26 | 6 |
| **PoolManager** | — | `0x05E733...03408` |
| **PoolSwapTest** | — | `0x8b5bcc...3b9` |
| **Permit2** | `0x00002...8BA3` | `0x00002...8BA3` |

Tips flow directly on Arc: user signs a `tip()` call on `ArrowTipping` via their Circle smart account. Native USDC is sent to the creator minus a configurable platform fee.

## Tech Stack

| Layer | Technology |
| ------- | ----------- |
| **Home Chain** | Arc Testnet (chain ID `5042002`, native USDC 18 decimals) |
| **Swap Chain** | Base Sepolia (chain ID `84532`, Uniswap v4 deployed) |
| **Bridge** | Circle CCTP v2 (burn/mint, ~0.5s attestation from Arc) |
| **DEX** | Uniswap v4 on Base Sepolia (PoolSwapTest for swaps) |
| **Wallets** | Circle Modular Wallets SDK (passkey auth, ERC-4337 smart accounts) |
| **Frontend** | React 19, Vite, TailwindCSS, viem |
| **Backend** | Express, SQLite (WAL mode), JWT auth |
| **Agent** | Anthropic Claude, viem, CCTP bridge, polling-based |
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
| GET | `/users/ens/:name` | — | Lookup user by ENS name (checks DB, then resolves on-chain) |
| POST | `/users/:id/resolve-ens` | JWT | Trigger on-chain ENS resolution (updates `ens_name` + `avatar_url`) |
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
| GET | `/orders/agent/pending` | `x-agent-secret` | Agent polls for pending orders to execute via CCTP + Uniswap v4 |
| POST | `/orders/agent/create` | `x-agent-secret` | Agent creates a test order. Body: `{ "user_id", "pool_key_hash", "zero_for_one", "amount", "trigger_price", "post_id?" }` |
| PATCH | `/orders/:id/status` | JWT or `x-agent-secret` | Update order status. Body: `{ "status": "pending\|executed\|cancelled\|failed", "tx_hash?" }` |

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

### Agent Events & Health

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/agent/events` | — | Agent notifies backend of events (order executions, etc.). Body: `{ "event", "data" }` |
| GET | `/health` | — | Health check. Returns `{ "status": "ok", "timestamp": "..." }` |

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

- **Cross-chain swaps via CCTP**: Uniswap v4 PoolManager exceeds EIP-170 contract size limit on Arc, so we bridge USDC to Base Sepolia via Circle CCTP, swap on Uniswap v4 there, and bridge back. Arc attestation is ~0.5s.
- **Native USDC**: Arc Testnet uses USDC as the native currency (18 decimals). Tips and gas are paid in USDC via `msg.value`.
- **Passkey auth**: No seed phrases. Users authenticate with device biometrics via Circle Modular Wallets SDK.
- **Smart accounts**: All user wallets are ERC-4337 smart accounts. Transactions are sent as UserOperations via the bundler client.
- **Agent proposals**: The agent never executes trades directly. It proposes, the user approves, and the user's smart account executes. This keeps the user in full control.
- **ENS integration**: On-chain ENS resolution via Ethereum mainnet. Auto-resolves name + avatar on first login. Lookup by ENS name supported.
- **Dual post types**: Regular posts for social content; Idea posts for actionable trade signals that the AI agent processes.
- **SQLite**: Lightweight, zero-config database. WAL mode for concurrent reads. Good enough for a hackathon; swap for Postgres in production.

## Network Details

| Property | Arc Testnet | Base Sepolia |
| -------- | ----- | ----- |
| **Chain ID** | `5042002` | `84532` |
| **RPC** | `https://rpc.testnet.arc.network` | `https://sepolia.base.org` |
| **Explorer** | [arcscan.app](https://testnet.arcscan.app) | [basescan.org](https://sepolia.basescan.org) |
| **Native Currency** | USDC (18 decimals) | ETH |
| **USDC** | `0x3600...0000` (native) | `0x036CbD...3dCF7e` (ERC-20) |
| **CCTP Domain** | 26 | 6 |
| **Faucet** | [Circle Faucet](https://faucet.circle.com/) | [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia) |

## Deployed Contracts

### Arc Testnet

| Contract | Address |
| -------- | ------- |
| **ArrowTipping** | `0xDe4b20f3ea6D7C24bbbAa1dfea741b86B3B628da` |
| **CCTP TokenMessengerV2** | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| **CCTP MessageTransmitterV2** | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

### Base Sepolia (Uniswap v4 + Hook)

| Contract | Address |
| -------- | ------- |
| **ArrowCopyTradeHook** | `0x446e60d8EF420c68D1207557Be0BF72fEb7c8040` |
| **PoolManager** | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` |
| **PoolSwapTest** | `0x8b5bcc363dde2614281ad875bad385e0a785d3b9` |
| **PoolModifyLiquidityTest** | `0x37429cD17Cb1454C34E7F50b09725202Fd533039` |
| **StateView** | `0x571291b572ed32ce6751a2cb2486ebee8defb9b4` |
| **Universal Router** | `0x492e6456d9528771018deb9e87ef7750ef184104` |
| **Quoter** | `0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

## Live Pool — USDC/WETH on Base Sepolia

The agent operates against a custom USDC/WETH pool initialized with the `ArrowCopyTradeHook`.

| Property | Value |
| -------- | ----- |
| **Pool ID** | `0x85f572247799e4252623ff185c4766d211b618c1a2e1a91eb79d816be7a19de9` |
| **currency0** | USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (lower address) |
| **currency1** | WETH `0x4200000000000000000000000000000000000006` (higher address) |
| **Fee** | 3000 (0.3%) |
| **Tick Spacing** | 60 |
| **Hook** | ArrowCopyTradeHook `0x446e60d8EF420c68D1207557Be0BF72fEb7c8040` |
| **sqrtPriceX96** | `1771595571142957166518320255467520` (~1 WETH ≈ 2000 USDC) |
| **Liquidity** | `2.004e11` (full range: ticks −887220 to 887220) |

> **Token ordering**: Uniswap v4 requires `currency0 < currency1` by address. USDC (`0x036C...`) < WETH (`0x4200...`), so **BUY** (USDC→WETH) = `zeroForOne=true`.

## Uniswap v4 Pool Operations (Bash)

All commands use [Foundry's `cast`](https://book.getfoundry.sh/reference/cast/). Set these first:

```bash
export RPC=https://sepolia.base.org
export PK=<agent-private-key>
export USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
export WETH=0x4200000000000000000000000000000000000006
export HOOK=0x446e60d8EF420c68D1207557Be0BF72fEb7c8040
export POOL_MANAGER=0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408
export POOL_SWAP_TEST=0x8b5bcc363dde2614281ad875bad385e0a785d3b9
export MODIFY_LIQ=0x37429cD17Cb1454C34E7F50b09725202Fd533039
export STATE_VIEW=0x571291b572ed32ce6751a2cb2486ebee8defb9b4
export POOL_ID=0x85f572247799e4252623ff185c4766d211b618c1a2e1a91eb79d816be7a19de9
export AGENT=0x2618B8641334124770f13d765C3F4E79270cE8Ab
```

### Verify Pool State

```bash
# Pool liquidity
cast call $STATE_VIEW "getLiquidity(bytes32)(uint128)" $POOL_ID --rpc-url $RPC

# Pool sqrtPriceX96 and tick
cast call $STATE_VIEW "getSlot0(bytes32)(uint160,int24,uint16,uint24)" $POOL_ID --rpc-url $RPC

# Agent balances
cast call $USDC "balanceOf(address)(uint256)" $AGENT --rpc-url $RPC
cast call $WETH "balanceOf(address)(uint256)" $AGENT --rpc-url $RPC
cast balance $AGENT --rpc-url $RPC --ether
```

### Initialize a New Pool

```bash
# sqrtPriceX96 for 1 WETH = 2000 USDC (with 6 vs 18 decimal adjustment):
# sqrt(2000 * 1e6 / 1e18) * 2^96 ≈ 1771595571142957166518320255467520

cast send $POOL_MANAGER \
  "initialize((address,address,uint24,int24,address),uint160)" \
  "($USDC,$WETH,3000,60,$HOOK)" \
  1771595571142957166518320255467520 \
  --private-key $PK --rpc-url $RPC
```

### Add Liquidity

```bash
# 1. Wrap ETH → WETH (if needed)
cast send $WETH "deposit()" --value 0.003ether --private-key $PK --rpc-url $RPC

# 2. Approve tokens for PoolModifyLiquidityTest (max approval)
cast send $USDC "approve(address,uint256)" $MODIFY_LIQ $(cast max-uint) --private-key $PK --rpc-url $RPC
cast send $WETH "approve(address,uint256)" $MODIFY_LIQ $(cast max-uint) --private-key $PK --rpc-url $RPC

# 3. Add full-range liquidity (adjust liquidityDelta as needed)
#    At 2e11 delta: ~9 USDC + ~0.005 WETH required
cast send $MODIFY_LIQ \
  "modifyLiquidity((address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)" \
  "($USDC,$WETH,3000,60,$HOOK)" \
  "(-887220,887220,200000000000,0x0000000000000000000000000000000000000000000000000000000000000000)" \
  "0x" \
  --private-key $PK --rpc-url $RPC
```

### Execute a Test Swap

```bash
# Approve USDC for PoolSwapTest
cast send $USDC "approve(address,uint256)" $POOL_SWAP_TEST 10000 --private-key $PK --rpc-url $RPC

# Swap 0.01 USDC → WETH (zeroForOne=true, amountSpecified=-10000 = exact input)
cast send $POOL_SWAP_TEST \
  "swap((address,address,uint24,int24,address),(bool,int256,uint160),(bool,bool),bytes)" \
  "($USDC,$WETH,3000,60,$HOOK)" \
  "(true,-10000,4295128740)" \
  "(false,false)" \
  "0x" \
  --private-key $PK --rpc-url $RPC
```

### Remove Liquidity

```bash
# Negative liquidityDelta to remove (e.g., remove 1e10)
cast send $MODIFY_LIQ \
  "modifyLiquidity((address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)" \
  "($USDC,$WETH,3000,60,$HOOK)" \
  "(-887220,887220,-10000000000,0x0000000000000000000000000000000000000000000000000000000000000000)" \
  "0x" \
  --private-key $PK --rpc-url $RPC
```

## Transaction Evidence

| Step | Description | Chain |
| ---- | ----------- | ----- |
| Pool init | `initialize()` USDC/WETH with ArrowCopyTradeHook | Base Sepolia |
| Liquidity (round 1) | `modifyLiquidity()` delta=4e8 (~0.018 USDC) | Base Sepolia |
| Liquidity (round 2) | `modifyLiquidity()` delta=2e11 (~9 USDC + 0.005 WETH) | Base Sepolia |
| CCTP burn | `depositForBurn()` V2 (7 params) on Arc → Base Sepolia | Arc Testnet |
| CCTP mint | `receiveMessage()` on Base Sepolia | Base Sepolia |
| Swap #1 | `swap()` 0.01 USDC → 0.00199 WETH via PoolSwapTest | Base Sepolia |

## Agent Wallet

| Property | Value |
| -------- | ----- |
| **Address** | `0x2618B8641334124770f13d765C3F4E79270cE8Ab` |
| **Role** | Executes cross-chain bridge + swap on behalf of users |
| **Chains** | Arc Testnet (CCTP burn/mint) + Base Sepolia (Uniswap v4 swap) |
| **Funding** | Needs ETH on Base Sepolia for gas, USDC on Arc for bridging |
