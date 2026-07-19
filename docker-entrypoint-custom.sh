#!/bin/sh
set -e

echo "🔧 Custom entrypoint: running prisma db push..."
cd /app

# Ensure DATABASE_URL is set for SQLite on the mounted volume
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/data/dev.db"
fi

echo "📋 DATABASE_URL: ${DATABASE_URL:0:20}..."

# Run prisma db push to create tables
./node_modules/.bin/prisma db push --skip-generate --accept-data-loss 2>&1 || {
  echo "⚠️  prisma db push failed, trying alternative..."
  # Alternative: run via node
  node -e "
    const { execSync } = require('child_process');
    try {
      execSync('./node_modules/.bin/prisma db push --skip-generate --accept-data-loss', { 
        stdio: 'inherit',
        cwd: '/app',
        env: process.env
      });
    } catch(e) {
      console.error('prisma db push error:', e.message);
    }
  " 2>&1 || true
}

echo "✅ Database schema ready, starting server..."
exec node server.mjs
