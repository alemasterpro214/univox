#!/bin/bash
# ============================================
# Unyvox - Setup Completo Dominio con Cloudflare Tunnel
# ============================================
# Questo script configura automaticamente tutto per usare
# unyvox.isroot.in come dominio stabile, GRATIS, senza port forwarding.
#
# Requisiti:
#   1. Account Cloudflare gratuito (https://dash.cloudflare.com/sign-up)
#   2. cloudflared installato
#   3. Dominio isroot.in aggiunto a Cloudflare
#
# Uso: ./setup-domain.sh
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="unyvox.isroot.in"
TUNNEL_NAME="unyvox-tunnel"

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Unyvox - Setup Dominio Completo            ║${NC}"
echo -e "${BLUE}║   Dominio: ${DOMAIN}                     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# STEP 0: Verifica prerequisiti
# ============================================
echo -e "${YELLOW}▶ Step 0: Verifica prerequisiti...${NC}"

# Verifica cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared non è installato.${NC}"
    echo ""
    echo -e "${YELLOW}📦 Installa cloudflared:${NC}"
    echo "   • Linux (Debian/Ubuntu):"
    echo "     curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null"
    echo "     echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main' | sudo tee /etc/apt/sources.list.d/cloudflared.list"
    echo "     sudo apt update && sudo apt install -y cloudflared"
    echo ""
    echo "   • Linux (generic):"
    echo "     curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared"
    echo "     sudo mv cloudflared /usr/local/bin/"
    echo "     sudo chmod +x /usr/local/bin/cloudflared"
    echo ""
    echo "   • macOS:"
    echo "     brew install cloudflare/cloudflare/cloudflared"
    echo ""
    echo "   • Windows:"
    echo "     https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    echo ""
    exit 1
fi
echo -e "${GREEN}   ✓ cloudflared installato ($(cloudflared --version 2>/dev/null | head -1))${NC}"

