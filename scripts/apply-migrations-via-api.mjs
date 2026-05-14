#!/usr/bin/env node
/**
 * Aplica migrations via Supabase Management API (precisa PAT em SUPABASE_ACCESS_TOKEN).
 * Não precisa de DB password — usa o endpoint /v1/projects/{ref}/database/query.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = join(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
if (!PAT) { console.error('❌ defina SUPABASE_ACCESS_TOKEN'); process.exit(1); }

async function runSQL(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : [];
}

const dir = join(root, 'supabase', 'migrations');
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
console.log(`📦 ${files.length} migrations\n`);

// Cria a tabela de controle primeiro
await runSQL(`create table if not exists public._migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);`);

const applied = await runSQL(`select filename from public._migrations`);
const appliedSet = new Set(applied.map(r => r.filename));

for (const file of files) {
  if (appliedSet.has(file)) {
    console.log(`⏭  ${file} (já aplicada)`);
    continue;
  }
  const sql = readFileSync(join(dir, file), 'utf-8');
  console.log(`🚀 ${file}`);
  try {
    // Tudo em uma única transação implícita via API
    await runSQL(sql);
    await runSQL(`insert into public._migrations(filename) values ('${file}')`);
    console.log(`✅ ${file}\n`);
  } catch (e) {
    console.error(`❌ ${file}\n   ${e.message}\n`);
    process.exit(1);
  }
}
console.log('✅ todas aplicadas');
