#!/bin/bash
# ============================================
# Unyvox - Setup File .env
# ============================================
# Crea il file .env chiedendo all'utente le credenziali necessarie.
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ⚙️  Unyvox - Setup Configurazione${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}▶ Il file .env esiste già.${NC}"
    read -rp "Vuoi sovrascriverlo? (s/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Ss]$ ]]; then
        echo -e "${GREEN}✓ Setup annullato, il file .env esistente è stato conservato.${NC}"
        exit 0
    fi
fi

echo -e "${YELLOW}▶ Inserisci le credenziali richieste:${NC}"
echo ""

read -rp "DuckDNS domain [unyvox]: " DUCKDNS_DOMAIN
DUCKDNS_DOMAIN=${DUCKDNS_DOMAIN:-unyvox}

read -rsp "DuckDNS token: " DUCKDNS_TOKEN
 echo ""

if [ -z "$DUCKDNS_TOKEN" ]; then
    echo -e "${RED}❌ Token DuckDNS obbligatorio.${NC}"
    exit 1
fi

read -rp "GitHub username (opzionale, premi Invio per saltare): " GITHUB_USERNAME
read -rsp "GitHub token (opzionale, premi Invio per saltare): " GITHUB_TOKEN
 echo ""

# Scrivi il file .env
cat > "$ENV_FILE" << EOF
# Configurazione DuckDNS (per il redirect stabile)
# Ottieni il token da: https://www.duckdns.org/domains
DUCKDNS_DOMAIN=${DUCKDNS_DOMAIN}
DUCKDNS_TOKEN=${DUCKDNS_TOKEN}

# Configurazione GitHub (solo per setup-github-redirect.sh)
# Crea il token da: https://github.com/settings/tokens (scope "repo")
GITHUB_USERNAME=${GITHUB_USERNAME}
GITHUB_TOKEN=${GITHUB_TOKEN}
EOF

# Proteggi il file
chmod 600 "$ENV_FILE"

echo ""
echo -e "${GREEN}✅ File .env creato con successo!${NC}"
echo ""
echo -e "${YELLOW}📋 Prossimi passaggi:${NC}"
echo -e "   1. Se il token DuckDNS era esposto in precedenza, rigeneralo da DuckDNS."
echo -e "   2. Esegui ./start-public.sh per avviare il server e il tunnel."
echo ""
echo -e "${BLUE}========================================${NC}"
