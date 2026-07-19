#!/bin/bash
set -e

echo "🚀 Preparazione deploy su Vercel con PostgreSQL..."

# Usa lo schema PostgreSQL per il deploy
cp prisma/schema.postgresql.prisma prisma/schema.prisma

# Rigenera il client Prisma
npx prisma generate

# Verifica build locale
npm run build

echo "✅ Pronto per il deploy su Vercel."
echo "   Ricorda di impostare le variabili d'ambiente su Vercel:"
echo "   - DATABASE_URL (connection string PostgreSQL, es. da Supabase)"
echo "   - NEXTAUTH_SECRET (stringa casuale sicura)"
echo "   - NEXTAUTH_URL (URL dell'app su Vercel)"
echo ""
echo "   Esegui: npx vercel --prod"
