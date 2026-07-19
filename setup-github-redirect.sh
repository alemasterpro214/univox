#!/bin/bash
# ============================================
# Unyvox - Setup Redirect su GitHub Pages
# ============================================
# Crea un repository GitHub con una pagina di redirect
# che legge il record TXT di DuckDNS e reindirizza al
# tunnel Cloudflare attuale. Richiede un account GitHub
# e un Personal Access Token con scope "repo".
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🚀 Unyvox - Setup Redirect GitHub${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Dipendenze
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git non è installato. Installalo prima di proseguire.${NC}"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl non è installato. Installalo prima di proseguire.${NC}"
    exit 1
fi

# Credenziali
if [ -z "$GITHUB_USERNAME" ] || [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}▶ Inserisci le credenziali GitHub:${NC}"
    echo -e "${YELLOW}   (oppure imposta le variabili d'ambiente GITHUB_USERNAME e GITHUB_TOKEN)${NC}"
    echo ""
    read -rp "GitHub username: " GITHUB_USERNAME
    read -rsp "GitHub token (scope repo): " GITHUB_TOKEN
    echo ""
fi

REPO_NAME=${GITHUB_REPO_NAME:-unyvox-redirect}
REPO_DESC=${GITHUB_REPO_DESC:-Redirect stabile per Unyvox}

echo ""
echo -e "${YELLOW}▶ Creazione repository GitHub '${REPO_NAME}'...${NC}"

HTTP_CODE=$(curl -s -o /tmp/gh-create-repo.json -w "%{http_code}" -X POST \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"${REPO_NAME}\",\"description\":\"${REPO_DESC}\",\"private\":false}")

if [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ Repository creato: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}${NC}"
elif [ "$HTTP_CODE" -eq 422 ]; then
    echo -e "${YELLOW}⚠ Il repository sembra già esistere (HTTP ${HTTP_CODE}). Procedo con il push dei file.${NC}"
else
    echo -e "${RED}❌ Errore nella creazione del repository (HTTP ${HTTP_CODE}).${NC}"
    echo -e "${YELLOW}   Dettagli:${NC}"
    cat /tmp/gh-create-repo.json
    echo ""
    echo -e "${YELLOW}💡 Suggerimento: se il repository esiste già, puoi saltare questo passaggio.${NC}"
    exit 1
fi

# Prepara il repository locale
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

git init

# Configura l'identità git locale (non richiede configurazione globale)
git config user.email "${GITHUB_USERNAME}@users.noreply.github.com"
git config user.name "${GITHUB_USERNAME}"

# Copia la pagina di redirect e sostituisci il dominio DuckDNS
cp "${SCRIPT_DIR}/redirect/index.html" .
if [ ! -z "$DUCKDNS_DOMAIN" ]; then
    sed -i "s/var DUCKDNS_DOMAIN = 'unyvox.duckdns.org';/var DUCKDNS_DOMAIN = '${DUCKDNS_DOMAIN}.duckdns.org';/" index.html
fi

# Commit e push sul branch main
git add index.html
git commit -m "feat: redirect stabile per Unyvox"
git branch -M main
git remote add origin "https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
git push -u origin main

echo ""
echo -e "${GREEN}✓ Pagina di redirect caricata su GitHub.${NC}"

# Attiva GitHub Pages via API
HTTP_CODE=$(curl -s -o /tmp/gh-pages.json -w "%{http_code}" -X POST \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/pages" \
    -d '{"source":{"branch":"main","path":"/"}}')

if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 204 ]; then
    echo -e "${GREEN}✓ GitHub Pages attivato automaticamente.${NC}"
elif [ "$HTTP_CODE" -eq 409 ]; then
    echo -e "${YELLOW}⚠ GitHub Pages era già attivato (HTTP ${HTTP_CODE}).${NC}"
else
    echo -e "${YELLOW}⚠ Non è stato possibile attivare GitHub Pages automaticamente (HTTP ${HTTP_CODE}).${NC}"
    echo -e "${YELLOW}   Attivalo manualmente da: Impostazioni > Pages > Source = Deploy from a branch > main${NC}"
fi

# Riepilogo
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Setup completato!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}🔗 URL stabile (può richiedere fino a 5 minuti per propagarsi):${NC}"
echo -e "${GREEN}   https://${GITHUB_USERNAME}.github.io/${REPO_NAME}${NC}"
echo ""
echo -e "${YELLOW}📋 Cosa succede ora:${NC}"
echo -e "   1. Avvia il server con ./start-public.sh o ./start-full.sh"
echo -e "   2. Lo script aggiornerà automaticamente il record TXT di DuckDNS."
echo -e "   3. Chiunque apre l'URL stabile sopra verrà reindirizzato al tunnel Cloudflare attuale."
echo ""
echo -e "${YELLOW}⚠️  Nota:${NC}"
echo -e "   Non serve port forwarding e non serve una carta di credito."
echo -e "   L'unico requisito è un account GitHub gratuito."
echo -e "${BLUE}========================================${NC}"
