#!/usr/bin/env bash
# Aplica todas as migrations + seed inicial usando Supabase CLI.
# Pré-req: SUPABASE_ACCESS_TOKEN (sbp_*) no env, ./supabase.exe na raiz.
set -e

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ defina SUPABASE_ACCESS_TOKEN=sbp_... antes de rodar"
  exit 1
fi

REF=wafphrldcghbqxdclypp

# 1. Linka o projeto
echo "🔗 linkando projeto $REF"
./supabase.exe link --project-ref "$REF" --password "" 2>&1 || echo "(link sem db-password — ok se for só push)"

# 2. Push das migrations (cria todas as tabelas + RLS + seeds)
echo "🚀 push das migrations"
./supabase.exe db push --linked 2>&1

# 3. Seed dos veículos via REST (não precisa do CLI)
echo "🌱 seed de veículos"
node scripts/seed-vehicles.mjs

# 4. Fetch da anon key + atualiza .env.local
echo "🔑 buscando anon key"
ANON=$(./supabase.exe projects api-keys --project-ref "$REF" 2>&1 | grep "anon" | awk '{print $NF}' | head -1)
if [ -n "$ANON" ]; then
  echo "   anon key encontrada (${#ANON} chars)"
  # Atualiza .env.local e apps/mobile/.env.local
  sed -i "s|SUPABASE_ANON_KEY=.*|SUPABASE_ANON_KEY=$ANON|" .env.local
  sed -i "s|EXPO_PUBLIC_SUPABASE_ANON_KEY=.*|EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON|" .env.local
  sed -i "s|EXPO_PUBLIC_SUPABASE_ANON_KEY=.*|EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON|" apps/mobile/.env.local
  echo "   .env.local atualizado"
else
  echo "⚠ não consegui pegar anon key automaticamente. Pegue manualmente em Settings → API"
fi

echo "✅ tudo pronto"
