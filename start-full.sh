#!/bin/bash
# ============================================
# Unyvox - Avvio Completo con Redirect
# ============================================
# Avvia: server + tunnel + watcher + redirect
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Carica variabili d'ambiente da .env se esiste
if [ -f "${SCRIPT_DIR}/.env" ]; then
    source "${SCRIPT_DIR}/.env"
fi

DUCKDNS_DOMAIN=${DUCKDNS_DOMAIN:-unyvox}
DUCKDNS_TOKEN=${DUCKDNS_TOKEN:-}

if [ -z "$DUCKDNS_TOKEN" ]; then
    echo "❌ Errore: DUCKDNS_TOKEN non impostato."
    echo "   Crea un file .env da .env.example e inserisci il tuo token DuckDNS."
    exit 1
fi

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Unyvox - Avvio Completo            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# 1. Ferma processi esistenti
echo -e "${YELLOW}▶ Fermando processi esistenti...${NC}"
pkill -f "node server.mjs" 2>/dev/null || true
pkill -f "node redirect-server.js" 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
pkill -f "tunnel-watcher.sh" 2>/dev/null || true
sleep 1
echo -e "${GREEN}✓ Processi fermati${NC}"

# 2. Aggiorna DuckDNS
echo ""
echo -e "${YELLOW}▶ Aggiornamento DuckDNS...${NC}"
curl -s "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=" > /dev/null
echo -e "${GREEN}✓ DuckDNS aggiornato${NC}"

# 3. Avvia il server Next.js
echo ""
echo -e "${YELLOW}▶ Avvio del server Next.js...${NC}"
cd "$SCRIPT_DIR"
nohup node server.mjs > /tmp/univox-server.log 2>&1 &
SERVER_PID=$!
echo -e "${GREEN}✓ Server avviato (PID: $SERVER_PID)${NC}"

# Attendi che il server sia pronto
echo -e "${YELLOW}▶ In attesa che il server sia pronto...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server pronto su http://localhost:3000${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Server non pronto dopo 30 secondi${NC}"
        exit 1
    fi
    sleep 1
done

# 4. Avvia il server redirect
echo ""
echo -e "${YELLOW}▶ Avvio del server redirect (porta 3001)...${NC}"
nohup node redirect-server.js > /tmp/univox-redirect.log 2>&1 &
REDIRECT_PID=$!
echo -e "${GREEN}✓ Server redirect avviato (PID: $REDIRECT_PID)${NC}"

# 5. Avvia il tunnel Cloudflare
echo ""
echo -e "${YELLOW}▶ Avvio del tunnel Cloudflare...${NC}"
nohup cloudflared tunnel --url http://localhost:3000 > /tmp/univox-tunnel.log 2>&1 &
TUNNEL_PID=$!
echo -e "${GREEN}✓ Tunnel avviato (PID: $TUNNEL_PID)${NC}"

# Attendi che il tunnel sia pronto
echo -e "${YELLOW}▶ In attesa dell'URL pubblico...${NC}"
for i in {1..30}; do
    URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' /tmp/univox-tunnel.log 2>/dev/null | tail -1)
    if [ ! -z "$URL" ]; then
        break
    fi
    sleep 1
done

# 6. Salva l'URL e crea redirect
if [ ! -z "$URL" ]; then
    echo "$URL" > /tmp/univox-current-url.txt
fi

# 7. Avvia il watcher (in background)
echo ""
echo -e "${YELLOW}▶ Avvio del tunnel watcher...${NC}"
nohup bash "$SCRIPT_DIR/tunnel-watcher.sh" > /tmp/univox-watcher.log 2>&1 &
WATCHER_PID=$!
echo -e "${GREEN}✓ Watcher avviato (PID: $WATCHER_PID)${NC}"

# Riepilogo
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ✅ TUTTO PRONTO!                       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🌐 URL Pubblico (tunnel):${NC}"
echo -e "   ${URL}"
echo ""
echo -e "${GREEN}🔗 Link Permanente (redirect):${NC}"
echo -e "   http://localhost:3001"
echo ""
echo -e "${YELLOW}📋 Processi avviati:${NC}"
echo -e "   • Server Next.js:     PID $SERVER_PID (porta 3000)"
echo -e "   • Server Redirect:    PID $REDIRECT_PID (porta 3001)"
echo -e "   • Cloudflare Tunnel:  PID $TUNNEL_PID"
echo -e "   • Tunnel Watcher:     PID $WATCHER_PID"
echo ""
echo -e "${YELLOW}📋 Log:${NC}"
echo -e "   • Server:    /tmp/univox-server.log"
echo -e "   • Redirect:  /tmp/univox-redirect.log"
echo -e "   • Tunnel:    /tmp/univox-tunnel.log"
echo -e "   • Watcher:   /tmp/univox-watcher.log"
echo ""
echo -e "${YELLOW}💡 Suggerimento:${NC}"
echo -e "   Apri http://localhost:3001 nei preferiti!"
echo -e "   Quel link si aggiorna sempre con l'URL corrente."
echo ""
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
