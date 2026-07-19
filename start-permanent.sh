#!/bin/bash
# ============================================
# Unyvox - Avvio con Tunnel Permanente
# ============================================
# Avvia il server Next.js e un Cloudflare Tunnel permanente
# collegato al dominio configurato.
# Non richiede port forwarding e l'URL rimane sempre lo stesso.
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Leggi dominio e tunnel ID dai file di configurazione o dai parametri
DOMAIN=${1:-$(cat "${SCRIPT_DIR}/.unyvox-domain" 2>/dev/null || echo "")}
TUNNEL_ID=${2:-$(cat "${SCRIPT_DIR}/.unyvox-tunnel-id" 2>/dev/null || echo "")}

if [ -z "$DOMAIN" ] || [ -z "$TUNNEL_ID" ]; then
    echo -e "${RED}❌ Dominio o Tunnel ID non specificati.${NC}"
    echo ""
    echo -e "${YELLOW}Uso:${NC}"
    echo -e "   ./start-permanent.sh <dominio> <tunnel-id>"
    echo ""
    echo -e "${YELLOW}Esempio:${NC}"
    echo -e "   ./start-permanent.sh unyvox.com 1234abcd-..."
    echo ""
    echo -e "${YELLOW}Oppure esegui prima:${NC}"
    echo -e "   ./setup-cloudflare-tunnel.sh"
    exit 1
fi

CONFIG_FILE="${SCRIPT_DIR}/cloudflared-config.yml"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ File di configurazione non trovato: ${CONFIG_FILE}${NC}"
    echo -e "${YELLOW}   Esegui prima: ./setup-cloudflare-tunnel.sh${NC}"
    exit 1
fi

# Verifica che il file di credenziali del tunnel esista
CREDS_FILE="${HOME}/.cloudflared/${TUNNEL_ID}.json"
if [ ! -f "$CREDS_FILE" ]; then
    echo -e "${RED}❌ File di credenziali del tunnel non trovato: ${CREDS_FILE}${NC}"
    echo -e "${YELLOW}   Esegui nuovamente: ./setup-cloudflare-tunnel.sh${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🚀 Unyvox - Avvio Tunnel Permanente${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Ferma processi esistenti
echo -e "${YELLOW}▶ Fermando processi esistenti...${NC}"
pkill -f "node server.mjs" 2>/dev/null || true
pkill -f "cloudflared tunnel run" 2>/dev/null || true
sleep 1
echo -e "${GREEN}✓ Processi fermati${NC}"

# Avvia il server Next.js
echo ""
echo -e "${YELLOW}▶ Avvio del server Next.js...${NC}"
cd "$SCRIPT_DIR"
nohup node server.mjs > /tmp/unyvox-server.log 2>&1 &
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

# Avvia il tunnel permanente
echo ""
echo -e "${YELLOW}▶ Avvio del tunnel permanente per ${DOMAIN}...${NC}"
nohup cloudflared tunnel run --config "${CONFIG_FILE}" "${TUNNEL_ID}" > /tmp/unyvox-tunnel.log 2>&1 &
TUNNEL_PID=$!
echo -e "${GREEN}✓ Tunnel avviato (PID: ${TUNNEL_PID})${NC}"

# Riepilogo
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ TUTTO PRONTO!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}🌐 URL stabile:${NC} https://${DOMAIN}"
echo ""
echo -e "${YELLOW}📋 Processi avviati:${NC}"
echo -e "   • Server Next.js:  PID $SERVER_PID (porta 3000)"
echo -e "   • Cloudflare Tunnel: PID $TUNNEL_PID"
echo ""
echo -e "${YELLOW}📋 Log:${NC}"
echo -e "   • Server:  /tmp/unyvox-server.log"
echo -e "   • Tunnel:  /tmp/unyvox-tunnel.log"
echo ""
echo -e "${YELLOW}⚠️  Per fermare:${NC}"
echo -e "   ./stop-public.sh"
echo -e "${BLUE}========================================${NC}"
