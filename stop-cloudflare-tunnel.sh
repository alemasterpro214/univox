#!/bin/bash
# ============================================
# Unyvox - Ferma Tunnel Cloudflare
# ============================================
# Ferma i processi PM2 avviati da start-cloudflare-tunnel.sh
#
# Uso: ./stop-cloudflare-tunnel.sh
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}   🛑 Fermando Unyvox + Cloudflare Tunnel${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if command -v pm2 &> /dev/null; then
    pm2 delete unyvox-server 2>/dev/null || true
    pm2 delete unyvox-tunnel 2>/dev/null || true
    echo -e "${GREEN}✓ Processi PM2 fermati${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 non trovato, uso fallback kill${NC}"
    pkill -f "node server.mjs" 2>/dev/null || true
    pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}✅ Unyvox fermato!${NC}"
echo -e "${BLUE}========================================${NC}"
