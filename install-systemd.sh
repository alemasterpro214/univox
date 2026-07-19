#!/bin/bash
# ============================================
# Unyvox - Installazione Servizio systemd
# ============================================
# Installa un servizio systemd per avviare automaticamente
# Unyvox + Cloudflare Tunnel all'avvio della macchina.
#
# Uso: sudo ./install-systemd.sh
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="unyvox-cloudflare"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ⚙️  Installazione servizio systemd${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# --- Deve essere eseguito come root ---
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Questo script deve essere eseguito con sudo.${NC}"
    echo -e "${YELLOW}   Esegui: sudo ./install-systemd.sh${NC}"
    exit 1
fi

# --- Prerequisiti ---
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 non trovato. Installalo prima con: npm install -g pm2${NC}"
    exit 1
fi

if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared non trovato. Installalo prima.${NC}"
    exit 1
fi

# --- Rileva percorsi ---
PM2_PATH=$(command -v pm2)
WORK_DIR="$SCRIPT_DIR"
USER_NAME=${SUDO_USER:-$USER}

# --- Genera il file di servizio ---
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Unyvox Next.js Server + Cloudflare Tunnel
After=network.target

[Service]
Type=forking
User=${USER_NAME}
WorkingDirectory=${WORK_DIR}
ExecStart=${PM2_PATH} start ${WORK_DIR}/ecosystem.config.js
ExecStop=${PM2_PATH} stop ${WORK_DIR}/ecosystem.config.js
ExecReload=${PM2_PATH} reload ${WORK_DIR}/ecosystem.config.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ File di servizio creato: ${SERVICE_FILE}${NC}"

# --- Configura PM2 per l'avvio automatico ---
echo -e "${YELLOW}▶ Configurazione avvio automatico PM2...${NC}"
pm2 startup systemd -u "$USER_NAME" --hp "$(eval echo ~$USER_NAME)" 2>/dev/null || true

# --- Ricarica systemd e abilita il servizio ---
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Servizio installato!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}📋 Comandi utili:${NC}"
echo -e "   • Avvia:   sudo systemctl start ${SERVICE_NAME}"
echo -e "   • Ferma:   sudo systemctl stop ${SERVICE_NAME}"
echo -e "   • Stato:   sudo systemctl status ${SERVICE_NAME}"
echo -e "   • Riavvia: sudo systemctl restart ${SERVICE_NAME}"
echo ""
echo -e "${YELLOW}💡 Per avviare ora il servizio:${NC}"
echo -e "   sudo systemctl start ${SERVICE_NAME}"
echo ""
echo -e "${YELLOW}⚠️  Nota importante:${NC}"
echo -e "   1. Avvia prima manualmente con ./start-cloudflare-tunnel.sh"
echo -e "   2. Poi esegui: pm2 save"
echo -e "   3. Da quel momento systemd riavvierà automaticamente tutto all'accensione."
echo -e "${BLUE}========================================${NC}"
