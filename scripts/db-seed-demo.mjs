#!/usr/bin/env node
/**
 * Seed de DEMONSTRAÇÃO do Desafio 2 (Retenção / VIN Share).
 *
 * Popula o banco com dados fictícios, porém coerentes, para que todas as telas
 * (web, mobile, dashboards) e evidências tenham conteúdo:
 *
 *   (a) usuários demo (bcrypt cost 12, senha Ford2026!):
 *         admin@faroai.com.br     admin    (mantido; vinculado a FD001 se não tiver dealership)
 *         gestor@faroai.com.br    gestor   FD001 (lê a rede inteira)
 *         analista@faroai.com.br  analista FD001
 *         analista2@faroai.com.br analista FD002
 *   (b) ~700 clientes nas 10 concessionárias (FD001/FD002 com mais volume),
 *       modelos Ford com janela de comercialização realista, vendas 2019–2026,
 *       garantia, histórico de revisões coerente com o perfil comportamental
 *       (perfil_real) + 1 linha de client_history por cliente;
 *   (c) 1 predição por cliente chamando o serviço ML (POST /predict com
 *       Bearer + assinatura HMAC-SHA256 de timestamp, nonce e corpo e dealership
 *       pseudonimizada, igual a apps/api/src/modules/retention/ml-client.ts). Se o ML não
 *       responder, usa fallback determinístico (model_version
 *       'demo-fallback-heuristico') — o resumo final informa quantas vieram de cada;
 *   (d) ações de retenção em vários status (inclui uma campanha em lote) e
 *       email_logs coerentes com o fluxo POST /acoes/email-send em modo mock;
 *   (e) fecha a conexão.
 *
 * Idempotente: todas as linhas demo têm clients.data_source = 'demo_seed' e
 * vin_hash com prefixo 'demo-'. Cada execução apaga SOMENTE essas linhas
 * (predictions, client_history, acoes_retencao e email_logs caem em cascata)
 * e recria. IDs são determinísticos (derivados de SEED), então os links das
 * evidências continuam válidos entre execuções.
 *
 * Nomes de clientes são fictícios (combinação aleatória de listas), e-mails
 * usam o domínio reservado example.com (RFC 2606). Nenhum dado real.
 *
 * Env:
 *   DATABASE_URL       (obrigatória; .env.local da raiz)
 *   ML_SERVICE_URL     (default http://127.0.0.1:8001)
 *   ML_SERVICE_TOKEN   (segredo compartilhado com o ML; .env.local)
 *   SEED_DEMO_SEED     (default 2026 — semente do gerador pseudoaleatório)
 *   SEED_DEMO_SKIP_ML  (=1 força o fallback, sem chamar o ML)
 *
 * Uso: pnpm db:seed:demo   (depois de pnpm db:migrate)
 */
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { databaseUrl, loadRootEnv } from './lib/env.mjs';

loadRootEnv();
const DB_URL = databaseUrl();
const ML_URL = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');
const ML_TOKEN = process.env.ML_SERVICE_TOKEN || '';
const SKIP_ML = process.env.SEED_DEMO_SKIP_ML === '1';
const SEED = Number(process.env.SEED_DEMO_SEED || 2026);
const DEMO_SOURCE = 'demo_seed';
const DEMO_PASSWORD = 'Ford2026!';
const BCRYPT_COST = 12; // mesmo custo de apps/api/src/lib/identity.ts
const DAY = 86_400_000;

// "Hoje" fixo ao dia (UTC) — datas coerentes com now() do Postgres nas funções.
const TODAY = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');

