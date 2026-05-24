#!/usr/bin/env node
/**
 * Limpa o catálogo de veículos pra deixar APENAS as 3 versões da Ford Ranger 26MY
 * que vieram do datasheet oficial Ford (D1).
 *
 * Ranger que ficam:
 *   - Ford Ranger XLT 3.0L V6 AT 26MY
 *   - Ford Ranger Limited 3.0L V6 26MY
 *   - Ford Ranger Limited + 3.0L V6 26MY
 *
 * Cascata automática:
 *   - vehicle_catalog_values (FK ON DELETE CASCADE) → some junto
 *
 * IMPORTANTE: ação destrutiva e autorizada explicitamente pelo usuário.
 */
import { readFileSync, existsSync } from 'node:fs';
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
if (!PAT) {
  console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente antes de rodar este script.');
  process.exit(1);
}
const REF = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];

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

// === auditoria antes ===
const before = await runSQL('select count(*)::int as n from public.vehicles');
const keep = await runSQL(`
  select id, versao
  from public.vehicles
  where lower(marca)='ford' and lower(modelo)='ranger' and ano=2026
  order by versao;
`);
console.log('📊 Antes:', before[0].n, 'veículos');
console.log('🛡  Vou MANTER:');
for (const r of keep) console.log(`   - ${r.id.slice(0,8)}…  ${r.versao}`);
console.log(`🗑  Vou APAGAR: ${before[0].n - keep.length} veículos`);

if (keep.length !== 3) {
  console.error('\n❌ Esperava 3 Ranger 26MY. Achei', keep.length, '— abortando.');
  process.exit(1);
}

// === delete ===
const keepIds = keep.map(r => `'${r.id}'`).join(',');
const sql = `delete from public.vehicles where id not in (${keepIds});`;
console.log('\n🚀 Executando DELETE…');
await runSQL(sql);

// === auditoria depois ===
const after = await runSQL('select count(*)::int as n from public.vehicles');
const afterValues = await runSQL('select count(*)::int as n from public.vehicle_catalog_values');
console.log(`✅ Restam ${after[0].n} veículos no catálogo`);
console.log(`✅ ${afterValues[0].n} valores canônicos (esperado: ${3 * 262} = 786)`);
