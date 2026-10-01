#!/usr/bin/env node
/**
 * Popula o catálogo com a linha Ford BR (2018+).
 * Usa /competitive/search/fipe para garantir dados FIPE oficiais.
 *
 * Só fala HTTP com a API (API_URL, default http://127.0.0.1:3333); o login é
 * feito em POST /auth/login com o admin de demo (ADMIN_EMAIL/ADMIN_PASSWORD).
 */
import { apiUrl } from './lib/env.mjs';

const API = apiUrl();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@faroai.com.br';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Ford2026!';

// === Login admin (JWT próprio da API) ===
async function getToken() {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!r.ok) throw new Error(`login falhou: ${r.status} ${await r.text()}`);
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