# Verifica node
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js non è installato.${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ Node.js installato ($(node --version))${NC}"

# Verifica npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm non è installato.${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ npm installato ($(npm --version))${NC}"

echo ""

# ============================================
# STEP 1: Autenticazione Cloudflare
# ============================================
echo -e "${YELLOW}▶ Step 1: Autenticazione con Cloudflare...${NC}"

if [ -f "${HOME}/.cloudflared/cert.pem" ]; then
    echo -e "${GREEN}   ✓ Già autenticato con Cloudflare.${NC}"
else
    echo -e "${CYAN}   Si aprirà il browser per confermare l'accesso a Cloudflare.${NC}"
    echo -e "${CYAN}   Se non hai un account, creane uno gratuito qui:${NC}"
    echo -e "${CYAN}   https://dash.cloudflare.com/sign-up${NC}"
    echo ""
    cloudflared tunnel login
    
    if [ ! -f "${HOME}/.cloudflared/cert.pem" ]; then
        echo -e "${RED}❌ Autenticazione fallita. Riprova.${NC}"
        exit 1
    fi
    echo -e "${GREEN}   ✓ Autenticato con successo!${NC}"
fi
echo ""

# ============================================
# STEP 2: Istruzioni dominio su Cloudflare
# ============================================
echo -e "${YELLOW}▶ Step 2: Configurazione dominio su Cloudflare...${NC}"
echo ""
echo -e "${CYAN}   Se hai già aggiunto isroot.in a Cloudflare, premi Invio per continuare.${NC}"
echo -e "${CYAN}   Altrimenti, segui questi passaggi:${NC}"
echo ""
echo -e "${CYAN}   1. Vai su https://dash.cloudflare.com/sign-up (se non hai un account)${NC}"
echo -e "${CYAN}   2. Clicca 'Add a site'${NC}"
echo -e "${CYAN}   3. Inserisci: isroot.in${NC}"
echo -e "${CYAN}   4. Scegli il piano gratuito (Free)${NC}"
echo -e "${CYAN}   5. Cloudflare ti darà 2 nameservers (es. xxx.ns.cloudflare.com)${NC}"
echo -e "${CYAN}   6. Vai al tuo registrar (dove hai comprato isroot.in)${NC}"
echo -e "${CYAN}   7. Cambia i nameservers da ns1.isroot.in/ns2.isroot.in a quelli di Cloudflare${NC}"
echo -e "${CYAN}   8. Attendi fino a 24h per la propagazione (di solito 1-2 ore)${NC}"
echo ""

read -p "Premi Invio quando hai completato questi passaggi... "
echo -e "${GREEN}   ✓ Procedo con la configurazione.${NC}"
echo ""

# ============================================
# STEP 3: Crea il tunnel
# ============================================
echo -e "${YELLOW}▶ Step 3: Creazione tunnel '${TUNNEL_NAME}'...${NC}"

# Controlla se il tunnel esiste già
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" | awk '{print $1}' | head -1 || true)

if [ -n "$TUNNEL_ID" ]; then
    echo -e "${GREEN}   ✓ Tunnel esistente trovato: ${TUNNEL_ID}${NC}"
else
    echo -e "${CYAN}   Creazione nuovo tunnel...${NC}"
    TUNNEL_OUTPUT=$(cloudflared tunnel create "${TUNNEL_NAME}" 2>&1)
    echo "${TUNNEL_OUTPUT}"
    
    TUNNEL_ID=$(echo "${TUNNEL_OUTPUT}" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
    
    if [ -z "$TUNNEL_ID" ]; then
        TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" | awk '{print $1}' | head -1)
    fi
    
    if [ -z "$TUNNEL_ID" ]; then
        echo -e "${RED}❌ Impossibile creare il tunnel.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}   ✓ Tunnel creato con ID: ${TUNNEL_ID}${NC}"
fi
echo ""

# ============================================
# STEP 4: Configura DNS per il dominio
# ============================================
echo -e "${YELLOW}▶ Step 4: Configurazione DNS per ${DOMAIN}...${NC}"

echo -e "${CYAN}   Collegamento ${DOMAIN} al tunnel ${TUNNEL_ID}...${NC}"
if ! cloudflared tunnel route dns "${TUNNEL_ID}" "${DOMAIN}"; then
    echo ""
    echo -e "${YELLOW}   ⚠️  Configurazione DNS automatica non riuscita.${NC}"
    echo -e "${YELLOW}   Configurazione manuale necessaria:${NC}"
    echo ""
    echo -e "${CYAN}   Vai su https://dash.cloudflare.com → isroot.in → DNS → Records${NC}"
    echo -e "${CYAN}   Aggiungi un record CNAME:${NC}"
    echo -e "${CYAN}     • Name: unyvox${NC}"
    echo -e "${CYAN}     • Target: ${TUNNEL_ID}.cfargotunnel.com${NC}"
    echo -e "${CYAN}     • Proxy status: Proxied (nuvola arancione)${NC}"
    echo ""
    
    read -p "Premi Invio quando hai aggiunto il record DNS... "
else
    echo -e "${GREEN}   ✓ DNS configurato automaticamente!${NC}"
fi
echo ""

# ============================================
# STEP 5: Configurazione locale
# ============================================
echo -e "${YELLOW}▶ Step 5: Configurazione locale...${NC}"

# Salva dominio e tunnel ID
echo "$DOMAIN" > "${SCRIPT_DIR}/.unyvox-domain"
echo "$TUNNEL_ID" > "${SCRIPT_DIR}/.unyvox-tunnel-id"

# Crea file di configurazione cloudflared
cat > "${SCRIPT_DIR}/cloudflared-config.yml" << EOF
# Configurazione Cloudflare Tunnel per Unyvox
# Generata automaticamente da setup-domain.sh

tunnel: ${TUNNEL_ID}
credentials-file: ${HOME}/.cloudflared/${TUNNEL_ID}.json

# Configurazione ingress
# Cloudflare gestisce automaticamente HTTPS con il certificato SSL
ingress:
  - hostname: ${DOMAIN}
    service: http://localhost:3000
    originRequest:
      # Abilita HTTP/2 verso il server locale
      http2Origin: true
      # Abilita connessioni keep-alive
      keepAliveConnections: 10
      keepAliveTimeout: 90s
  - service: http_status:404
EOF
echo -e "${GREEN}   ✓ cloudflared-config.yml creato${NC}"

# Aggiorna .env con il dominio corretto
ENV_FILE="${SCRIPT_DIR}/.env"
if [ -f "$ENV_FILE" ]; then
    # Aggiorna NEXTAUTH_URL
    if grep -q "NEXTAUTH_URL" "$ENV_FILE"; then
        sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://${DOMAIN}|" "$ENV_FILE"
    else
        echo "NEXTAUTH_URL=https://${DOMAIN}" >> "$ENV_FILE"
    fi
else
    # Crea .env con le variabili base
    cat > "$ENV_FILE" << EOF
# Unyvox Environment Variables
NEXTAUTH_URL=https://${DOMAIN}
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# Database (SQLite per sviluppo)
DATABASE_URL="file:./dev.db"

# Genera un secret casuale per NextAuth
# Puoi generarlo con: openssl rand -base64 32
NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "CAMBIA-ME-CON-UN-SECRET-CASUALE")

# Opzionale: GIPHY API Key per le GIF
# GIPHY_API_KEY=

# Opzionale: OpenAI API Key per la moderazione contenuti
# OPENAI_API_KEY=
EOF
fi
echo -e "${GREEN}   ✓ .env configurato${NC}"

# Aggiorna allowedDevOrigins in next.config.ts se necessario
CONFIG_FILE="${SCRIPT_DIR}/next.config.ts"
if [ -f "$CONFIG_FILE" ]; then
    if ! grep -q "${DOMAIN}" "$CONFIG_FILE"; then
        sed -i "s|allowedDevOrigins: \[|allowedDevOrigins: [\"${DOMAIN}\", |" "$CONFIG_FILE"
        echo -e "${GREEN}   ✓ next.config.ts aggiornato${NC}"
    fi
fi

echo ""

# ============================================
# STEP 6: Installazione dipendenze
# ============================================
echo -e "${YELLOW}▶ Step 6: Installazione dipendenze...${NC}"

cd "${SCRIPT_DIR}"
if [ ! -d "node_modules" ]; then
    echo -e "${CYAN}   Installazione pacchetti npm...${NC}"
    npm install
else
    echo -e "${GREEN}   ✓ node_modules già presente${NC}"
fi

# Genera Prisma client
echo -e "${CYAN}   Generazione Prisma client...${NC}"
npx prisma generate 2>/dev/null || true

# Applica schema al database
echo -e "${CYAN}   Applicazione schema database...${NC}"
npx prisma db push 2>/dev/null || true

echo -e "${GREEN}   ✓ Dipendenze installate${NC}"
echo ""

# ============================================
# STEP 7: Script di avvio
# ============================================
echo -e "${YELLOW}▶ Step 7: Creazione script di avvio...${NC}"

# Aggiorna start-permanent.sh con il dominio corretto
cat > "${SCRIPT_DIR}/start-server.sh" << 'STARTEOF'
#!/bin/bash
# ============================================
# Unyvox - Avvio Server con Tunnel Permanente
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 Unyvox - Avvio Server                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Leggi configurazione
DOMAIN=$(cat "${SCRIPT_DIR}/.unyvox-domain" 2>/dev/null || echo "unyvox.isroot.in")
TUNNEL_ID=$(cat "${SCRIPT_DIR}/.unyvox-tunnel-id" 2>/dev/null || echo "")
CONFIG_FILE="${SCRIPT_DIR}/cloudflared-config.yml"

if [ -z "$TUNNEL_ID" ]; then
    echo -e "${RED}❌ Tunnel ID non trovato. Esegui prima: ./setup-domain.sh${NC}"
    exit 1
fi

# Verifica credenziali tunnel
CREDS_FILE="${HOME}/.cloudflared/${TUNNEL_ID}.json"
if [ ! -f "$CREDS_FILE" ]; then
    echo -e "${RED}❌ Credenziali tunnel non trovate. Esegui prima: ./setup-domain.sh${NC}"
    exit 1
fi

# Ferma processi esistenti
echo -e "${YELLOW}▶ Fermando processi esistenti...${NC}"
pkill -f "node server.mjs" 2>/dev/null || true
pkill -f "cloudflared tunnel run" 2>/dev/null || true
sleep 1
echo -e "${GREEN}   ✓ Processi fermati${NC}"

# Avvia il server Next.js
echo ""
echo -e "${YELLOW}▶ Avvio server Next.js...${NC}"
cd "${SCRIPT_DIR}"
nohup node server.mjs > /tmp/unyvox-server.log 2>&1 &
SERVER_PID=$!
echo -e "${GREEN}   ✓ Server avviato (PID: $SERVER_PID)${NC}"

# Attendi che il server sia pronto
echo -e "${YELLOW}▶ Attesa server...${NC}"
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

# Avvia il tunnel permanente
echo ""
echo -e "${YELLOW}▶ Avvio Cloudflare Tunnel...${NC}"
nohup cloudflared tunnel run --config "${CONFIG_FILE}" "${TUNNEL_ID}" > /tmp/unyvox-tunnel.log 2>&1 &
TUNNEL_PID=$!
echo -e "${GREEN}   ✓ Tunnel avviato (PID: $TUNNEL_PID)${NC}"

# Attendi che il tunnel sia connesso
echo -e "${YELLOW}▶ Attesa connessione tunnel...${NC}"
for i in {1..30}; do
    if grep -q "Registered tunnel connection" /tmp/unyvox-tunnel.log 2>/dev/null; then
        echo -e "${GREEN}   ✓ Tunnel connesso!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}   ⚠️  Tunnel potrebbe non essere ancora connesso${NC}"
    fi
    sleep 1
done

# Riepilogo
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ TUTTO PRONTO!                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🌐 URL stabile:${NC} https://${DOMAIN}"
echo -e "${GREEN}🔗 Locale:${NC} http://localhost:3000"
echo ""
echo -e "${YELLOW}📋 Processi:${NC}"
echo -e "   • Server Next.js:   PID $SERVER_PID (porta 3000)"
echo -e "   • Cloudflare Tunnel: PID $TUNNEL_PID"
echo ""
echo -e "${YELLOW}📋 Log:${NC}"
echo -e "   • Server:  /tmp/unyvox-server.log"
echo -e "   • Tunnel:  /tmp/unyvox-tunnel.log"
echo ""
echo -e "${YELLOW}💡 Per fermare tutto:${NC}"
echo -e "   pkill -f 'node server.mjs' && pkill -f 'cloudflared tunnel run'"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
STARTEOF
chmod +x "${SCRIPT_DIR}/start-server.sh"
echo -e "${GREEN}   ✓ start-server.sh creato${NC}"

# Script di arresto
cat > "${SCRIPT_DIR}/stop-server.sh" << 'EOF'
#!/bin/bash
echo "🔄 Fermamento Unyvox..."
pkill -f "node server.mjs" 2>/dev/null && echo "   ✓ Server fermato" || echo "   ⚠️  Server non era in esecuzione"
pkill -f "cloudflared tunnel run" 2>/dev/null && echo "   ✓ Tunnel fermato" || echo "   ⚠️  Tunnel non era in esecuzione"
echo "✅ Tutto fermato!"
EOF
chmod +x "${SCRIPT_DIR}/stop-server.sh"
echo -e "${GREEN}   ✓ stop-server.sh creato${NC}"

echo ""

# ============================================
# COMPLETATO!
# ============================================
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ SETUP COMPLETATO!                                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}🌐 Il tuo Unyvox sarà disponibile su:${NC}"
echo -e "${GREEN}   https://${DOMAIN}${NC}"
echo ""
echo -e "${YELLOW}📋 Per avviare il server:${NC}"
echo -e "   ./start-server.sh"
echo ""
echo -e "${YELLOW}📋 Per fermare il server:${NC}"
echo -e "   ./stop-server.sh"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo -e "   • Assicurati che i nameservers di isroot.in puntino a Cloudflare"
echo -e "   • Verifica su https://dash.cloudflare.com"
echo -e "   • La propagazione DNS può richiedere fino a 24 ore"
echo ""
echo -e "${CYAN}💡 Il server può essere avviato con:${NC}"
echo -e "   nohup ./start-server.sh &"
echo -e "   (così continua a girare anche dopo aver chiuso il terminale)"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
