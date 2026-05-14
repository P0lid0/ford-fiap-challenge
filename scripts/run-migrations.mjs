#!/usr/bin/env node
/**
 * Aplica todas as migrations SQL em supabase/migrations/ contra o Postgres do projeto.
 *
 * Pré-requisitos:
 *   1) SUPABASE_URL no .env.local (ex: https://<ref>.supabase.co)
 *   2) DATABASE_URL OU SUPABASE_DB_PASSWORD no .env.local
 *      A senha do banco está em Supabase Dashboard → Settings → Database → Connection String.
 *
 * Uso: pnpm db:migrate
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Carrega .env.local manualmente (não dependemos de dotenv para um script simples)
const envPath = join(repoRoot, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

// Constrói a connection string a partir das envs disponíveis.
function buildConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const url = process.env.SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!url || !password) {
    console.error(`
❌ Faltam variáveis no .env.local.

Adicione UMA das opções abaixo:

Opção A — connection string completa (encontra em Settings → Database → Connection String):
  DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres

Opção B — só a senha do banco (que você vê uma única vez ao criar o projeto):
  SUPABASE_DB_PASSWORD=<senha-do-banco>

Plan B alternativo (sem rodar este script): copie e cole o conteúdo de
supabase/migrations/*.sql no Supabase Dashboard → SQL Editor → New Query → Run.
`);
    process.exit(1);
  }
  const ref = new URL(url).hostname.split('.')[0];
  // Pooler do Supabase (porta 6543, modo transaction)
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;
}

const conn = buildConnectionString();
const sql = postgres(conn, { ssl: 'require', max: 1, prepare: false });

try {
  const migrationsDir = join(repoRoot, 'supabase', 'migrations');
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  console.log(`📦 ${files.length} migrations encontradas`);

  await sql.unsafe(`
    create table if not exists public._migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = await sql`select filename from public._migrations`;
  const appliedSet = new Set(applied.map(r => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ⏭  ${file} (já aplicada)`);
      continue;
    }
    const content = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`  🚀 ${file}`);
    try {
      await sql.begin(async tx => {
        await tx.unsafe(content);
        await tx`insert into public._migrations (filename) values (${file})`;
      });
      console.log(`  ✅ ${file}`);
    } catch (err) {
      console.error(`  ❌ ${file}: ${err.message}`);
      throw err;
    }
  }
  console.log('✅ todas as migrations aplicadas');
} finally {
  await sql.end();
}
