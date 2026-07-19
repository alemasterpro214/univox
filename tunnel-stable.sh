#!/bin/bash
# ============================================
# Unyvox - Tunnel Stabile con URL Permanente
# ============================================
# Usa localhost.run per un URL stabile e gratuito.
# URL rimane lo stesso finché il tunnel è attivo.
#
# Requisiti: ssh client (installato di default su Linux/Mac)
#
# Uso: ./tunnel-stable.sh
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

URL_FILE="${SCRIPT_DIR}/.unyvox-tunnel-url"
LOG_FILE="/tmp/unyvox-tunnel.log"

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🌐 Unyvox - Tunnel Stabile                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Verifica che il server sia attivo
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${RED}❌ Server non attivo su localhost:3000${NC}"
    echo -e "${YELLOW}   Avvia prima il server: ./start-server.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Server attivo su localhost:3000${NC}"
echo ""
echo -e "${YELLOW}▶ Avvio tunnel stabile...${NC}"
echo -e "${CYAN}   L'URL rimarrà lo stesso finché il tunnel è attivo.${NC}"
echo ""

# Avvia il tunnel SSH verso localhost.run
# -R assegna una porta remota stabile
# -o ServerAliveInterval=60 mantiene la connessione attiva
# -T disabilita l'allocazione di un tty
# 2>&1 | tee manda output sia a file che a schermo
ssh -R 80:localhost:3000 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -T nokey@localhost.run 2>&1 | tee "$LOG_FILE" &
TUNNEL_PID=$!

# Salva PID del tunnel
echo "$TUNNEL_PID" > /tmp/unyvox-tunnel.pid

# Attendi e cattura l'URL stabile
echo -e "${YELLOW}▶ Attesa URL stabile (max 60s)...${NC}"
URL=""
sleep 3
for i in {1..57}; do
    URL=$(grep -o 'https://[a-zA-Z0-9-]*\.lhr\.life' "$LOG_FILE" 2>/dev/null | head -1)
    if [ -z "$URL" ]; then
        URL=$(grep -o 'https://[a-zA-Z0-9-]*\.localhost\.run' "$LOG_FILE" 2>/dev/null | head -1)
    fi
    if [ -z "$URL" ]; then
        URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null | head -1)
    fi
    if [ ! -z "$URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$URL" ]; then
    echo -e "${RED}✗ URL non ottenuto. Controlla: $LOG_FILE${NC}"
    kill $TUNNEL_PID 2>/dev/null || true
    exit 1
fi

# Salva l'URL
echo "$URL" > "$URL_FILE"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ TUNNEL STABILE ATTIVO!                     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🌐 URL stabile:${NC} ${URL}"
echo -e "${GREEN}🔗 Locale:${NC} http://localhost:3000"
echo ""
echo -e "${YELLOW}📋 L'URL rimane lo stesso finché il tunnel è attivo.${NC}"
echo -e "${YELLOW}   Il tunnel è in esecuzione con PID: ${TUNNEL_PID}${NC}"
echo ""
echo -e "${YELLOW}💡 Per fermare:${NC} kill $TUNNEL_PID"
echo -e "${YELLOW}💡 Per avviare in background:${NC}"
echo -e "   nohup ./tunnel-stable.sh &"
echo ""

# Aspetta che il tunnel sia chiuso
wait $TUNNEL_PID 2>/dev/null || true
