#!/bin/bash
# ============================================
# Unyvox - Setup Cloudflare Tunnel Permanente
# ============================================
# Configura un tunnel Cloudflare fisso collegato al tuo dominio.
# Non richiede port forwarding e l'URL rimane sempre lo stesso.
# Requisiti: account Cloudflare, dominio gestito su Cloudflare,
#            cloudflared installato.
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🌐 Unyvox - Setup Tunnel Permanente${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Dipendenze
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared non è installato.${NC}"
    echo -e "${YELLOW}   Installalo da: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/${NC}"
    exit 1
fi

# Dominio
if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}▶ Inserisci il dominio che vuoi usare (es. unyvox.com):${NC}"
    read -rp "Dominio: " DOMAIN
fi

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ Dominio non specificato.${NC}"
    exit 1
fi

TUNNEL_NAME=${TUNNEL_NAME:-unyvox-tunnel}

echo ""
echo -e "${YELLOW}▶ Configurazione tunnel permanente per: ${DOMAIN}${NC}"
echo ""

# 1. Autenticazione (deve essere fatto prima di ogni altro comando cloudflared)
if [ ! -f "${HOME}/.cloudflared/cert.pem" ]; then
    echo -e "${YELLOW}▶ Autenticazione con Cloudflare...${NC}"
    echo -e "${YELLOW}   Si aprirà il browser per confermare l'accesso.${NC}"
    cloudflared tunnel login
else
    echo -e "${GREEN}✓ Già autenticato con Cloudflare.${NC}"
fi

# 2. Controlla se il tunnel esiste già
echo ""
echo -e "${YELLOW}▶ Ricerca tunnel esistente '${TUNNEL_NAME}'...${NC}"
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" | awk '{print $1}' | head -1 || true)

if [ -n "$TUNNEL_ID" ]; then
    echo -e "${GREEN}✓ Tunnel esistente trovato: ${TUNNEL_ID}${NC}"
else
    # Crea il tunnel
    echo ""
    echo -e "${YELLOW}▶ Creazione tunnel '${TUNNEL_NAME}'...${NC}"
    TUNNEL_OUTPUT=$(cloudflared tunnel create "${TUNNEL_NAME}" 2>&1)
    echo "${TUNNEL_OUTPUT}"

    # Estrai l'ID del tunnel (formato UUID)
    TUNNEL_ID=$(echo "${TUNNEL_OUTPUT}" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)

    if [ -z "$TUNNEL_ID" ]; then
        # Prova a cercare nella lista aggiornata
        TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" | awk '{print $1}' | head -1)
    fi

    if [ -z "$TUNNEL_ID" ]; then
        echo -e "${RED}❌ Impossibile ottenere l'ID del tunnel.${NC}"
        echo -e "${YELLOW}   Prova manualmente con: cloudflared tunnel list${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Tunnel creato con ID: ${TUNNEL_ID}${NC}"
fi

# 3. Configura il DNS
echo ""
echo -e "${YELLOW}▶ Collegamento dominio ${DOMAIN} al tunnel...${NC}"
if ! cloudflared tunnel route dns "${TUNNEL_ID}" "${DOMAIN}"; then
    echo ""
    echo -e "${RED}❌ Impossibile configurare il DNS per ${DOMAIN}.${NC}"
    echo -e "${YELLOW}   Assicurati che:${NC}"
    echo -e "      1. Il dominio ${DOMAIN} sia aggiunto su Cloudflare"
    echo -e "      2. I nameserver di ${DOMAIN} puntino a Cloudflare"
    echo -e "      3. La propagazione DNS sia completata (può richiedere ore)"
    echo ""
    echo -e "${YELLOW}   Puoi verificare lo stato da: https://dash.cloudflare.com${NC}"
    exit 1
fi
echo -e "${GREEN}✓ DNS configurato: ${DOMAIN} → tunnel ${TUNNEL_ID}${NC}"

# 4. Salva configurazione locale
echo "$DOMAIN" > "${SCRIPT_DIR}/.unyvox-domain"
echo "$TUNNEL_ID" > "${SCRIPT_DIR}/.unyvox-tunnel-id"

# 5. Crea il file di configurazione per cloudflared
cat > "${SCRIPT_DIR}/cloudflared-config.yml" << EOF
# Configurazione Cloudflare Tunnel per Unyvox
# Generata automaticamente da setup-cloudflare-tunnel.sh

tunnel: ${TUNNEL_ID}
credentials-file: ${HOME}/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: ${DOMAIN}
    service: http://localhost:3000
  - service: http_status:404
EOF

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Setup completato!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}🌐 URL stabile:${NC} https://${DOMAIN}"
echo ""
echo -e "${YELLOW}📋 Per avviare il tunnel permanente:${NC}"
echo -e "   ./start-permanent.sh${NC}"
echo ""
echo -e "${YELLOW}📋 Per avviare manualmente:${NC}"
echo -e "   cloudflared tunnel run --config ${SCRIPT_DIR}/cloudflared-config.yml${NC}"
echo ""
echo -e "${YELLOW}⚠️  Nota:${NC}"
echo -e "   Assicurati che i nameserver di ${DOMAIN} siano impostati su Cloudflare."
echo -e "   Puoi verificarlo da: https://dash.cloudflare.com"
echo -e "${BLUE}========================================${NC}"
