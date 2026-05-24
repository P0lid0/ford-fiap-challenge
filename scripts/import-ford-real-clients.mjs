#!/usr/bin/env node
/**
 * Importa os 175k VINs Ford reais como clients via PostgREST (sem Management API).
 *
 * Lê o parquet em services/ml/data/ford_real_base1_full.parquet e faz upsert
 * em batches via supabase-js com SERVICE_ROLE — bypassa RLS, rápido.
 *
 * Variáveis de ambiente lidas de .env.local:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   node scripts/import-ford-real-clients.mjs                # importa tudo
 *   MAX_VINS=100 node scripts/import-ford-real-clients.mjs   # primeiros 100
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Lê .env.local
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const PARQUET = resolve(root, 'services/ml/data/ford_real_base1_full.parquet');
const JSON_CACHE = resolve(root, 'services/ml/data/ford_real_base1_full.json');
const BATCH = 500;
const MAX = parseInt(process.env.MAX_VINS || '0', 10) || null;

// ===== Converte parquet → JSON via Python (1ª vez) =====
function ensureJson() {
  if (existsSync(JSON_CACHE)) {
    const stat = (p) => existsSync(p) ? Number(readFileSync(p).length) : 0;
    if (stat(JSON_CACHE) > 100) return;
  }
  console.log('📂 Convertendo parquet → JSON (~30s)…');
  const py = spawnSync('python', ['-c', `
import pandas as pd, json, sys
sys.stdout.reconfigure(encoding='utf-8')
df = pd.read_parquet(r'${PARQUET.replace(/\\/g, '/')}')
# converte timestamps → strings
for col in df.columns:
    if df[col].dtype.kind == 'M':
        df[col] = df[col].dt.strftime('%Y-%m-%d')
import math
# converte NaN/inf → None
recs = df.to_dict(orient='records')
clean = []
for r in recs:
    obj = {}
    for k, v in r.items():
        if v is None:
            obj[k] = None
        elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            obj[k] = None
        elif hasattr(v, 'isoformat'):
            obj[k] = v.isoformat()
        else:
            obj[k] = v
    clean.append(obj)
with open(r'${JSON_CACHE.replace(/\\/g, '/')}', 'w', encoding='utf-8') as f:
    json.dump(clean, f, ensure_ascii=False, allow_nan=False, default=str)
print(f'  {len(clean):,} linhas salvas')
`], { stdio: 'inherit' });
  if (py.status !== 0) throw new Error('Falha ao converter parquet');
}

// ===== Garante dealership virtual Ford BR =====
async function ensureFordDealership() {
  const { data: existing } = await sb.from('dealerships').select('id').eq('nome', 'Ford BR (Real Data)').maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await sb.from('dealerships').insert({
    codigo: 'FORD-BR-AGG',
    nome: 'Ford BR (Real Data)',
    cidade: 'Brasil',
    uf: 'BR',
    regiao: 'sudeste',
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

// ===== Monta row no formato da tabela clients =====
function buildRow(record, dealershipId) {
  const clampSmallInt = (v) => v == null ? null : Math.max(-32768, Math.min(32767, Math.trunc(Number(v))));
  const numOrNull = (v) => (v == null || Number.isNaN(Number(v))) ? null : Number(v);
  const intOrNull = (v) => (v == null || Number.isNaN(Number(v))) ? null : Math.trunc(Number(v));
  const dateOrNull = (v) => (v == null || v === '' || v === 'NaT') ? null : String(v).slice(0, 10);

  const dealerRev = record.dealer_revisao_mais_freq;
  const dealerCodesRevisao = (dealerRev != null && !Number.isNaN(Number(dealerRev)))
    ? [intOrNull(dealerRev)] : [];

  return {
    dealership_id: dealershipId,
    vin_hash: String(record.VIN_Hash),
    model_name: record.modelo || null,
    model_year: intOrNull(record.ano_modelo),
    dealer_code_venda: intOrNull(record.dealer_venda),
    dealer_codes_revisao: dealerCodesRevisao,
    sales_date: dateOrNull(record.data_venda),
    delivery_date: dateOrNull(record.data_entrega),
    warranty_start_date: dateOrNull(record.data_garantia),
    primeiro_servico: dateOrNull(record.primeiro_servico),
    ultimo_servico: dateOrNull(record.ultimo_servico),
    km_max: Math.min(intOrNull(record.km_max) ?? 0, 2_000_000) || null,
    num_revisoes: clampSmallInt(record.num_revisoes),
    num_servicos_total: intOrNull(record.num_servicos_total),
    dias_ate_1a_revisao: clampSmallInt(record.dias_ate_1a_revisao),
    dias_desde_ultima_revisao: clampSmallInt(record.dias_desde_ultima_revisao),
    dealer_loyalty: numOrNull(record.dealer_loyalty),
    taxa_aderencia_km: Math.min(numOrNull(record.taxa_aderencia_km) ?? 0, 999.99) || null,
    revisoes_por_ano: Math.min(numOrNull(record.revisoes_por_ano) ?? 0, 999.99) || null,
    perfil_real: ['fiel', 'abandono', 'esquecido', 'economico'].includes(record.perfil_real) ? record.perfil_real : null,
    is_ford_real: true,
    data_source: 'vin_share_Desafio_02',
    data_compra: dateOrNull(record.data_venda) || new Date().toISOString().slice(0, 10),
  };
}

async function main() {
  ensureJson();
  console.log('📂 Lendo JSON cache…');
  const records = JSON.parse(readFileSync(JSON_CACHE, 'utf-8'));
  const total = MAX ? Math.min(records.length, MAX) : records.length;
  console.log(`   ${total.toLocaleString()} VINs a importar`);

  console.log("🏢 Garantindo dealership 'Ford BR (Real Data)'…");
  const dealershipId = await ensureFordDealership();
  console.log(`   id = ${dealershipId}`);

  const t0 = Date.now();
  let inserted = 0, errors = 0;
  const nBatches = Math.ceil(total / BATCH);

  for (let i = 0; i < total; i += BATCH) {
    const batchRecs = records.slice(i, i + BATCH);
    const rows = batchRecs.map(r => buildRow(r, dealershipId));
    const { data, error } = await sb.from('clients').upsert(rows, { onConflict: 'vin_hash', defaultToNull: false }).select('id');
    if (error) {
      errors++;
      console.error(`   ✗ batch ${Math.floor(i / BATCH) + 1}/${nBatches}: ${error.message}`);
      continue;
    }
    inserted += data?.length ?? batchRecs.length;
    const elapsed = (Date.now() - t0) / 1000;
    const rate = inserted / elapsed;
    const eta = (total - inserted) / rate;
    const bi = Math.floor(i / BATCH) + 1;
    process.stdout.write(
      `   ✓ batch ${bi}/${nBatches}  ${inserted.toLocaleString()}/${total.toLocaleString()}  ` +
      `(${rate.toFixed(0)}/s · ETA ${eta.toFixed(0)}s)\n`
    );
  }

  const elapsed = (Date.now() - t0) / 1000;
  console.log(`\n✓ ${inserted.toLocaleString()} VINs importados em ${elapsed.toFixed(1)}s ` +
              `(${(inserted/elapsed).toFixed(0)}/s · ${errors} erros)`);
}

main().catch(e => { console.error(e); process.exit(1); });
