#!/bin/bash
set -e

REPO_URL="https://github.com/tuo-username/unyvox/archive/refs/heads/main.tar.gz"
APP_DIR="unyvox"

echo "📦 Scaricamento Unyvox..."

if command -v wget &> /dev/null; then
  wget -O "${APP_DIR}.tar.gz" "$REPO_URL"
elif command -v curl &> /dev/null; then
  curl -L -o "${APP_DIR}.tar.gz" "$REPO_URL"
else
  echo "❌ Installa wget o curl per continuare."
  exit 1
fi

echo "📂 Estrazione..."
tar -xzf "${APP_DIR}.tar.gz"
mv "${APP_DIR}-main" "$APP_DIR"
cd "$APP_DIR"

echo "⚙️ Installazione dipendenze..."
npm install

echo "🗄️ Setup database..."
npx prisma generate
npx prisma db push --accept-data-loss
npx tsx prisma/seed.ts

echo "🚀 Avvio applicazione..."
npm run dev
