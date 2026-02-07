#!/usr/bin/env bash
# ============================================================
#  Arrow — Railway Deployment Setup
#  Deploys: server (Express + SQLite) + agent (polling daemon)
#
#  Prerequisites:
#    1. Install Railway CLI: npm i -g @railway/cli
#    2. Login: railway login --browserless
#    3. Have env vars ready (see .env.example files)
#
#  Usage:
#    chmod +x ./scripts/deploy_railway.sh
#    ./scripts/deploy_railway.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Arrow — Railway Deploy Setup       ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── Check Railway CLI ──
if ! command -v railway &> /dev/null; then
  echo -e "${RED}Railway CLI not found.${NC}"
  echo "  Install: npm i -g @railway/cli"
  echo "  Login:   railway login"
  exit 1
fi

echo -e "${GREEN}✓ Railway CLI found${NC}"

# ── Check login ──
if ! railway whoami &> /dev/null 2>&1; then
  echo -e "${YELLOW}Not logged in. Running 'railway login'...${NC}"
  railway login --browserless
fi

echo -e "${GREEN}✓ Logged in to Railway${NC}"

# ── Create project ──
echo ""
echo -e "${CYAN}Creating Railway project 'arrow'...${NC}"
railway init

echo ""
echo -e "${GREEN}✓ Project created!${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  NEXT STEPS (manual — Railway dashboard):${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  1. Go to ${CYAN}https://railway.app/dashboard${NC}"
echo -e "  2. Open your 'arrow' project"
echo ""
echo -e "  ${CYAN}── Service 1: Server ──${NC}"
echo -e "  • Click '+ New Service' → 'GitHub Repo' → select arrow repo"
echo -e "  • Settings tab:"
echo -e "      Root Directory:   ${GREEN}server${NC}"
echo -e "      Build Command:    ${GREEN}npm ci && npx tsc${NC}"
echo -e "      Start Command:    ${GREEN}npm run seed -- --reset && node dist/index.js${NC}"
echo -e "  • Variables tab (add these):"
echo -e "      ${GREEN}PORT${NC}=3001"
echo -e "      ${GREEN}JWT_SECRET${NC}=<generate: openssl rand -hex 32>"
echo -e "      ${GREEN}AGENT_SECRET${NC}=<shared secret with agent>"
echo -e "  • Networking tab: Generate a public domain"
echo -e "  • Note the URL: https://arrow-server-xxx.up.railway.app"
echo ""
echo -e "  ${CYAN}── Service 2: Agent ──${NC}"
echo -e "  • Click '+ New Service' → 'GitHub Repo' → same arrow repo"
echo -e "  • Settings tab:"
echo -e "      Root Directory:   ${GREEN}(leave empty — repo root)${NC}"
echo -e "      Build Command:    ${GREEN}cd agent && npm ci && npx tsc${NC}"
echo -e "      Start Command:    ${GREEN}cd agent && node dist/src/index.js${NC}"
echo -e "  • Variables tab (add these):"
echo -e "      ${GREEN}AGENT_PRIVATE_KEY${NC}=0x..."
echo -e "      ${GREEN}ANTHROPIC_API_KEY${NC}=sk-ant-..."
echo -e "      ${GREEN}BACKEND_URL${NC}=https://arrow-server-xxx.up.railway.app"
echo -e "      ${GREEN}AGENT_SECRET${NC}=<same as server>"
echo -e "      ${GREEN}HOOK_ADDRESS${NC}=0x446e60d8EF420c68D1207557Be0BF72fEb7c8040"
echo -e "      ${GREEN}ARC_RPC_URL${NC}=https://rpc.testnet.arc.network"
echo -e "      ${GREEN}BASE_SEPOLIA_RPC_URL${NC}=https://sepolia.base.org"
echo -e "      ${GREEN}POLL_INTERVAL${NC}=12000"
echo -e "  • No public domain needed (agent is a background worker)"
echo ""
echo -e "  ${CYAN}── Frontend (Vercel — your teammate) ──${NC}"
echo -e "  • Import repo on vercel.com"
echo -e "  • Root Directory: ${GREEN}client${NC}"
echo -e "  • Framework: ${GREEN}Vite${NC}"
echo -e "  • Build: ${GREEN}npm run build${NC} → Output: ${GREEN}dist${NC}"
echo -e "  • Env vars:"
echo -e "      ${GREEN}VITE_API_URL${NC}=https://arrow-server-xxx.up.railway.app"
echo -e "      ${GREEN}VITE_CIRCLE_CLIENT_KEY${NC}=TEST_CLIENT_KEY:655551cc..."
echo -e "      ${GREEN}VITE_CIRCLE_CLIENT_URL${NC}=https://modular-sdk.circle.com/v1/rpc/w3s/buidl"
echo -e "      ${GREEN}VITE_TIPPING_ADDRESS${NC}=0xDe4b20f3ea6D7C24bbbAa1dfea741b86B3B628da"
echo ""
echo -e "${GREEN}Done! Deploy triggers automatically on git push to main.${NC}"
