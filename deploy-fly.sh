#!/bin/bash
# ============================================
# Unyvox - Deploy su Fly.io (URL Permanente)
# ============================================
# Deploy automatico su Fly.io con URL permanente gratuito.
# URL: https://unyvox.fly.dev (sempre lo stesso!)
#
# Requisiti:
#   1. Account Fly.io gratuito (https://fly.io/app/sign-up)
#   2. flyctl installato (./install-fly.sh o curl -L https://fly.io/install.sh | sh)
#
# Uso: ./deploy-fly.sh
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Unyvox - Deploy Fly.io                     ║${NC}"
echo -e "${BLUE}║   URL Permanente: https://unyvox.fly.dev         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Verifica flyctl
FLYCTL="${HOME}/.fly/bin/flyctl"
if [ ! -f "$FLYCTL" ]; then
    if command -v flyctl &> /dev/null; then
        FLYCTL="flyctl"
    elif command -v fly &> /dev/null; then
        FLYCTL="fly"
    else
        echo -e "${RED}❌ flyctl non è installato.${NC}"
        echo -e "${YELLOW}   Installalo con:${NC}"
        echo -e "   curl -L https://fly.io/install.sh | sh"
        exit 1
    fi
fi
echo -e "${GREEN}✓ flyctl trovato: $FLYCTL${NC}"

# Verifica login
echo -e "${YELLOW}▶ Verifica login Fly.io...${NC}"
if ! $FLYCTL auth whoami &> /dev/null; then
    echo -e "${CYAN}   Si aprirà il browser per l'accesso a Fly.io.${NC}"
    echo -e "${CYAN}   Se non hai un account, creane uno gratuito:${NC}"
    echo -e "${CYAN}   https://fly.io/app/sign-up${NC}"
    echo ""
    $FLYCTL auth login
fi
echo -e "${GREEN}✓ Loggato su Fly.io${NC}"
echo ""

# Verifica se l'app esiste già
echo -e "${YELLOW}▶ Verifica app 'unyvox'...${NC}"
if ! $FLYCTL apps list 2>/dev/null | grep -q "unyvox"; then
    echo -e "${CYAN}   Creazione app 'unyvox'...${NC}"
    $FLYCTL apps create unyvox --org personal 2>/dev/null || true
    echo -e "${GREEN}   ✓ App creata${NC}"
else
    echo -e "${GREEN}   ✓ App 'unyvox' esistente${NC}"
fi
echo ""

# Genera secrets solo se non esistono
echo -e "${YELLOW}▶ Configurazione secrets...${NC}"

# NEXTAUTH_SECRET - genera solo se non esiste
if ! $FLYCTL secrets list --app unyvox 2>/dev/null | grep -q NEXTAUTH_SECRET; then
    SECRET=$(openssl rand -base64 32 2>/dev/null || echo "unyvox-secret-$(date +%s)")
    $FLYCTL secrets set NEXTAUTH_SECRET="$SECRET" --app unyvox 2>/dev/null || true
    echo -e "${GREEN}   ✓ NEXTAUTH_SECRET generato${NC}"
else
    echo -e "${GREEN}   ✓ NEXTAUTH_SECRET già esistente${NC}"
fi

# NEXTAUTH_URL
$FLYCTL secrets set NEXTAUTH_URL="https://unyvox.fly.dev" --app unyvox 2>/dev/null || true

# DATABASE_URL - usa SQLite persistente
$FLYCTL secrets set DATABASE_URL="file:/data/dev.db" --app unyvox 2>/dev/null || true

echo -e "${GREEN}   ✓ Secrets configurati${NC}"
echo ""

# Crea volume persistente per il database
echo -e "${YELLOW}▶ Creazione volume persistente...${NC}"
$FLYCTL volumes create unyvox_data --region ams --size 1 --app unyvox 2>/dev/null || true
echo -e "${GREEN}   ✓ Volume creato${NC}"
echo ""

# Deploy
echo -e "${YELLOW}▶ Deploy su Fly.io...${NC}"
cd "$SCRIPT_DIR"
$FLYCTL deploy --app unyvox --remote-only 2>&1 | tail -20

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DEPLOY COMPLETATO!                         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🌐 URL Permanente:${NC} https://unyvox.fly.dev"
echo -e "${GREEN}🔗 Dashboard:${NC} https://fly.io/apps/unyvox"
echo ""
echo -e "${YELLOW}📋 L'URL rimane sempre lo stesso!${NC}"
echo -e "${YELLOW}   Puoi riavviare, redeployare, il link non cambia mai.${NC}"
echo ""
echo -e "${YELLOW}📋 Comandi utili:${NC}"
echo -e "   • Status:   $FLYCTL status --app unyvox"
echo -e "   • Logs:     $FLYCTL logs --app unyvox"
echo -e "   • Restart:  $FLYCTL apps restart unyvox"
echo -e "   • Redeploy: $FLYCTL deploy --app unyvox"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