// ============================================================ PRNG determinístico
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const uni = (a, b) => a + (b - a) * rnd();
const int = (a, b) => Math.floor(uni(a, b + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
function weighted(entries) { // [[valor, peso], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of entries) { if ((r -= w) <= 0) return v; }
  return entries[entries.length - 1][0];
}
function normal(mu, sigma) { // Box-Muller
  const u = Math.max(rnd(), 1e-9), v = rnd();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const round = (x, d = 3) => Number(x.toFixed(d));

/** UUID determinístico (formato v4-like) a partir de uma chave textual. */
function detUuid(key) {
  const h = createHash('sha256').update(`faroai-demo:${SEED}:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const isoDate = (d) => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / DAY);

// ============================================================ Domínio
/**
 * Concessionárias (seed 003) → código Ford de dealer (dealer_code_venda) e
 * volume de clientes. Todas ficam >= 50 para entrar em /metrics/anomalias-dealer
 * (min_clientes default 50). fielBias desloca a taxa de fidelização para
 * produzir anomalias (z < -1) e top performers (z > 1) plausíveis.
 */
const DEALERS = [
  { codigo: 'FD001', code: 1001, n: 130, fielBias: 0.02 },
  { codigo: 'FD002', code: 1002, n: 100, fielBias: 0.00 },
  { codigo: 'FD003', code: 1003, n: 54, fielBias: 0.16 },  // top performer
  { codigo: 'FD004', code: 1004, n: 52, fielBias: -0.04 },
  { codigo: 'FD005', code: 1005, n: 52, fielBias: -0.18 }, // anomalia
  { codigo: 'FD006', code: 1006, n: 52, fielBias: 0.03 },
  { codigo: 'FD007', code: 1007, n: 52, fielBias: 0.08 },
  { codigo: 'FD008', code: 1008, n: 52, fielBias: -0.12 }, // anomalia
  { codigo: 'FD009', code: 1009, n: 52, fielBias: -0.02 },
  { codigo: 'FD010', code: 1010, n: 52, fielBias: 0.05 },
];

/**
 * Modelos Ford com janela de venda no Brasil (anos), peso, versões e faixa de
 * preço (R$). mlName = nome usado no treino sintético do classificador
 * (services/ml/src/synthetic.py); modelos novos caem no handle_unknown.
 */
const MODELS = [
  { name: 'RANGER', ml: 'Ranger', from: 2019, to: 2026, w: 22, versoes: ['XL', 'XLS', 'XLT', 'Limited', 'Raptor'], preco: [190000, 460000] },
  { name: 'TERRITORY', ml: 'Territory', from: 2020, to: 2026, w: 13, versoes: ['SEL', 'Titanium'], preco: [180000, 260000] },
  { name: 'BRONCO SPORT', ml: 'Bronco', from: 2021, to: 2026, w: 10, versoes: ['Wildtrak', 'Badlands'], preco: [230000, 290000] },
  { name: 'MAVERICK', ml: 'Maverick', from: 2022, to: 2026, w: 10, versoes: ['Lariat', 'Lariat FX4', 'Hybrid'], preco: [220000, 260000] },
  { name: 'KA', ml: 'Ka', from: 2019, to: 2021, w: 12, versoes: ['SE', 'SE Plus', 'Titanium'], preco: [55000, 80000] },
  { name: 'ECOSPORT', ml: 'EcoSport', from: 2019, to: 2021, w: 10, versoes: ['SE', 'Freestyle', 'Titanium', 'Storm'], preco: [80000, 120000] },
  { name: 'TRANSIT', ml: 'Transit', from: 2021, to: 2026, w: 5, versoes: ['Van 350L', 'Chassi', 'Minibus'], preco: [230000, 330000] },
  { name: 'F-150', ml: 'F-150', from: 2023, to: 2026, w: 4, versoes: ['Lariat', 'Platinum', 'Tremor'], preco: [480000, 560000] },
  { name: 'MUSTANG', ml: 'Mustang', from: 2019, to: 2026, w: 4, versoes: ['GT', 'Mach 1', 'Dark Horse'], preco: [330000, 560000] },
  { name: 'MUSTANG MACH-E', ml: 'Mach-E', from: 2023, to: 2026, w: 2, versoes: ['Premium', 'GT'], preco: [420000, 520000] },
  { name: 'EDGE', ml: 'Edge', from: 2019, to: 2021, w: 2, versoes: ['ST'], preco: [290000, 320000] },
  { name: 'FIESTA', ml: 'Fiesta', from: 2019, to: 2019, w: 3, versoes: ['SE', 'Titanium'], preco: [60000, 75000] },
  { name: 'FOCUS', ml: 'Focus', from: 2019, to: 2019, w: 2, versoes: ['SE', 'Titanium'], preco: [85000, 110000] },
];

/** Peso de vendas por ano (a série cresce até 2024 e 2026 só vai até ~setembro). */
const ANO_PESO = [[2019, 10], [2020, 8], [2021, 11], [2022, 12], [2023, 15], [2024, 17], [2025, 16], [2026, 9]];
/** Mínimo de clientes com perfil_real por dealership (default de /metrics/anomalias-dealer = 50). */
const MIN_ROTULADOS = 54;

const NOMES_F = ['Ana', 'Beatriz', 'Camila', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Juliana', 'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Renata', 'Sabrina', 'Tatiane', 'Vanessa', 'Aline', 'Carolina', 'Luana', 'Priscila', 'Rafaela', 'Simone'];
const NOMES_M = ['André', 'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Felipe', 'Gustavo', 'Henrique', 'Igor', 'João', 'Leonardo', 'Marcelo', 'Nelson', 'Otávio', 'Paulo', 'Rafael', 'Rodrigo', 'Sérgio', 'Thiago', 'Vinícius', 'Lucas', 'Mateus', 'Ricardo', 'Fábio'];
const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Teixeira', 'Correia', 'Pinto', 'Araújo', 'Campos'];

const NOTAS_POR_PERFIL = {
  fiel: ['Cliente elogiou o atendimento da oficina na última revisão.', 'Perguntou sobre o lançamento do próximo modelo — possível upgrade.', 'Participa do programa de fidelidade; sempre agenda pelo app.'],
  abandono: ['Reclamou do valor da revisão de 30 mil km e disse que foi a oficina independente.', 'Não retorna ligações desde a última visita.', 'Mudou de cidade segundo o vizinho de cadastro; confirmar endereço.'],
  esquecido: ['Disse que "esqueceu" a revisão; pediu lembrete por WhatsApp.', 'Usa pouco o carro durante a semana; rodagem baixa.', 'Pediu para ser avisado quando a garantia estiver perto de vencer.'],
  economico: ['Compara preço de peças com o mercado paralelo antes de aprovar orçamento.', 'Interessado em pacote de revisão com preço fechado.', 'Faz troca de óleo fora da rede para economizar.'],
};

// ============================================================ Geração de clientes
function pickModelForYear(year) {
  const disponiveis = MODELS.filter((m) => year >= m.from && year <= m.to);
  return weighted(disponiveis.map((m) => [m, m.w]));
}

/** Perfil-alvo por dealership: base da rede deslocada pelo fielBias. */
function pickArquetipo(dealer) {
  const fiel = clamp(0.36 + dealer.fielBias, 0.08, 0.7);
  const resto = 1 - fiel;
  return weighted([['fiel', fiel], ['economico', resto * 0.3], ['esquecido', resto * 0.38], ['abandono', resto * 0.32]]);
}

/**
 * Comportamento pós-venda coerente com o arquétipo e com a idade do veículo.
 * Referência: regras de rótulo do ETL real (scripts/etl-d2-real.py, derive_labels)
 * e a heurística Ford de revisão anual (10.000 km / 12 meses).
 */
function comportamento(arq, entrega, dealer) {
  const idadeDias = daysBetween(entrega, TODAY);
  // Veículo com menos de ~10 meses: ainda sem histórico suficiente → sem rótulo.
  if (idadeDias < 300) {
    const fez = idadeDias > 200 && chance(0.25);
    const dias = fez ? int(10, Math.max(11, idadeDias - 180)) : idadeDias;
    return {
      perfil: null, n: fez ? 1 : 0, dias, loyalty: fez ? 1 : null,
      kmAno: int(9000, 22000), idadeDias,
    };
  }
  // Arquétipos que exigem tempo de estrada para existir
  if (arq === 'abandono' && idadeDias < 500) arq = chance(0.5) ? 'economico' : 'fiel';
  if (arq === 'esquecido' && idadeDias < 450) arq = chance(0.5) ? 'economico' : 'fiel';

  let n, dias, loyalty, kmAno;
  const anos = idadeDias / 365;
  switch (arq) {
    case 'fiel':
      dias = int(15, Math.min(250, idadeDias - 200));
      n = Math.max(1, Math.round(anos * uni(1.0, 1.5)));
      loyalty = round(uni(0.75, 1.0), 3);
      kmAno = int(12000, 26000);
      break;
    case 'economico':
      dias = int(120, Math.min(355, idadeDias - 150)); // parte cai na janela de "próxima revisão"
      n = Math.max(1, Math.round(anos * uni(0.6, 1.0)));
      loyalty = round(uni(0.15, 0.62), 3);
      kmAno = int(10000, 22000);
      break;
    case 'esquecido': {
      dias = int(280, Math.min(720, idadeDias - 170));
      const anosAtivo = (idadeDias - dias) / 365;
      n = Math.max(1, Math.round(anosAtivo * uni(0.6, 1.0)));
      loyalty = round(uni(0.45, 0.95), 3);
      kmAno = int(5000, 14000);
      break;
    }
    case 'abandono':
    default: {
      if (chance(0.35)) { // nunca voltou à rede
        n = 0; dias = idadeDias; loyalty = null;
      } else {            // fez só a 1ª revisão e sumiu
        n = 1;
        const primeira = int(300, 420);
        dias = Math.max(366, idadeDias - primeira);
        loyalty = chance(0.55) ? 0 : 1;
      }
      kmAno = int(10000, 24000);
      arq = 'abandono';
    }
  }
  return { perfil: arq, n, dias, loyalty, kmAno, idadeDias, dealer };
}

/** Features "Base 2" (momento da compra) correlacionadas ao arquétipo, como no synthetic.py. */
function featuresCompra(arq, model, regiao) {
  const p = arq ?? 'fiel';
  const [mi, si, mr, sr, ms, ss] = {
    fiel: [48, 11, 14000, 5000, 780, 80],
    abandono: [35, 9, 7500, 3000, 620, 110],
    esquecido: [42, 13, 9000, 4000, 680, 100],
    economico: [40, 10, 6500, 2500, 660, 95],
  }[p];
  const idade = Math.round(clamp(normal(mi, si), 20, 85));
  const renda = Math.round(clamp(normal(mr, sr), 1800, 60000) / 100) * 100;
  const score = Math.round(clamp(normal(ms, ss), 250, 1000));
  const [pmin, pmax] = model.preco;
  const preco = Math.round(uni(pmin, pmax) / 100) * 100;
  const financiamento = weighted(p === 'abandono'
    ? [['a_vista', 8], ['financiado', 75], ['leasing', 4], ['consorcio', 13]]
    : [['a_vista', 18], ['financiado', 62], ['leasing', 5], ['consorcio', 15]]);
  const parcelas = financiamento === 'a_vista' ? 0 : pick([24, 36, 48, 60, 72]);
  const canal = model.name === 'TRANSIT' && chance(0.6) ? 'frota'
    : weighted([['concessionaria', 55], ['online', 25], ['indicacao', 15], ['frota', 5]]);
  const genero = weighted([['M', 58], ['F', 40], ['outro', 2]]);
  return {
    idade, genero, regiao, renda_mensal_brl: renda,
    estado_civil: weighted([['solteiro', 30], ['casado', 52], ['divorciado', 12], ['viuvo', 6]]),
    score_credito: score, preco_pago_brl: preco, financiamento, parcelas,
    canal_aquisicao: canal,
    primeiro_carro: chance(p === 'abandono' ? 0.42 : 0.28),
    test_drive_realizado: chance(0.72),
  };
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.');
}

/** Replica o risco composto de public.leads_ranqueados (migrations 018/019). */
function riscoComposto(c) {
  if (!c.perfil_real) return null;
  const base = { abandono: 0.85, esquecido: 0.65, economico: 0.35, fiel: 0.15 }[c.perfil_real];
  let r = base;
  const garantiaFim = c.warranty_start_date ? addDays(new Date(c.warranty_start_date + 'T00:00:00Z'), 365 * 3) : null;
  if (c.dias_desde_ultima_revisao > 365) r += 0.10;
  if (garantiaFim && garantiaFim < TODAY) r += 0.05;
  if (c.dealer_loyalty != null && c.dealer_loyalty < 0.4 && c.num_revisoes > 0) r += 0.05;
  if (c.model_year && TODAY.getUTCFullYear() - c.model_year >= 5) r += 0.03;
  if (c.num_revisoes === 0 && c.delivery_date && new Date(c.delivery_date) < addDays(TODAY, -456)) r += 0.07;
  return round(Math.min(0.99, r), 3);
}

function gerarClientes(dealerships, usuariosPorDealer) {
  const clientes = [];
  const historicos = [];
  let seq = 0;
  for (const d of DEALERS) {
    const ds = dealerships.get(d.codigo);
    // Gera ao menos d.n clientes E ao menos MIN_ROTULADOS com perfil_real — a
    // função dealer_perfil_stats só conta clientes rotulados no min_clientes (50).
    let rotulados = 0;
    for (let i = 0; i < d.n || rotulados < MIN_ROTULADOS; i++) {
      seq++;
      const ano = weighted(ANO_PESO);
      const model = pickModelForYear(ano);
      const inicioAno = new Date(Date.UTC(ano, 0, 1));
      const fimAno = ano === TODAY.getUTCFullYear() ? addDays(TODAY, -35) : new Date(Date.UTC(ano, 11, 28));
      const venda = addDays(inicioAno, int(0, Math.max(0, daysBetween(inicioAno, fimAno))));
      const faturamento = addDays(venda, int(0, 2));
      const entrega = addDays(venda, int(3, 20));
      const emplacamento = addDays(entrega, int(0, 10));
      const modelYear = venda.getUTCMonth() >= 8 ? Math.min(ano + 1, model.to + 1) : ano;

      const arq = pickArquetipo(d);
      const b = comportamento(arq, entrega, d);
      const perfil = b.perfil;
      const idadeDias = b.idadeDias;
      const kmMax = Math.round((b.kmAno * idadeDias) / 365);
      const ultimo = b.n > 0 ? addDays(TODAY, -b.dias) : null;
      let dias1a = null, primeiro = null;
      if (b.n > 0) {
        const maxPrimeiro = daysBetween(entrega, ultimo);
        dias1a = b.n === 1 ? maxPrimeiro : Math.min(maxPrimeiro, int(perfil === 'fiel' ? 250 : 300, perfil === 'fiel' ? 380 : 460));
        primeiro = addDays(entrega, dias1a);
      }
      const extrasServicos = perfil === 'fiel' ? int(0, 4) : perfil === 'economico' ? int(0, 1) : 0;
      const outroDealer = DEALERS[(DEALERS.indexOf(d) + int(1, DEALERS.length - 1)) % DEALERS.length].code;
      const codesRev = b.n === 0 ? [] : b.loyalty >= 0.99 ? [d.code] : b.loyalty === 0 ? [outroDealer] : [d.code, outroDealer];

      const feminino = chance(0.4);
      const nome = `${pick(feminino ? NOMES_F : NOMES_M)} ${pick(SOBRENOMES)} ${pick(SOBRENOMES)}`;
      const id = detUuid(`client:${seq}`);
      const vinHash = 'demo-' + createHash('sha256').update(`vin:${SEED}:${seq}`).digest('hex').slice(0, 40);
      const compra = featuresCompra(perfil, model, ds.regiao);
      const autor = usuariosPorDealer.get(d.codigo) ?? null;
      const criadoEm = new Date(venda.getTime() + int(9, 18) * 3_600_000 + int(0, 59) * 60_000);

      const c = {
        id,
        dealership_id: ds.id,
        created_by: autor,
        vin_hash: vinHash,
        model_name: model.name,
        model_year: modelYear,
        dealer_code_venda: d.code,
        dealer_codes_revisao: codesRev,
        sales_date: isoDate(venda),
        invoice_date: isoDate(faturamento),
        delivery_date: isoDate(entrega),
        registration_date: isoDate(emplacamento),
        warranty_start_date: isoDate(entrega),
        km_max: kmMax,
        num_revisoes: b.n,
        num_servicos_total: b.n + extrasServicos,
        dias_ate_1a_revisao: dias1a,
        dias_desde_ultima_revisao: b.dias,
        dealer_loyalty: b.loyalty,
        taxa_aderencia_km: round(Math.min(9.99, b.n / Math.max(1, kmMax / 10000)), 2),
        revisoes_por_ano: round(b.n / Math.max(idadeDias / 365, 0.1), 2),
        primeiro_servico: primeiro ? isoDate(primeiro) : null,
        ultimo_servico: ultimo ? isoDate(ultimo) : null,
        perfil_real: perfil,
        is_ford_real: false,
        data_source: DEMO_SOURCE,
        nome_cliente: nome,
        email_cliente: `${slug(nome)}.${seq}@example.com`,
        telefone_cliente: null,
        cpf_hash: null,
        notas: perfil && chance(0.18) ? pick(NOTAS_POR_PERFIL[perfil]) : null,
        data_compra: isoDate(venda),
        modelo_comprado: model.name,
        versao_comprada: pick(model.versoes),
        ...compra,
        created_at: criadoEm,
      };
      c._mlModelo = model.ml;
      c._risco = riscoComposto(c);
      c._dealerCodigo = d.codigo;
      clientes.push(c);
      if (perfil) rotulados++;

      // Base 1 — fotografia do comportamento pós-venda (client_history)
      const esperadas = Math.floor(idadeDias / 365);
      const pSeguiu = { fiel: [0.85, 1], economico: [0.3, 0.6], esquecido: [0.4, 0.7], abandono: [0, 0.3] }[perfil ?? 'fiel'];
      const nps = perfil === 'abandono' ? (chance(0.5) ? int(0, 6) : null)
        : perfil === 'fiel' ? int(8, 10) : perfil ? int(5, 9) : (chance(0.5) ? int(7, 10) : null);
      historicos.push({
        id: detUuid(`history:${seq}`),
        client_id: id,
        num_revisoes_realizadas: b.n,
        num_revisoes_esperadas: esperadas,
        gasto_total_servicos_brl: b.n * int(perfil === 'economico' ? 700 : 1200, perfil === 'economico' ? 1100 : 2400),
        dias_desde_ultima_visita: b.dias,
        seguiu_recomendacoes_pct: b.n === 0 ? 0 : round(uni(...pSeguiu), 3),
        reclamacoes_abertas: perfil === 'abandono' ? int(0, 3) : perfil === 'fiel' ? int(0, 1) * (chance(0.2) ? 1 : 0) : int(0, 2),
        garantia_ativa: idadeDias < 365 * 3,
        nps_ultima_visita: nps,
        observado_em: TODAY,
      });
    }
  }
  return { clientes, historicos };
}

// ============================================================ Predições (ML + fallback)
// Mesmo desenho de apps/api/src/modules/retention/ml-client.ts: o ML rejeita
// assinatura sem frescor/nonce e a dealership só sobe pseudonimizada.
function pseudonymize(value) {
  return createHmac('sha256', ML_TOKEN)
    .update('dealership-pseudonym:v1\0').update(value).digest('hex').slice(0, 16);
}

function signPayload(body, timestamp, nonce) {
  return createHmac('sha256', ML_TOKEN)
    .update('ml-payload-signature:v1\0').update(`${timestamp}.${nonce}.${body}`).digest('hex');
}

async function mlPredict(c) {
  const payload = {
    idade: c.idade, genero: c.genero, regiao: c.regiao, renda_mensal_brl: c.renda_mensal_brl,
    estado_civil: c.estado_civil, score_credito: c.score_credito, modelo_comprado: c._mlModelo,
    versao_comprada: c.versao_comprada, preco_pago_brl: c.preco_pago_brl,
    financiamento: c.financiamento, parcelas: c.parcelas, canal_aquisicao: c.canal_aquisicao,
    primeiro_carro: c.primeiro_carro, test_drive_realizado: c.test_drive_realizado,
    dealership_id: pseudonymize(c.dealership_id),
  };
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString('hex');
  const signature = signPayload(body, timestamp, nonce);
  const res = await fetch(`${ML_URL}/predict`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ML_TOKEN}`,
      'x-payload-signature': signature,
      'x-payload-timestamp': timestamp,
      'x-payload-nonce': nonce,
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`ml status=${res.status}`);
  return await res.json();
}

const RECOMENDACOES = {
  fiel: ['Convite para programa de fidelidade premium', 'Oferta de upgrade no próximo modelo com condições preferenciais', 'Convite para eventos da marca'],
  abandono: ['Contato proativo do consultor sênior em até 7 dias', 'Pacote de revisão com desconto agressivo (até -30%)', 'Cashback em primeira manutenção fora da garantia', 'Pesquisa qualitativa para entender motivo de saída'],
  esquecido: ['Campanha de SMS+WhatsApp lembrando próxima revisão', 'Bônus por trazer o carro à concessionária nos próximos 30 dias', 'Oferta de busca/entrega domiciliar do veículo'],
  economico: ['Pacote de revisão fixo com preço fechado', 'Programa de assinatura de manutenção (mensalidade baixa)', 'Cross-sell de peças genuínas com desconto progressivo'],
};

/** Fallback determinístico: probabilidades puxadas para o perfil observado (se houver). */
function fallbackPredict(c) {
  const perfis = ['fiel', 'abandono', 'esquecido', 'economico'];
  const alvo = c.perfil_real ?? (c.financiamento === 'financiado' && c.parcelas >= 60 ? 'abandono'
    : c.renda_mensal_brl > 12000 ? 'fiel' : c.preco_pago_brl < 100000 ? 'economico' : 'esquecido');
  const h = createHash('sha256').update(c.id).digest();
  const raw = perfis.map((p, i) => (p === alvo ? 2.2 : 0.6) + (h[i] / 255) * 0.8);
  const soma = raw.reduce((a, b) => a + b, 0);
  const probs = Object.fromEntries(perfis.map((p, i) => [p, round(raw[i] / soma, 3)]));
  const perfil = perfis.reduce((a, b) => (probs[b] > probs[a] ? b : a));
  return {
    model_version: 'demo-fallback-heuristico',
    perfil_predito: perfil,
    probabilidades: probs,
    risco_evasao: round(clamp(probs.abandono + 0.5 * probs.esquecido, 0, 1), 3),
    confianca: probs[perfil],
    recomendacoes_acao: RECOMENDACOES[perfil],
  };
}

async function gerarPredicoes(clientes) {
  const out = new Array(clientes.length);
  let viaMl = 0, viaFallback = 0, mlOk = !SKIP_ML && !!ML_TOKEN;
  if (!SKIP_ML && !ML_TOKEN) console.warn('⚠️  ML_SERVICE_TOKEN ausente — usando fallback determinístico.');
  let erroMl = null;
  const CONC = 8;
  let idx = 0;
  async function worker() {
    while (idx < clientes.length) {
      const i = idx++;
      const c = clientes[i];
      let p = null;
      if (mlOk) {
        try { p = await mlPredict(c); viaMl++; }
        catch (err) {
          erroMl = erroMl ?? err.message;
          // Serviço fora do ar → para de tentar e usa fallback no restante.
          if (/fetch failed|ECONNREFUSED|timeout|aborted/i.test(String(err.message) + String(err.cause ?? ''))) mlOk = false;
        }
      }
      if (!p) { p = fallbackPredict(c); viaFallback++; }
      const clamp01 = (x) => round(clamp(Number(x), 0, 1), 3);
      out[i] = {
        id: detUuid(`prediction:${c.id}`),
        client_id: c.id,
        model_version: p.model_version,
        perfil_predito: p.perfil_predito,
        prob_fiel: clamp01(p.probabilidades.fiel),
        prob_abandono: clamp01(p.probabilidades.abandono),
        prob_esquecido: clamp01(p.probabilidades.esquecido),
        prob_economico: clamp01(p.probabilidades.economico),
        risco_evasao: clamp01(p.risco_evasao),
        confianca: clamp01(p.confianca),
        recomendacoes_acao: p.recomendacoes_acao ?? [],
        source: 'ml_only',
        created_at: new Date(Math.max(new Date(c.created_at).getTime() + 60_000, TODAY.getTime() - int(1, 20) * DAY)),
      };
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  return { predicoes: out, viaMl, viaFallback, erroMl };
}

// ============================================================ Ações + e-mails
const TITULOS = {
  ligacao: (c) => `Ligação de retenção — ${c.model_name}`,
  whatsapp: (c) => `WhatsApp: lembrete de revisão do ${c.model_name}`,
  sms: (c) => `SMS: revisão do ${c.model_name} disponível`,
  visita_presencial: () => 'Visita do consultor / test drive de retorno',
  oferta_enviada: (c) => c.perfil_real === 'economico' ? 'Oferta: pacote de revisão com preço fechado' : 'Oferta: revisão com 30% de desconto',
  agendamento_revisao: (c) => `Agendamento de revisão — ${c.model_name}`,
  outro: () => 'Pesquisa de satisfação pós-atendimento',
};
const EMAIL_SUBJECT = {
  esquecido: (m) => `${m}: sua revisão está atrasada — vamos cuidar dele?`,
  abandono: (m) => `Sentimos sua falta — oferta exclusiva pro seu ${m}`,
  economico: (m) => `Pacote de revisão com preço fechado pro seu ${m}`,
  fiel: (m) => `Convite Ford VIP — exclusivo pra clientes do ${m}`,
};
const DESFECHOS = {
  concluida_sucesso: ['Cliente agendou a revisão para a próxima semana.', 'Aceitou o pacote de revisão; veículo recebido na oficina.', 'Retornou à rede e fez a revisão atrasada.', 'Confirmou interesse no programa de fidelidade.'],
  concluida_recusa: ['Cliente informou que faz manutenção em oficina independente.', 'Achou o valor acima do mercado; recusou a oferta.', 'Vendeu o veículo — atualizar cadastro.'],
  sem_resposta: ['3 tentativas sem retorno.', 'Caixa postal; mensagem deixada.', 'Mensagem entregue, sem resposta em 7 dias.'],
  cancelada: ['Cancelada: cliente já havia agendado por outro canal.', 'Cancelada por duplicidade com a campanha em lote.'],
};

function gerarAcoes(clientes, atores) {
  const acoes = [];
  const emails = [];
  let seq = 0;
  // Candidatos: clientes com risco composto >= 0.4 (os que aparecem em /clients/leads)
  const candidatos = clientes.filter((c) => (c._risco ?? 0) >= 0.4);
  const porDealer = new Map();
  for (const c of candidatos) {
    if (!porDealer.has(c._dealerCodigo)) porDealer.set(c._dealerCodigo, []);
    porDealer.get(c._dealerCodigo).push(c);
  }
  const quota = { FD001: 45, FD002: 35 };
  for (const [codigo, lista] of porDealer) {
    const ator = atores.get(codigo) ?? atores.get('_gestor');
    const alvo = lista.sort((a, b) => b._risco - a._risco).slice(0, quota[codigo] ?? 8);
    for (const c of alvo) {
      seq++;
      const tipo = weighted([['ligacao', 26], ['whatsapp', 22], ['email', 16], ['oferta_enviada', 10], ['agendamento_revisao', 12], ['sms', 6], ['visita_presencial', 5], ['outro', 3]]);
      const criada = new Date(TODAY.getTime() - int(0, 55) * DAY + int(8, 18) * 3_600_000 + int(0, 59) * 60_000);
      const id = detUuid(`acao:${seq}`);
      if (tipo === 'email') {
        // Coerente com POST /acoes/email-send sem Resend configurado (modo mock):
        // ação 'planejada' + desfecho de simulação; log 'sent' com provider 'mock'.
        const subject = EMAIL_SUBJECT[c.perfil_real ?? 'esquecido'](c.model_name);
        const falhou = chance(0.1);
        acoes.push({
          id, client_id: c.id, dealership_id: c.dealership_id, actor_id: ator, tipo,
          status: falhou ? 'concluida_recusa' : 'planejada',
          titulo: subject,
          descricao: `E-mail enviado para ${c.email_cliente}`,
          desfecho: falhou ? 'Falha ao enviar: endereço rejeitado pelo provedor (demo)'
            : '⚠️ SIMULAÇÃO — e-mail NÃO foi enviado (Resend não configurado em /configuracoes). Configure a chave pra envio real.',
          perfil_alvo: c.perfil_real, risco_no_disparo: c._risco, campaign_id: null,
          created_at: criada, scheduled_for: null, completed_at: null,
        });
        emails.push({
          id: detUuid(`email:${seq}`), acao_id: id, client_id: c.id, sent_by: ator,
          to_email: c.email_cliente, from_email: 'Faro AI Retenção <retencao@faroai.com.br>',
          subject,
          body_preview: `Olá ${c.nome_cliente}, ` + (c.perfil_real === 'abandono'
            ? `faz um tempo que seu ${c.model_name} não passa pela rede oficial Ford.`
            : `notamos que seu ${c.model_name} ainda não passou pela revisão recomendada.`),
          provider: 'mock', provider_message_id: null,
          status: falhou ? 'failed' : 'sent',
          error_message: falhou ? 'Endereço rejeitado (simulação de bounce na demo)' : 'Modo mock — Resend API key não configurada em /configuracoes',
          created_at: criada, sent_at: falhou ? null : new Date(criada.getTime() + 2000), delivered_at: null,
        });
        continue;
      }
      const idadeAcaoDias = daysBetween(criada, TODAY);
      const status = idadeAcaoDias < 5
        ? weighted([['planejada', 55], ['em_andamento', 45]])
        : weighted([['concluida_sucesso', 34], ['concluida_recusa', 16], ['sem_resposta', 22], ['em_andamento', 10], ['planejada', 10], ['cancelada', 8]]);
      const concluida = status.startsWith('concluida_');
      acoes.push({
        id, client_id: c.id, dealership_id: c.dealership_id, actor_id: ator, tipo, status,
        titulo: TITULOS[tipo](c),
        descricao: `Cliente ${c.perfil_real} com risco composto ${c._risco.toFixed(2)}; última revisão há ${c.dias_desde_ultima_revisao} dias.`,
        desfecho: DESFECHOS[status] ? pick(DESFECHOS[status]) : null,
        perfil_alvo: c.perfil_real, risco_no_disparo: c._risco, campaign_id: null,
        created_at: criada,
        scheduled_for: status === 'planejada' ? addDays(TODAY, int(1, 14)) : null,
        completed_at: concluida ? new Date(Math.min(criada.getTime() + int(1, 6) * DAY, Date.now())) : null,
      });
    }
  }

  // Campanha em lote: WhatsApp para os "esquecidos" da FD001 (mesmo campaign_id)
  const campanha = detUuid('campanha:revisao-setembro-fd001');
  const esquecidosFd001 = clientes
    .filter((c) => c._dealerCodigo === 'FD001' && c.perfil_real === 'esquecido' && !acoes.some((a) => a.client_id === c.id))
    .slice(0, 20);
  const criadaCamp = new Date(TODAY.getTime() - 6 * DAY + 10 * 3_600_000);
  for (const c of esquecidosFd001) {
    seq++;
    const status = weighted([['concluida_sucesso', 30], ['sem_resposta', 35], ['em_andamento', 20], ['concluida_recusa', 15]]);
    acoes.push({
      id: detUuid(`acao:${seq}`), client_id: c.id, dealership_id: c.dealership_id,
      actor_id: atores.get('_gestor'), tipo: 'whatsapp', status,
      titulo: 'Campanha: revisão em dia — setembro',
      descricao: 'Disparo em lote para clientes esquecidos da FD001 (lembrete de revisão + bônus de 30 dias).',
      desfecho: DESFECHOS[status] ? pick(DESFECHOS[status]) : null,
      perfil_alvo: 'esquecido', risco_no_disparo: c._risco, campaign_id: campanha,
      created_at: criadaCamp, scheduled_for: null,
      completed_at: status.startsWith('concluida_') ? new Date(criadaCamp.getTime() + int(1, 4) * DAY) : null,
    });
  }
  return { acoes, emails };
}

// ============================================================ Execução
const sql = postgres(DB_URL, { max: 4, onnotice: () => {} });

async function upsertUsuario(email, fullName, role, dealershipId, hash) {
  const [row] = await sql`
    insert into public.profiles ${sql({ email, full_name: fullName, role, password_hash: hash, dealership_id: dealershipId })}
    on conflict (email) do update set
      full_name = excluded.full_name, role = excluded.role,
      password_hash = excluded.password_hash, dealership_id = excluded.dealership_id
    returning id, (xmax = 0) as inserted
  `;
  return row;
}

function semInternos(c) {
  const out = {};
  for (const [k, v] of Object.entries(c)) if (!k.startsWith('_')) out[k] = v;
  return out;
}

async function inserirEmLotes(tx, tabela, linhas, tam = 200) {
  for (let i = 0; i < linhas.length; i += tam) {
    await tx`insert into ${tx(tabela)} ${tx(linhas.slice(i, i + tam))}`;
  }
}

try {
  const t0 = Date.now();
  console.log(`🌱 seed demo (semente ${SEED}, hoje ${isoDate(TODAY)})`);

  // ---- dealerships
  const dsRows = await sql`select id, codigo, regiao::text as regiao from public.dealerships where codigo in ${sql(DEALERS.map((d) => d.codigo))}`;
  const dealerships = new Map(dsRows.map((r) => [r.codigo, r]));
  const faltando = DEALERS.filter((d) => !dealerships.has(d.codigo)).map((d) => d.codigo);
  if (faltando.length) throw new Error(`dealerships ausentes (rode pnpm db:migrate): ${faltando.join(', ')}`);

  // ---- (a) usuários demo
  console.log('🔑 usuários demo (bcrypt cost 12)...');
  const hash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
  const fd1 = dealerships.get('FD001').id, fd2 = dealerships.get('FD002').id;
  const [adminExist] = await sql`select id, dealership_id from public.profiles where email = 'admin@faroai.com.br'`;
  const admin = await upsertUsuario('admin@faroai.com.br', 'Administrador', 'admin', adminExist?.dealership_id ?? fd1, hash);
  const gestor = await upsertUsuario('gestor@faroai.com.br', 'Gestora Regional (demo)', 'gestor', fd1, hash);
  const analista = await upsertUsuario('analista@faroai.com.br', 'Analista FD001 (demo)', 'analista', fd1, hash);
  const analista2 = await upsertUsuario('analista2@faroai.com.br', 'Analista FD002 (demo)', 'analista', fd2, hash);
  for (const [e, r] of [['admin', admin], ['gestor', gestor], ['analista', analista], ['analista2', analista2]]) {
    console.log(`   ${e.padEnd(9)} ${r.inserted ? 'criado' : 'atualizado'} (${r.id})`);
  }
  const autores = new Map([['FD001', analista.id], ['FD002', analista2.id]]);
  const atores = new Map([['FD001', analista.id], ['FD002', analista2.id], ['_gestor', gestor.id]]);

  // ---- (b) clientes
  const { clientes, historicos } = gerarClientes(dealerships, autores);
  console.log(`👥 ${clientes.length} clientes gerados`);

  // ---- (c) predições (fora da transação: chamadas HTTP)
  console.log(SKIP_ML ? '🤖 predições: fallback (SEED_DEMO_SKIP_ML=1)' : `🤖 predições via ML ${ML_URL}/predict ...`);
  const { predicoes, viaMl, viaFallback, erroMl } = await gerarPredicoes(clientes);
  console.log(`   ML: ${viaMl} · fallback: ${viaFallback}${erroMl ? ` (primeiro erro do ML: ${erroMl})` : ''}`);

  // ---- (d) ações + e-mails
  const { acoes, emails } = gerarAcoes(clientes, atores);

  // ---- grava tudo numa transação: apaga só as linhas demo e recria
  const resumo = await sql.begin(async (tx) => {
    const del = await tx`
      delete from public.clients
      where data_source = ${DEMO_SOURCE} or vin_hash like 'demo-%'
    `;
    await inserirEmLotes(tx, 'clients', clientes.map(semInternos));
    await inserirEmLotes(tx, 'client_history', historicos);
    await inserirEmLotes(tx, 'predictions', predicoes);
    await inserirEmLotes(tx, 'acoes_retencao', acoes);
    await inserirEmLotes(tx, 'email_logs', emails);
    return { apagados: del.count };
  });

  // ---- conferência
  const porDealer = await sql`
    select d.codigo, count(c.id)::int as clientes,
           count(c.id) filter (where c.perfil_real = 'fiel')::int as fiel,
           count(c.id) filter (where c.perfil_real = 'abandono')::int as abandono
    from public.dealerships d
    left join public.clients c on c.dealership_id = d.id and c.data_source = ${DEMO_SOURCE}
    group by d.codigo order by d.codigo
  `;
  const [tot] = await sql`
    select
      (select count(*)::int from public.clients where data_source = ${DEMO_SOURCE}) as clientes,
      (select count(*)::int from public.client_history h join public.clients c on c.id = h.client_id where c.data_source = ${DEMO_SOURCE}) as historico,
      (select count(*)::int from public.predictions p join public.clients c on c.id = p.client_id where c.data_source = ${DEMO_SOURCE}) as predicoes,
      (select count(*)::int from public.acoes_retencao a join public.clients c on c.id = a.client_id where c.data_source = ${DEMO_SOURCE}) as acoes,
      (select count(*)::int from public.email_logs e join public.clients c on c.id = e.client_id where c.data_source = ${DEMO_SOURCE}) as emails,
      (select total::int from public.leads_ranqueados_stats()) as leads_total
  `;
  const perfis = await sql`
    select coalesce(perfil_real, '(sem histórico)') as perfil, count(*)::int as n
    from public.clients where data_source = ${DEMO_SOURCE} group by 1 order by 2 desc
  `;
  const status = await sql`
    select a.status::text, count(*)::int as n from public.acoes_retencao a
    join public.clients c on c.id = a.client_id where c.data_source = ${DEMO_SOURCE}
    group by 1 order by 2 desc
  `;

  console.log(`🧹 linhas demo anteriores apagadas: ${resumo.apagados}`);
  console.log('✅ inserido:', JSON.stringify(tot));
  console.log('   perfil_real:', perfis.map((r) => `${r.perfil}=${r.n}`).join(' · '));
  console.log('   ações por status:', status.map((r) => `${r.status}=${r.n}`).join(' · '));
  console.log('   por dealership:', porDealer.map((r) => `${r.codigo}=${r.clientes}(fiel ${r.fiel}/aband ${r.abandono})`).join(' · '));
  console.log(`   predições: ML=${viaMl} fallback=${viaFallback}`);
  console.log(`⏱️  ${((Date.now() - t0) / 1000).toFixed(1)}s — login: <e-mail demo> / ${DEMO_PASSWORD}`);
} catch (err) {
  console.error('❌ erro no seed demo:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
