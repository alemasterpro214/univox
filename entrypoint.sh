#!/bin/sh
set -e

cd /app

# Ensure DATABASE_URL points to the persistent volume
export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"

echo "🔧 [entrypoint] DATABASE_URL set" >&2

# Run prisma db push to create/update tables
echo "🗄️  [entrypoint] Running prisma db push..." >&2
./node_modules/.bin/prisma db push --skip-generate --accept-data-loss 2>&1
echo "✅ [entrypoint] Database schema ready" >&2

# Execute the original command (node server.mjs)
exec "$@"
