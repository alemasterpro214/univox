#!/bin/bash
# ============================================
# Unyvox - Avvio Pubblico Completo
# ============================================
# Avvia: server Next.js + tunnel Cloudflare +
#        redirect server + tunnel watcher
# Uso: ./start-public.sh
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
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🚀 Unyvox - Avvio Pubblico Completo${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Prerequisiti
for cmd in node curl cloudflared git; do
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}❌ $cmd non trovato. Installalo prima di proseguire.${NC}"
        exit 1
    fi
done

cd "$SCRIPT_DIR"

# Ferma processi precedenti di questo progetto
echo -e "${YELLOW}▶ Fermando processi precedenti...${NC}"
pkill -f "node server.mjs" 2>/dev/null || true
pkill -f "node redirect-server.js" 2>/dev/null || true
# Uccidi solo il tunnel avviato da questo script (verso localhost:3000)
pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null || true
pkill -f "tunnel-watcher.sh" 2>/dev/null || true
sleep 1

# Pulisci log precedenti
rm -f /tmp/univox-server.log /tmp/univox-tunnel.log /tmp/univox-redirect.log /tmp/univox-watcher.log /tmp/univox-current-url.txt

# Aggiorna DuckDNS IP
curl -s "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=" > /dev/null

# Avvia server Next.js
echo -e "${YELLOW}▶ Avvio server Next.js...${NC}"
nohup node server.mjs > /tmp/univox-server.log 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > /tmp/univox-server.pid

# Attendi che il server sia pronto
echo -e "${YELLOW}▶ Attesa server (max 60s)...${NC}"
for i in {1..60}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server pronto su http://localhost:3000${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${RED}✗ Server non pronto dopo 60 secondi. Controlla /tmp/univox-server.log${NC}"
        exit 1
    fi
    sleep 1
done

# Avvia redirect server
echo -e "${YELLOW}▶ Avvio redirect server (porta 3001)...${NC}"
nohup node redirect-server.js > /tmp/univox-redirect.log 2>&1 &
REDIRECT_PID=$!
echo "$REDIRECT_PID" > /tmp/univox-redirect.pid

# Avvia tunnel Cloudflare
echo -e "${YELLOW}▶ Avvio tunnel Cloudflare...${NC}"
nohup cloudflared tunnel --url http://localhost:3000 > /tmp/univox-tunnel.log 2>&1 &
TUNNEL_PID=$!
echo "$TUNNEL_PID" > /tmp/univox-tunnel.pid

# Attendi URL del tunnel
echo -e "${YELLOW}▶ Attesa URL pubblico (max 40s)...${NC}"
URL=""
for i in {1..40}; do
    URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' /tmp/univox-tunnel.log 2>/dev/null | head -1)
    if [ ! -z "$URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$URL" ]; then
    echo -e "${RED}✗ URL del tunnel non ottenuto. Controlla /tmp/univox-tunnel.log${NC}"
    echo -e "${YELLOW}   Il server è comunque raggiungibile su http://localhost:3000${NC}"
else
    echo "$URL" > /tmp/univox-current-url.txt
    # Aggiorna TXT record DuckDNS
    curl -s "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&txt=${URL}" > /dev/null
    echo -e "${GREEN}✓ URL pubblico: ${URL}${NC}"
fi

# Avvia tunnel watcher
echo -e "${YELLOW}▶ Avvio tunnel watcher...${NC}"
nohup bash "$SCRIPT_DIR/tunnel-watcher.sh" > /tmp/univox-watcher.log 2>&1 &
WATCHER_PID=$!
echo "$WATCHER_PID" > /tmp/univox-watcher.pid

# Riepilogo
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ TUTTO PRONTO!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
if [ ! -z "$URL" ]; then
    echo -e "${GREEN}🌐 URL Pubblico (tunnel):${NC} ${URL}"
fi
echo -e "${GREEN}🔗 Link stabile (redirect):${NC} http://localhost:3001"
if [ ! -z "$GITHUB_USERNAME" ]; then
    echo -e "${GREEN}🔗 Link GitHub Pages stabile:${NC} https://${GITHUB_USERNAME}.github.io/${GITHUB_REPO_NAME:-unyvox-redirect}"
fi
echo ""
echo -e "${YELLOW}📋 Processi avviati:${NC}"
echo -e "   • Server Next.js:     PID $SERVER_PID (porta 3000)"
echo -e "   • Redirect Server:    PID $REDIRECT_PID (porta 3001)"
echo -e "   • Cloudflare Tunnel:  PID $TUNNEL_PID"
echo -e "   • Tunnel Watcher:     PID $WATCHER_PID"
echo ""
echo -e "${YELLOW}📋 Log:${NC}"
echo -e "   • Server:    /tmp/univox-server.log"
echo -e "   • Redirect:  /tmp/univox-redirect.log"
echo -e "   • Tunnel:    /tmp/univox-tunnel.log"
echo -e "   • Watcher:   /tmp/univox-watcher.log"
echo ""
echo -e "${YELLOW}💡 Per fermare tutto:${NC} ./stop-public.sh"
echo -e "${BLUE}========================================${NC}"
