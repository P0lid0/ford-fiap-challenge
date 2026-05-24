#!/usr/bin/env node
/**
 * Popula o catálogo com a linha Ford BR (2018+).
 * Usa /competitive/search/fipe para garantir dados FIPE oficiais.
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

const API = process.env.API_URL || 'http://127.0.0.1:3333';
const SB_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;

if (!SB_URL || !ANON) { console.error('falta SUPABASE_URL/ANON_KEY'); process.exit(1); }

// === Login admin ===
async function getToken() {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@faroai.com.br', password: 'Ford2026!' }),
  });
  const j = await r.json();
  return j.access_token;
}

async function authedGet(path, token) {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}
async function authedPost(path, body, token) {
  const r = await fetch(API + path, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

const FORD = '22';
// Bases de modelo que queremos no catálogo (linha BR + relevantes)
const BASES = ['Ranger', 'Bronco', 'Maverick', 'Territory', 'EcoSport', 'Ka', 'Fiesta', 'Focus', 'Mustang', 'Edge', 'Fusion', 'F-250', 'F-1000', 'Courier'];
const MAX_VERSOES_POR_BASE = 4;  // top N versões por modelo base
const ANO_MIN = 2018;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const token = await getToken();
  console.log('🔑 autenticado');

  const grupos = await authedGet(`/competitive/fipe/modelos-agrupados/${FORD}`, token);
  console.log(`📋 ${grupos.length} grupos Ford no FIPE`);

  let ok = 0, skip = 0, fail = 0;

  for (const grupo of grupos) {
    if (!BASES.includes(grupo.base)) continue;
    console.log(`\n📦 ${grupo.base} — ${grupo.count} versões totais, processando top ${MAX_VERSOES_POR_BASE}`);

    // FIPE retorna em ordem cronológica (mais antigas primeiro) — pegamos as últimas
    const versoes = grupo.versoes.slice(-MAX_VERSOES_POR_BASE).reverse();

    for (const v of versoes) {
      try {
        const anos = await authedGet(`/competitive/fipe/anos?marcaCodigo=${FORD}&modeloCodigo=${v.codigo}`, token);
        const recentes = anos
          .filter(a => parseInt(a.codigo.slice(0, 4)) >= ANO_MIN)
          .slice(0, 1); // só o mais recente
        if (recentes.length === 0) { skip++; continue; }

        for (const a of recentes) {
          process.stdout.write(`   • ${v.nome} (${a.codigo.slice(0, 4)}): `);
          const r = await authedPost('/competitive/search/fipe', {
            marca_codigo: FORD, modelo_codigo: v.codigo, ano_codigo: a.codigo,
          }, token);
          const veh = r.vehicle;
          console.log(`✓ ${r.source}, pot=${veh.motor?.potencia_cv ?? '—'}cv, preço=${veh.preco_brl ? `R$ ${(veh.preco_brl/1000).toFixed(0)}k` : '—'}`);
          ok++;
          await sleep(800); // educado com OpenAI rate limit
        }
      } catch (e) {
        console.log(`   ✗ ${v.nome}: ${e.message.slice(0, 80)}`);
        fail++;
      }
    }
  }

  console.log(`\n✅ FIM: ${ok} ingeridos, ${skip} sem dados >= ${ANO_MIN}, ${fail} falharam`);
}

main().catch(e => { console.error(e); process.exit(1); });
