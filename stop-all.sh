#!/bin/bash
# ============================================
# Unyvox - Ferma Tutto
# ============================================

echo "🔄 Fermamento Unyvox..."

# Ferma server
pkill -f "node server.mjs" 2>/dev/null && echo "   ✓ Server fermato" || echo "   ⚠️  Server non era in esecuzione"

# Ferma tunnel
pkill -f "ssh.*localhost.run" 2>/dev/null && echo "   ✓ Tunnel fermato" || echo "   ⚠️  Tunnel non era in esecuzione"

# Ferma watchdog
pkill -f "keep-tunnel.sh" 2>/dev/null && echo "   ✓ Watchdog fermato" || echo "   ⚠️  Watchdog non era in esecuzione"

# Pulisci PID file
rm -f /tmp/unyvox-pids.txt

echo ""
echo "✅ Tutto fermato!"
