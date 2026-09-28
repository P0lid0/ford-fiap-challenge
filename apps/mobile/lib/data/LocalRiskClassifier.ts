/**
 * Classificador de retenção do modo demonstração.
 *
 * Substitui o serviço de ML (XGBoost, services/ml) quando o app roda sem API.
 * Usa só dados PRÉ-COMPRA, como o modelo real, com regras de pontuação simples:
 *   pontos por perfil → softmax → probabilidades → perfil, confiança e risco.
 *
 * Funções puras: sem estado, sem I/O.
 */
import { PERFIS, type NewClientInput, type Perfil, type Prediction } from '../types';

export const MODEL_VERSION = 'demo-regras-v1';

/** Mesmas ações por perfil da API (apps/api/src/routes/clients.ts). */
export const ACOES_POR_PERFIL: Record<Perfil, string[]> = {
  fiel: [
    'Convite para programa de fidelidade premium',
    'Oferta de upgrade no próximo modelo com condições preferenciais',
    'Convite para eventos da marca',
  ],
  abandono: [
    'Contato proativo do consultor sênior em até 7 dias',
    'Pacote de revisão com desconto agressivo (até -30%)',
    'Cashback em primeira manutenção fora da garantia',
    'Pesquisa qualitativa para entender motivo de saída',
  ],
  esquecido: [
    'Campanha de SMS+WhatsApp lembrando próxima revisão',
    'Bônus por trazer o carro à concessionária nos próximos 30 dias',
    'Oferta de busca/entrega domiciliar do veículo',
  ],
  economico: [
    'Pacote de revisão fixo com preço fechado',
    'Programa de assinatura de manutenção (mensalidade baixa)',
    'Cross-sell de peças genuínas com desconto progressivo',
  ],
};

/**
 * Temperatura da softmax: > 1 suaviza as probabilidades, evitando confianças
 * irreais (ex.: 98%) em regras tão simples.
 */
const SOFTMAX_TEMPERATURE = 1.8;

/** Peso de cada perfil no risco de evasão. */
const RISK_WEIGHT: Record<Perfil, number> = {
  fiel: 0,
  abandono: 1,
  esquecido: 0.5,
  economico: 0.25,
};

export type Probabilities = Record<Perfil, number>;

export type Classification = {
  perfil: Perfil;
  probabilidades: Probabilities;
  risco: number;
  confianca: number;
  recomendacoes: string[];
};

// ─── Classificação de um cliente novo ─────────────────────────

export function classify(input: NewClientInput): Classification {
  const probabilidades = softmax(score(input));
  const perfil = argmax(probabilidades);
  return {
    perfil,
    probabilidades,
    risco: round(riskOf(probabilidades)),
    confianca: round(probabilidades[perfil]),
    recomendacoes: ACOES_POR_PERFIL[perfil],
  };
}

/** Pontuação (logit) de cada perfil a partir de sinais pré-compra. */
function score(input: NewClientInput): Probabilities {
  const points: Probabilities = { fiel: 0, abandono: 0, esquecido: 0, economico: 0 };

  const parcelaMensal = input.parcelas > 0 ? input.preco_pago_brl / input.parcelas : 0;
  const comprometimentoRenda = input.renda_mensal_brl > 0 ? parcelaMensal / input.renda_mensal_brl : 1;

  // Score de crédito
  if (input.score_credito >= 780) points.fiel += 1.4;
  else if (input.score_credito < 620) points.abandono += 1.3;
  else points.esquecido += 0.4;

  // Relacionamento na compra
  if (input.test_drive_realizado) points.fiel += 0.8;
  else points.abandono += 0.8;

  if (input.canal_aquisicao === 'indicacao') points.fiel += 1.0;
  if (input.canal_aquisicao === 'concessionaria') { points.fiel += 0.4; points.esquecido += 0.3; }
  if (input.canal_aquisicao === 'online') points.abandono += 0.9;
  if (input.canal_aquisicao === 'frota') { points.esquecido += 0.6; points.abandono += 0.3; }

  if (input.primeiro_carro) points.abandono += 0.7;

  // Forma de pagamento
  if (input.financiamento === 'a_vista') points.fiel += 0.9;
  if (input.financiamento === 'consorcio') points.economico += 1.2;
  if (input.financiamento === 'financiado') points.esquecido += 0.5;
  if (input.parcelas >= 60) points.abandono += 0.6;

  // Capacidade financeira
  if (comprometimentoRenda > 0.35) points.economico += 1.3;
  else if (comprometimentoRenda > 0.2) points.economico += 0.6;
  if (input.renda_mensal_brl >= 25_000) points.fiel += 0.5;

  // Perfil demográfico
  if (input.idade >= 45) points.fiel += 0.5;
  if (input.idade >= 28 && input.idade < 45) points.esquecido += 0.5;
  if (input.idade < 28) points.abandono += 0.5;

  return points;
}

