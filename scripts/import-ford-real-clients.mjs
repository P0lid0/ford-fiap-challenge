#!/usr/bin/env node
/**
 * Importa os 175k VINs Ford reais como clients direto no PostgreSQL.
 *
 * Lê o parquet em services/ml/data/ford_real_base1_full.parquet (convertido
 * pra JSON via Python na 1ª vez) e faz upsert em batches de 500 com
 * INSERT ... ON CONFLICT (vin_hash) DO UPDATE.
 *
 * Conexão: DATABASE_URL (ambiente ou .env.local na raiz).
 *
 * Uso:
 *   node scripts/import-ford-real-clients.mjs                # importa tudo
 *   MAX_VINS=100 node scripts/import-ford-real-clients.mjs   # primeiros 100
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';
import { repoRoot, databaseUrl } from './lib/env.mjs';

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

const PARQUET = resolve(repoRoot, 'services/ml/data/ford_real_base1_full.parquet');
const JSON_CACHE = resolve(repoRoot, 'services/ml/data/ford_real_base1_full.json');
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
  const [existing] = await sql`select id from public.dealerships where nome = 'Ford BR (Real Data)'`;
  if (existing) return existing.id;
  const [created] = await sql`
    insert into public.dealerships ${sql({
      codigo: 'FORD-BR-AGG',
      nome: 'Ford BR (Real Data)',
      cidade: 'Brasil',
      uf: 'BR',
      regiao: 'sudeste',
    })}
    returning id
  `;
  return created.id;
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

// Colunas enviadas em cada batch; no conflito de vin_hash, todas (menos a
// própria chave) são sobrescritas — mesmo comportamento do upsert anterior.
const COLS = [
  'dealership_id', 'vin_hash', 'model_name', 'model_year', 'dealer_code_venda', 'dealer_codes_revisao',
  'sales_date', 'delivery_date', 'warranty_start_date', 'primeiro_servico', 'ultimo_servico',
  'km_max', 'num_revisoes', 'num_servicos_total', 'dias_ate_1a_revisao', 'dias_desde_ultima_revisao',
  'dealer_loyalty', 'taxa_aderencia_km', 'revisoes_por_ano', 'perfil_real',
  'is_ford_real', 'data_source', 'data_compra',
];

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
    const batchRecs = records.slice(i, Math.min(i + BATCH, total));
    const rows = batchRecs.map(r => buildRow(r, dealershipId));
    try {
      const result = await sql`
        insert into public.clients ${sql(rows, ...COLS)}
        on conflict (vin_hash) do update set
          dealership_id             = excluded.dealership_id,
          model_name                = excluded.model_name,
          model_year                = excluded.model_year,
          dealer_code_venda         = excluded.dealer_code_venda,
          dealer_codes_revisao      = excluded.dealer_codes_revisao,
          sales_date                = excluded.sales_date,
          delivery_date             = excluded.delivery_date,
          warranty_start_date       = excluded.warranty_start_date,
          primeiro_servico          = excluded.primeiro_servico,
          ultimo_servico            = excluded.ultimo_servico,
          km_max                    = excluded.km_max,
          num_revisoes              = excluded.num_revisoes,
          num_servicos_total        = excluded.num_servicos_total,
          dias_ate_1a_revisao       = excluded.dias_ate_1a_revisao,
          dias_desde_ultima_revisao = excluded.dias_desde_ultima_revisao,
          dealer_loyalty            = excluded.dealer_loyalty,
          taxa_aderencia_km         = excluded.taxa_aderencia_km,
          revisoes_por_ano          = excluded.revisoes_por_ano,
          perfil_real               = excluded.perfil_real,
          is_ford_real              = excluded.is_ford_real,
          data_source               = excluded.data_source,
          data_compra               = excluded.data_compra
        returning id
      `;
      inserted += result.length;
    } catch (err) {
      errors++;
      console.error(`   ✗ batch ${Math.floor(i / BATCH) + 1}/${nBatches}: ${err.message}`);
      continue;
    }
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

try {
  await main();
} catch (e) {
  console.error('❌', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
