#!/usr/bin/env node
/**
 * Aplica as migrations SQL de db/migrations/ contra o PostgreSQL da DATABASE_URL.
 *
 * - Controle em public.schema_migrations (name, applied_at).
 * - Ordem alfabética; cada arquivo roda numa transação própria.
 * - Idempotente: arquivo já registrado é pulado.
 *
 * Uso:
 *   pnpm db:migrate            aplica as pendentes
 *   pnpm db:migrate:status     lista aplicadas/pendentes sem alterar nada
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { repoRoot, databaseUrl } from './lib/env.mjs';

const statusOnly = process.argv.includes('--status');
const migrationsDir = join(repoRoot, 'db', 'migrations');

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

try {
  await sql.unsafe(`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const applied = new Set((await sql`select name from public.schema_migrations`).map(r => r.name));
  const pending = files.filter(f => !applied.has(f));

  if (statusOnly) {
    console.log(`📦 ${files.length} migrations em db/migrations (${applied.size} aplicadas, ${pending.length} pendentes)`);
    for (const f of files) console.log(`  ${applied.has(f) ? '✅' : '⏳'} ${f}`);
  } else {
    await applyPending(files, pending);
  }
} finally {
  await sql.end();
}

async function applyPending(files, pending) {
  console.log(`📦 ${files.length} migrations encontradas — ${pending.length} pendentes`);
  for (const file of pending) {
    const content = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log(`  🚀 ${file}`);
    try {
      // Cada arquivo numa transação própria: falhou, nada dele fica aplicado
      // e o nome não é registrado — corrige e roda de novo.
      await sql.begin(async tx => {
        await tx.unsafe(content);
        await tx`insert into public.schema_migrations (name) values (${file})`;
      });
      console.log(`  ✅ ${file}`);
    } catch (err) {
      console.error(`  ❌ ${file}: ${err.message}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log('✅ banco atualizado');
}
