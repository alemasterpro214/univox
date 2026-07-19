#!/bin/bash
# ============================================
# Unyvox - Tunnel URL Watcher
# ============================================
# Watches cloudflared tunnel log and:
# 1. Saves current URL to a file
# 2. Updates DuckDNS when IP changes
# 3. Creates a redirect page with current URL
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Carica variabili d'ambiente da .env se esiste
if [ -f "${SCRIPT_DIR}/.env" ]; then
    source "${SCRIPT_DIR}/.env"
fi

DUCKDNS_DOMAIN=${DUCKDNS_DOMAIN:-unyvox}
DUCKDNS_TOKEN=${DUCKDNS_TOKEN:-}

if [ -z "$DUCKDNS_TOKEN" ]; then
    echo "❌ Errore: DUCKDNS_TOKEN non impostato."
    echo "   Crea un file .env da .env.example e inserisci il tuo token DuckDNS."
    exit 1
fi

TUNNEL_LOG="/tmp/univox-tunnel.log"
URL_FILE="/tmp/univox-current-url.txt"
REDIRECT_FILE="/tmp/univox-redirect.html"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   👁️  Unyvox - Tunnel Watcher${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to update DuckDNS TXT record with the current tunnel URL
# This allows a static GitHub Pages redirect to follow the temporary Cloudflare URL.
update_duckdns() {
    local url=$1
    if [ -z "$url" ]; then
        echo -e "${YELLOW}⚠ URL vuoto, salto aggiornamento DuckDNS${NC}"
        return 1
    fi
    curl -s "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&txt=${url}" > /dev/null
    echo -e "${GREEN}✓ DuckDNS TXT aggiornato con: ${url}${NC}"
}

# Function to create redirect page
create_redirect_page() {
    local url=$1
    cat > "$REDIRECT_FILE" << EOF
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unyvox - Link Pubblico</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            padding: 40px;
            max-width: 500px;
        }
        .logo {
            font-size: 48px;
            margin-bottom: 20px;
        }
        h1 {
            font-size: 32px;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #00d2ff, #3a7bd5);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .url-box {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 12px;
            padding: 20px;
            margin: 30px 0;
            word-break: break-all;
        }
        .url {
            color: #00d2ff;
            font-size: 18px;
            text-decoration: none;
            transition: opacity 0.2s;
        }
        .url:hover { opacity: 0.8; }
        .btn {
            display: inline-block;
            background: linear-gradient(90deg, #00d2ff, #3a7bd5);
            color: white;
            padding: 15px 40px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: bold;
            font-size: 18px;
            transition: transform 0.2s, box-shadow: 0 0 0 transparent;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,210,255,0.3);
        }
        .note {
            margin-top: 30px;
            font-size: 14px;
            color: rgba(255,255,255,0.5);
        }
        .auto-refresh {
            margin-top: 20px;
            font-size: 12px;
            color: rgba(255,255,255,0.3);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚀</div>
        <h1>Unyvox</h1>
        <p style="color: rgba(255,255,255,0.7); margin-bottom: 20px;">
            Il tuo social network personale
        </p>
        <div class="url-box">
            <p style="color: rgba(255,255,255,0.5); margin-bottom: 10px; font-size: 14px;">
                Link attuale:
            </p>
            <a href="${url}" class="url" target="_blank">${url}</a>
        </div>
        <a href="${url}" class="btn" target="_blank">
            Apri Unyvox →
        </a>
        <p class="note">
            Questo link si aggiorna automaticamente quando il tunnel cambia.
        </p>
        <p class="auto-refresh">
            La pagina si ricarica ogni 30 secondi per controllare aggiornamenti.
        </p>
    </div>
    <script>
        // Auto-refresh every 30 seconds to check for new URL
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>
EOF
    echo -e "${GREEN}✓ Pagina redirect aggiornata: ${REDIRECT_FILE}${NC}"
}

# Main loop - watch tunnel log
echo -e "${YELLOW}▶ In attesa del tunnel...${NC}"
LAST_URL=""

while true; do
    if [ -f "$TUNNEL_LOG" ]; then
        # Extract current URL from log
        CURRENT_URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | tail -1)
        
        if [ ! -z "$CURRENT_URL" ] && [ "$CURRENT_URL" != "$LAST_URL" ]; then
            echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${GREEN}🔗 Nuovo URL rilevato!${NC}"
            echo -e "${BLUE}   ${CURRENT_URL}${NC}"
            echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            
            # Save URL to file
            echo "$CURRENT_URL" > "$URL_FILE"
            
            # Update DuckDNS TXT record with current tunnel URL
            update_duckdns "${CURRENT_URL}"
            
            # Create/update redirect page
            create_redirect_page "$CURRENT_URL"
            
            LAST_URL="$CURRENT_URL"
            
            echo ""
            echo -e "${YELLOW}📋 URL permanente (redirect):${NC}"
            echo -e "${GREEN}   Apri il file: ${REDIRECT_FILE}${NC}"
            echo -e "${YELLOW}   Oppure apri: http://localhost:3001${NC}"
            echo ""
        fi
    fi
    sleep 5
done
