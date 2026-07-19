#!/bin/bash
# ============================================
# Unyvox - Avvio Tunnel Cloudflare (Quick)
# ============================================
# Espone l'app pubblicamente tramite Cloudflare Tunnel temporaneo.
# Non richiede dominio né carta di credito.
# Usa PM2 per tenere i processi sempre attivi e riavviarli automaticamente.
#
# Uso: ./start-cloudflare-tunnel.sh
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "$LOG_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🌐 Unyvox - Cloudflare Tunnel Avvio Rapido    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# --- Helper: mostra istruzioni di installazione ---
require_command() {
    local cmd=$1
    local install_msg=$2
    if ! command -v "$cmd" &> /dev/null; then
        echo -e "${RED}❌ $cmd non trovato.${NC}"
        echo -e "${YELLOW}   $install_msg${NC}"
        exit 1
    fi
}

# --- Prerequisiti ---
require_command "node" "Installa Node.js da https://nodejs.org/"
require_command "npm" "Installa Node.js da https://nodejs.org/"
require_command "cloudflared" "Installa cloudflared da https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"

if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}▶ PM2 non trovato. Installazione globale...${NC}"
    if ! npm install -g pm2; then
        echo -e "${RED}❌ Installazione PM2 fallita.${NC}"
        echo -e "${YELLOW}   Prova con sudo: sudo npm install -g pm2${NC}"
        exit 1
    fi
fi

cd "$SCRIPT_DIR"

# --- Installa dipendenze se necessario ---
if [ ! -d "${SCRIPT_DIR}/node_modules" ]; then
    echo -e "${YELLOW}▶ Installazione dipendenze npm...${NC}"
    npm install
fi

# --- Controlla che la porta 3000 sia libera ---
if command -v lsof &> /dev/null; then
    if lsof -i :3000 &> /dev/null; then
        echo -e "${RED}❌ La porta 3000 è già occupata.${NC}"
        echo -e "${YELLOW}   Ferma il processo che la usa oppure usa ./stop-cloudflare-tunnel.sh${NC}"
        exit 1
    fi
fi

# --- Ferma eventuali processi precedenti ---
echo -e "${YELLOW}▶ Pulizia processi precedenti...${NC}"
pm2 delete unyvox-server 2>/dev/null || true
pm2 delete unyvox-tunnel 2>/dev/null || true
sleep 1

# --- Rileva il percorso assoluto di cloudflared ---
CLOUDFLARED_PATH=$(command -v cloudflared)

# --- Genera ecosystem.config.js dal template ---
if [ ! -f "${SCRIPT_DIR}/ecosystem.config.template.js" ]; then
    echo -e "${RED}❌ Template ecosystem.config.template.js non trovato.${NC}"
    exit 1
fi

sed -e "s|{{SCRIPT_DIR}}|${SCRIPT_DIR}|g" \
    -e "s|{{LOG_DIR}}|${LOG_DIR}|g" \
    -e "s|{{CLOUDFLARED_PATH}}|${CLOUDFLARED_PATH}|g" \
    "${SCRIPT_DIR}/ecosystem.config.template.js" > "${SCRIPT_DIR}/ecosystem.config.js"

# --- Avvia server e tunnel tramite PM2 ecosystem ---
echo -e "${YELLOW}▶ Avvio server Next.js e tunnel Cloudflare con PM2...${NC}"
pm2 start ecosystem.config.js

# --- Attendi che il server sia pronto ---
echo -e "${YELLOW}▶ Attesa server (max 60s)...${NC}"
for i in {1..60}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server pronto su http://localhost:3000${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${RED}✗ Server non pronto dopo 60 secondi.${NC}"
        echo -e "${YELLOW}   Controlla: ${LOG_DIR}/server.error.log${NC}"
        exit 1
    fi
    sleep 1
done

# --- Attendi e mostra l'URL pubblico ---
echo -e "${YELLOW}▶ Attesa URL pubblico (max 40s)...${NC}"
URL=""
for i in {1..40}; do
    URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "${LOG_DIR}/tunnel.log" 2>/dev/null | head -1)
    if [ ! -z "$URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$URL" ]; then
    echo -e "${YELLOW}⚠️  URL non estratto automaticamente, ma il tunnel potrebbe essere attivo.${NC}"
    echo -e "${YELLOW}   Controlla i log con: pm2 logs unyvox-tunnel${NC}"
    echo -e "${YELLOW}   Cerca una riga simile a: https://xxxx-xxx-xxx-xxx.trycloudflare.com${NC}"
    echo -e "${YELLOW}   Il server è comunque raggiungibile su http://localhost:3000${NC}"
    exit 0
fi

echo "$URL" > "${SCRIPT_DIR}/.unyvox-tunnel-url"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ UNYVOX È ONLINE!                            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🌐 URL Pubblico:${NC} ${URL}"
echo -e "${GREEN}🔗 URL Locale:${NC}   http://localhost:3000"
echo ""
echo -e "${YELLOW}📋 Processi gestiti da PM2:${NC}"
echo -e "   • unyvox-server  (Next.js su porta 3000)"
echo -e "   • unyvox-tunnel  (Cloudflare Tunnel)"
echo ""
echo -e "${YELLOW}📋 Comandi utili:${NC}"
echo -e "   • Stato:        pm2 status"
echo -e "   • Log server:   pm2 logs unyvox-server"
echo -e "   • Log tunnel:   pm2 logs unyvox-tunnel"
echo -e "   • Fermare:      ./stop-cloudflare-tunnel.sh"
echo -e "   • Riavviare:    pm2 restart ecosystem.config.js"
echo ""
echo -e "${YELLOW}⚠️  ATTENZIONE:${NC} Questo è un Quick Tunnel Cloudflare."
echo -e "   L'URL cambia ad ogni avvio. Per un URL fisso e stabile"
echo -e "   devi usare ./setup-cloudflare-tunnel.sh con un tuo dominio."
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
