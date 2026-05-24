#!/usr/bin/env node
/**
 * Popula o schema canônico Ford D1 (262 itens × 14 seções) a partir de
 * services/ml/data/ford-d1-ranger-26my.json.
 *
 * Etapa 1: insere TODAS as 262 linhas em public.catalog_items (idempotente
 *          via ON CONFLICT em (secao, nome)).
 * Etapa 2: para cada um dos 3 trims da Ranger 26MY (XLT, Limited, Limited+),
 *          encontra o vehicle_id correspondente em public.vehicles e
 *          preenche public.vehicle_catalog_values (valor X / 0 / numérico).
 *
 * Usa Supabase Management API (não exige DB password).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// .env.local
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

// ----------------------------------------------------------------
// Heurística para inferir o tipo de campo
// ----------------------------------------------------------------
function inferTipo(item, allValues) {
  // Se todos os valores não-vazios são "X" ou "0", é flag
  const nonEmpty = allValues.filter(v => v != null && String(v).trim() !== '');
  if (nonEmpty.length === 0) return 'flag';
  const allFlag = nonEmpty.every(v => {
    const s = String(v).trim().toUpperCase();
    return s === 'X' || s === '0';
  });
  if (allFlag) return 'flag';
  // Se todos não-flag são numéricos, é numeric
  const allNumeric = nonEmpty.every(v => {
    const s = String(v).trim();
    if (s === 'X' || s === '0') return true;
    return !isNaN(Number(s));
  });
  if (allNumeric) return 'numeric';
  return 'text';
}

function inferUnidade(item) {
  const i = item.toLowerCase();
  if (i.includes('peso')) return 'kg';
  if (i.includes('cilindrada')) return 'L';
  if (i.includes('potência') || i.includes('potencia')) return 'cv';
  if (i.includes('torque')) return 'Nm';
  if (i.includes('economia') || i.includes('consumo')) return 'km/l';
  if (i.includes('polegadas') || i.includes('aro')) return '"';
  if (i.includes('marchas')) return null;
  if (i.includes('anos de garantia')) return 'anos';
  if (i.includes('volts') || i.includes('110v') || i.includes('12v')) return 'V';
  if (i.includes('litros')) return 'L';
  return null;
}

function sqlEscape(s) {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

// ----------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------
const DATA_PATH = join(root, 'services', 'ml', 'data', 'ford-d1-ranger-26my.json');
const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));

console.log('📦 Lendo schema canônico Ford D1…');
console.log(`   • ${Object.keys(data.sections).length} seções`);

// === Etapa 1: catalog_items ===
const rows = [];
let ordemGlobal = 0;
for (const [secao, items] of Object.entries(data.sections)) {
  items.forEach((it, idx) => {
    ordemGlobal++;
    const allVals = [it.xlt, it.limited, it.limited_plus];
    rows.push({
      secao,
      ordem: idx + 1,
      ordem_global: ordemGlobal,
      nome: it.item,
      tipo: inferTipo(it.item, allVals),
      unidade: inferUnidade(it.item),
    });
  });
}
console.log(`   • ${rows.length} atributos no total`);

console.log('\n🚀 Inserindo catalog_items (idempotente)…');
const BATCH = 50;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const values = chunk.map(r => `(
    ${sqlEscape(r.secao)},
    ${r.ordem},
    ${r.ordem_global},
    ${sqlEscape(r.nome)},
    ${sqlEscape(r.tipo)}::catalog_item_type,
    ${sqlEscape(r.unidade)}
  )`).join(',\n  ');
  const sql = `
    insert into public.catalog_items (secao, ordem, ordem_global, nome, tipo, unidade)
    values ${values}
    on conflict (secao, nome) do update set
      ordem = excluded.ordem,
      ordem_global = excluded.ordem_global,
      tipo = excluded.tipo,
      unidade = excluded.unidade;
  `;
  await runSQL(sql);
  process.stdout.write(`   ✓ ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
}
console.log(`\n   ✅ ${rows.length} itens canônicos OK`);

// === Etapa 2: encontrar vehicle_ids dos 3 trims ===
console.log('\n🔍 Buscando os 3 Ranger 26MY em public.vehicles…');
const trims = [
  { key: 'xlt',          versao: 'XLT 3.0L V6 AT 26MY' },
  { key: 'limited',      versao: 'Limited 3.0L V6 26MY' },
  { key: 'limited_plus', versao: 'Limited + 3.0L V6 26MY' },
];

const vehiclesQ = await runSQL(`
  select id, versao
  from public.vehicles
  where lower(marca) = 'ford' and lower(modelo) = 'ranger' and ano = 2026;
`);
const byVersao = Object.fromEntries(vehiclesQ.map(v => [v.versao, v.id]));
for (const t of trims) {
  const id = byVersao[t.versao];
  if (id) console.log(`   ✓ ${t.versao} → ${id.slice(0, 8)}…`);
  else console.log(`   ⚠️  ${t.versao}: não encontrado no catálogo (pulado)`);
  t.id = id;
}

const foundTrims = trims.filter(t => t.id);
if (foundTrims.length === 0) {
  console.error('\n❌ Nenhum Ranger 26MY encontrado. Rode antes scripts/import-ford-d1-ranger.py.');
  process.exit(1);
}

// === Etapa 3: vehicle_catalog_values ===
console.log('\n🔄 Mapeando item-name → item-id…');
const itemsQ = await runSQL(`select id, secao, nome from public.catalog_items;`);
const itemId = new Map();
for (const r of itemsQ) itemId.set(`${r.secao}::${r.nome}`, r.id);
console.log(`   ✓ ${itemId.size} itens no map`);

console.log('\n📝 Inserindo vehicle_catalog_values…');
const vcvRows = [];
for (const [secao, items] of Object.entries(data.sections)) {
  for (const it of items) {
    const id = itemId.get(`${secao}::${it.item}`);
    if (!id) {
      console.warn(`   ⚠️  item-id não achado: [${secao}] ${it.item}`);
      continue;
    }
    for (const t of foundTrims) {
      const valor = it[t.key];
      vcvRows.push({
        vehicle_id: t.id,
        item_id: id,
        valor: valor == null ? null : String(valor).trim(),
      });
    }
  }
}
console.log(`   • ${vcvRows.length} valores (262 × ${foundTrims.length} trims)`);

for (let i = 0; i < vcvRows.length; i += BATCH) {
  const chunk = vcvRows.slice(i, i + BATCH);
  const values = chunk.map(r => `(
    ${sqlEscape(r.vehicle_id)}::uuid,
    ${sqlEscape(r.item_id)}::uuid,
    ${sqlEscape(r.valor)},
    'alta',
    'Ford D1 26MY (datasheet oficial)'
  )`).join(',\n  ');
  const sql = `
    insert into public.vehicle_catalog_values (vehicle_id, item_id, valor, confianca, fonte)
    values ${values}
    on conflict (vehicle_id, item_id) do update set
      valor = excluded.valor,
      confianca = excluded.confianca,
      fonte = excluded.fonte,
      updated_at = now();
  `;
  await runSQL(sql);
  process.stdout.write(`   ✓ ${Math.min(i + BATCH, vcvRows.length)}/${vcvRows.length}\r`);
}
console.log(`\n   ✅ ${vcvRows.length} valores inseridos`);

// === Resumo final ===
const [{ count: itemCount }] = await runSQL(`select count(*)::int as count from public.catalog_items;`);
const [{ count: valueCount }] = await runSQL(`select count(*)::int as count from public.vehicle_catalog_values;`);
console.log(`\n✅ FIM`);
console.log(`   catalog_items: ${itemCount}`);
console.log(`   vehicle_catalog_values: ${valueCount}`);
