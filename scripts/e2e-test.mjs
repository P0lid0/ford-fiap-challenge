#!/usr/bin/env node
// Smoke test E2E completo: login → /me → cria cliente → predict → IA insight
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

const SB = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const API = 'http://127.0.0.1:3333';

function dot(...args) { console.log(...args); }

async function login() {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@3amit.com.br', password: 'Ford2026!' }),
  });
  const j = await r.json();
  return j.access_token;
}

async function api(path, token, opts = {}) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers };
  const r = await fetch(API + path, { ...opts, headers });
  const txt = await r.text();
  try { return { status: r.status, json: JSON.parse(txt) }; }
  catch { return { status: r.status, text: txt }; }
}

const token = await login();
dot('✓ login: token', token.slice(0, 40) + '...');

const me = await api('/me', token);
dot('✓ /me:', me.json);

dot('\n--- DESAFIO 1 — Inteligência Competitiva ---');
const list = await api('/competitive/vehicles', token);
dot(`✓ /competitive/vehicles: ${list.json.length} veículos`);
const raptor = await api('/competitive/lookup?marca=Ford&modelo=Ranger&versao=Raptor&fields=motor.potencia_cv,motor.torque_nm,desempenho.aceleracao_0_100_s,preco_brl', token);
dot('✓ lookup Raptor (fields dinâmicos):', JSON.stringify(raptor.json[0]));

const ids = list.json.slice(0, 3).map(v => v.id);
const cmp = await api('/competitive/compare', token, { method: 'POST', body: JSON.stringify({ vehicle_ids: ids }) });
dot(`✓ /competitive/compare: ${cmp.json.fields.length} atributos comparados`);

dot('\n--- DESAFIO 2 — Retenção ---');
const newClient = await api('/clients', token, {
  method: 'POST',
  body: JSON.stringify({
    idade: 34, genero: 'M', regiao: 'sudeste',
    renda_mensal_brl: 7500, estado_civil: 'solteiro', score_credito: 620,
    modelo_comprado: 'Ranger', versao_comprada: 'XL', preco_pago_brl: 198000,
    financiamento: 'financiado', parcelas: 60,
    canal_aquisicao: 'concessionaria', primeiro_carro: true,
    test_drive_realizado: true, nome_cliente: 'Joao Demo',
  }),
});
if (newClient.status !== 201) {
  dot('✗ /clients FAILED:', newClient);
  process.exit(1);
}
const cid = newClient.json.client.id;
const pred = newClient.json.prediction;
dot(`✓ /clients criado: id=${cid.slice(0, 8)}...`);
dot(`  perfil_predito=${pred.perfil_predito}  risco_evasao=${(pred.risco_evasao * 100).toFixed(0)}%  confianca=${(pred.confianca * 100).toFixed(0)}%`);

const metrics = await api('/metrics/dealership', token);
dot(`✓ /metrics/dealership: ${metrics.json.total_clientes} cli, VIN Share=${(metrics.json.vin_share_estimado * 100).toFixed(0)}%`);

dot('\n--- DIFERENCIAL — IA generativa (OpenAI) ---');
const insightClient = await api(`/insights/client/${cid}`, token);
dot(`✓ /insights/client (model: ${insightClient.json.model})`);
dot(`  ${insightClient.json.output.replace(/\n/g, '\n  ')}`);

const portfolio = await api('/insights/portfolio', token);
dot(`\n✓ /insights/portfolio (model: ${portfolio.json.model})`);
dot(`  ${portfolio.json.output.replace(/\n/g, '\n  ').slice(0, 500)}`);

dot('\n🎉 todos os endpoints OK');