// ─── Predição dos clientes de exemplo ─────────────────────────

/**
 * Para cada perfil, como distribuir a probabilidade restante entre os demais
 * (perfis "vizinhos" recebem mais — ex.: quem é esquecido pode virar abandono).
 */
const NEIGHBOR_SHARE: Record<Perfil, Record<Perfil, number>> = {
  fiel:      { fiel: 0,    abandono: 0.15, esquecido: 0.45, economico: 0.40 },
  abandono:  { fiel: 0.05, abandono: 0,    esquecido: 0.60, economico: 0.35 },
  esquecido: { fiel: 0.15, abandono: 0.50, esquecido: 0,    economico: 0.35 },
  economico: { fiel: 0.20, abandono: 0.30, esquecido: 0.50, economico: 0 },
};

/** Monta uma Prediction completa a partir do resultado esperado (perfil, risco, confiança). */
export function buildPrediction(params: {
  clientId: string;
  perfil: Perfil;
  risco: number;
  confianca: number;
  createdAt: string;
}): Prediction {
  const { clientId, perfil, risco, confianca, createdAt } = params;
  const restante = 1 - confianca;
  const prob = (p: Perfil) => round(p === perfil ? confianca : restante * NEIGHBOR_SHARE[perfil][p]);

  return {
    id: `${clientId}-pred`,
    client_id: clientId,
    model_version: MODEL_VERSION,
    perfil_predito: perfil,
    risco_evasao: risco,
    confianca,
    prob_fiel: prob('fiel'),
    prob_abandono: prob('abandono'),
    prob_esquecido: prob('esquecido'),
    prob_economico: prob('economico'),
    recomendacoes_acao: ACOES_POR_PERFIL[perfil],
    created_at: createdAt,
  };
}

/** Converte uma Classification em Prediction (usado ao cadastrar cliente). */
export function toPrediction(clientId: string, result: Classification, createdAt: string): Prediction {
  return {
    id: `${clientId}-pred`,
    client_id: clientId,
    model_version: MODEL_VERSION,
    perfil_predito: result.perfil,
    risco_evasao: result.risco,
    confianca: result.confianca,
    prob_fiel: round(result.probabilidades.fiel),
    prob_abandono: round(result.probabilidades.abandono),
    prob_esquecido: round(result.probabilidades.esquecido),
    prob_economico: round(result.probabilidades.economico),
    recomendacoes_acao: result.recomendacoes,
    created_at: createdAt,
  };
}

// ─── Utilitários ─────────────────────────────────────────────

function softmax(points: Probabilities): Probabilities {
  const max = Math.max(...PERFIS.map(p => points[p]));
  const exp = PERFIS.map(p => Math.exp((points[p] - max) / SOFTMAX_TEMPERATURE));
  const total = exp.reduce((a, b) => a + b, 0);
  const result = {} as Probabilities;
  PERFIS.forEach((p, i) => { result[p] = exp[i]! / total; });
  return result;
}

function argmax(probabilidades: Probabilities): Perfil {
  return PERFIS.reduce((best, p) => (probabilidades[p] > probabilidades[best] ? p : best), PERFIS[0]);
}

function riskOf(probabilidades: Probabilities): number {
  const risco = PERFIS.reduce((sum, p) => sum + probabilidades[p] * RISK_WEIGHT[p], 0);
  return Math.min(1, Math.max(0, risco));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
