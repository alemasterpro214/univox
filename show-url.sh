#!/bin/bash
# Mostra l'URL pubblico corrente
URL=$(cat /tmp/univox-current-url.txt 2>/dev/null)
if [ ! -z "$URL" ]; then
    echo "🌐 URL Pubblico: $URL"
else
    echo "⚠️ Nessun tunnel attivo. Esegui: ./start-public.sh"
fi
