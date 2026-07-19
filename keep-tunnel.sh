#!/bin/bash
# ============================================
# Unyvox - Watchdog Tunnel Stabile
# ============================================
# Riavvia automaticamente il tunnel se si disconnette.
# Tieni questo script in esecuzione con: nohup ./keep-tunnel.sh &
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
URL_FILE="${SCRIPT_DIR}/.unyvox-tunnel-url"
LOG_FILE="/tmp/unyvox-tunnel-watchdog.log"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Tunnel Watchdog avviato${NC}" | tee -a "$LOG_FILE"

restart_tunnel() {
    echo -e "${YELLOW}▶ Riavvio tunnel...${NC}" | tee -a "$LOG_FILE"
    
    # Ferma tunnel precedenti usando PID file
    if [ -f /tmp/unyvox-tunnel.pid ]; then
        kill $(cat /tmp/unyvox-tunnel.pid) 2>/dev/null || true
        rm -f /tmp/unyvox-tunnel.pid
    fi
    sleep 2
    
    # Verifica server attivo
    if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${RED}✗ Server non attivo, attendo 10s...${NC}" | tee -a "$LOG_FILE"
        sleep 10
        if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${RED}✗ Server ancora non attivo, riprovo tra 30s${NC}" | tee -a "$LOG_FILE"
            sleep 30
            return 1
        fi
    fi
    
    # Avvia tunnel
    nohup bash "${SCRIPT_DIR}/tunnel-stable.sh" > /dev/null 2>&1 &
    
    # Attendi e cattura il nuovo URL
    sleep 8
    NEW_URL=""
    for i in {1..20}; do
        NEW_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.lhr\.life' /tmp/unyvox-tunnel.log 2>/dev/null | head -1)
        if [ -z "$NEW_URL" ]; then
            NEW_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.localhost\.run' /tmp/unyvox-tunnel.log 2>/dev/null | head -1)
        fi
        if [ -z "$NEW_URL" ]; then
            NEW_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' /tmp/unyvox-tunnel.log 2>/dev/null | head -1)
        fi
        if [ ! -z "$NEW_URL" ]; then
            echo "$NEW_URL" > "$URL_FILE"
            echo -e "${GREEN}✓ Tunnel riavviato: ${NEW_URL}${NC}" | tee -a "$LOG_FILE"
            break
        fi
        sleep 1
    done
    
    return 0
}

# Avvio iniziale
restart_tunnel

# Loop di monitoraggio
while true; do
    sleep 30
    
    # Verifica se il tunnel è attivo
    if ! pgrep -f "ssh.*localhost.run" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Tunnel disconnesso! Riavvio...${NC}" | tee -a "$LOG_FILE"
        restart_tunnel
    fi
    
    # Verifica se il server è attivo
    if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${RED}⚠️  Server non attivo! Riavvio...${NC}" | tee -a "$LOG_FILE"
        cd "$SCRIPT_DIR"
        nohup node server.mjs > /tmp/unyvox-server.log 2>&1 &
        sleep 10
        restart_tunnel
    fi
done
