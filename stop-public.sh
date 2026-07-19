#!/bin/bash
# ============================================
# Unyvox - Ferma Server + Tunnel
# ============================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

kill_pid_file() {
    local file=$1
    local name=$2
    if [ -f "$file" ]; then
        local pid=$(cat "$file")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            echo -e "${YELLOW}▶ Fermato ${name} (PID: ${pid})${NC}"
        fi
        rm -f "$file"
    fi
}

echo -e "${YELLOW}▶ Fermando i processi di Unyvox...${NC}"

kill_pid_file "/tmp/univox-server.pid" "server Next.js"
kill_pid_file "/tmp/univox-redirect.pid" "redirect server"
kill_pid_file "/tmp/univox-tunnel.pid" "tunnel Cloudflare"
kill_pid_file "/tmp/univox-watcher.pid" "tunnel watcher"

# Fallback per processi rimasti
pkill -f "node server.mjs" 2>/dev/null || true
pkill -f "node redirect-server.js" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://localhost:3000" 2>/dev/null || true
pkill -f "tunnel-watcher.sh" 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Tutto fermato!${NC}"
