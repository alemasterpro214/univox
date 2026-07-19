#!/bin/bash
# ============================================
# Unyvox - Avvio Completo (Server + Tunnel Stabile)
# ============================================
# Avvia tutto: server Next.js + tunnel stabile + watchdog
# URL: stabile e permanente (finché il processo è attivo)
#
# Uso: ./start-all.sh
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Unyvox - Avvio Completo                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Ferma processi esistenti
echo -e "${YELLOW}▶ Fermando processi esistenti...${NC}"
pkill -f "node server.mjs" 2>/dev/null || true
pkill -f "ssh.*localhost.run" 2>/dev/null || true
pkill -f "keep-tunnel.sh" 2>/dev/null || true
sleep 2
echo -e "${GREEN}   ✓ Processi fermati${NC}"

# Installa dipendenze se necessario
if [ ! -d "${SCRIPT_DIR}/node_modules" ]; then
    echo -e "${YELLOW}▶ Installazione dipendenze...${NC}"
    cd "$SCRIPT_DIR"
    npm install
    npx prisma generate 2>/dev/null || true
    npx prisma db push 2>/dev/null || true
fi

# Avvia server Next.js
echo ""
echo -e "${YELLOW}▶ Avvio server Next.js...${NC}"
cd "$SCRIPT_DIR"
nohup node server.mjs > /tmp/unyvox-server.log 2>&1 &
SERVER_PID=$!
echo -e "${GREEN}   ✓ Server avviato (PID: $SERVER_PID)${NC}"

# Attendi che il server sia pronto
echo -e "${YELLOW}▶ Attesa server (max 60s)...${NC}"
for i in {1..60}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}   ✓ Server pronto su http://localhost:3000${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${RED}   ✗ Server non pronto dopo 60 secondi${NC}"
        echo -e "${YELLOW}   Controlla: /tmp/unyvox-server.log${NC}"
        exit 1
    fi
    sleep 1
done

# Avvia tunnel stabile
echo ""
echo -e "${YELLOW}▶ Avvio tunnel stabile...${NC}"
nohup ssh -R 80:localhost:3000 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -T nokey@localhost.run > /tmp/unyvox-tunnel.log 2>&1 &
TUNNEL_PID=$!
echo -e "${GREEN}   ✓ Tunnel avviato (PID: $TUNNEL_PID)${NC}"

# Attendi URL
echo -e "${YELLOW}▶ Attesa URL stabile (max 30s)...${NC}"
URL=""
for i in {1..30}; do
    URL=$(grep -o 'https://[a-zA-Z0-9-]*\.lhr\.life' /tmp/unyvox-tunnel.log 2>/dev/null | head -1)
    if [ -z "$URL" ]; then
        URL=$(grep -o 'https://[a-zA-Z0-9-]*\.localhost\.run' /tmp/unyvox-tunnel.log 2>/dev/null | head -1)
    fi
    if [ -z "$URL" ]; then
        URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' /tmp/unyvox-tunnel.log 2>/dev/null | head -1)
    fi
    if [ ! -z "$URL" ]; then
        break
    fi
    sleep 1
done

if [ ! -z "$URL" ]; then
    echo "$URL" > "${SCRIPT_DIR}/.unyvox-tunnel-url"
    echo -e "${GREEN}   ✓ URL: ${URL}${NC}"
else
    echo -e "${YELLOW}   ⚠️  URL non ancora disponibile, controlla: /tmp/unyvox-tunnel.log${NC}"
fi

# Avvia watchdog
echo ""
echo -e "${YELLOW}▶ Avvio watchdog tunnel...${NC}"
nohup bash "${SCRIPT_DIR}/keep-tunnel.sh" > /dev/null 2>&1 &
WATCHER_PID=$!
echo -e "${GREEN}   ✓ Watchdog avviato (PID: $WATCHER_PID)${NC}"

# Salva PID
cat > /tmp/unyvox-pids.txt << EOF
$SERVER_PID
$TUNNEL_PID
$WATCHER_PID
EOF

# Riepilogo
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ TUTTO PRONTO!                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
if [ ! -z "$URL" ]; then
    echo -e "${GREEN}🌐 URL stabile:${NC} ${URL}"
fi
echo -e "${GREEN}🔗 Locale:${NC} http://localhost:3000"
echo ""
echo -e "${YELLOW}📋 Processi:${NC}"
echo -e "   • Server Next.js:    PID $SERVER_PID (porta 3000)"
echo -e "   • Cloudflare Tunnel: PID $TUNNEL_PID"
echo -e "   • Watchdog:          PID $WATCHER_PID"
echo ""
echo -e "${YELLOW}📋 Log:${NC}"
echo -e "   • Server:  /tmp/unyvox-server.log"
echo -e "   • Tunnel:  /tmp/unyvox-tunnel.log"
echo ""
echo -e "${YELLOW}💡 Per fermare tutto:${NC} ./stop-all.sh"
echo -e "${YELLOW}💡 Per avviare in background (da chiudere il terminale):${NC}"
echo -e "   nohup ./start-all.sh &"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
