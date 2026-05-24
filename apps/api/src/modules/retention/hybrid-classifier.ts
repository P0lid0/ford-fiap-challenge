/**
 * Ensemble ML + IA — combina predição do XGBoost com análise do LLM.
 *
 * Estratégia:
 *  - ML é o BASELINE: sempre roda, rápido, determinístico, custo zero.
 *  - IA é o CRÍTICO: roda quando solicitado OU em zona cinza (ML confidence < 0.6).
 *  - Ensemble final:
 *      Concordância (ml.perfil == ai.perfil)
 *        → usa esse perfil. Probabilidades = média ponderada
 *          (ML peso 0.6, IA peso 0.4 por padrão; pesos ajustáveis pela confiança da IA)
 *        → confiança = max(ml.conf, ai.conf)
 *      Discordância
 *        → vai pelo lado com maior CONFIANÇA reportada
 *        → marca a predição como "human_review_needed"
 *        → retorna ambas as predições no payload pra UI mostrar lado a lado
 */
import { predict as mlPredict, type PredictInput } from './ml-client.js';
import {
  classifyWithAI, type AIClassification, type ClientFeatures, type Acao, type Perfil,
} from './ai-classifier.js';

const PERFIS: Perfil[] = ['fiel', 'abandono', 'esquecido', 'economico'];

export type HybridResult = {
  /** Resultado final (ensemble) */
  perfil: Perfil;
  probabilidades: Record<Perfil, number>;
  risco_evasao: number;
  confianca: number;

  /** Origem da decisão */
  source: 'ml_only' | 'ai_only' | 'hybrid';
  concordancia: boolean | null;
  human_review_needed: boolean;

  /** Predições individuais (auditoria) */
  ml: {
    perfil: Perfil;
    probabilidades: Record<Perfil, number>;
    confianca: number;
    model_version: string;
  };
  ai: AIClassification | null;

  /** Detalhes da IA quando disponível */
  raciocinio: string | null;
  signals_detected: string[];

  /** Ações sugeridas (do ML, sempre) */
  recomendacoes_acao: string[];
};

function calcRisco(p: Record<Perfil, number>): number {
  // mesma fórmula do ml-client
  return p.abandono + 0.6 * p.esquecido;
}

/**
 * Mescla probabilidades ML e IA via média ponderada.
 * Peso da IA cresce com sua própria confiança reportada.
 */
function blendProbabilities(
  mlProbs: Record<Perfil, number>,
  aiProbs: Record<Perfil, number>,
  aiConf: number,
): Record<Perfil, number> {
  // Peso IA varia de 0.3 (conf=0) a 0.6 (conf=1)
  const wAI = 0.3 + 0.3 * aiConf;
  const wML = 1 - wAI;
  const blended: Record<Perfil, number> = { fiel: 0, abandono: 0, esquecido: 0, economico: 0 };
  for (const p of PERFIS) {
    blended[p] = wML * (mlProbs[p] ?? 0) + wAI * (aiProbs[p] ?? 0);
  }
  return blended;
}

/**
 * Roda classificação completa. Se features (sem dealership_id) e force=true,
 * sempre chama IA. Caso contrário, IA roda apenas em zona cinza.
 */
export async function classifyHybrid(input: {
  features: ClientFeatures;
  dealership_id: string;
  notas?: string | null;
  acoes?: Acao[];
  /** Força chamada IA mesmo quando ML é confiante. Default: false */
  forceAI?: boolean;
  /** Modelo IA específico (provider:model). Opcional. */
  aiModel?: string;
  /** ACOES_POR_PERFIL do classifier.py — passado pelo caller */
  acoesPorPerfil: Record<Perfil, string[]>;
}): Promise<HybridResult> {
  // 1) ML baseline (sempre)
  const mlInput: PredictInput = { ...input.features, dealership_id: input.dealership_id };
  const ml = await mlPredict(mlInput);

  const mlPart = {
    perfil: ml.perfil_predito,
    probabilidades: ml.probabilidades,
    confianca: ml.confianca,
    model_version: ml.model_version,
  };

  // 2) Decide se chama IA
  const grayZone = ml.confianca < 0.6;
  const shouldCallAI = input.forceAI === true || grayZone;

  let ai: AIClassification | null = null;
  if (shouldCallAI) {
    ai = await classifyWithAI(
      input.features,
      input.notas ?? null,
      input.acoes ?? [],
      { perfil: ml.perfil_predito, probabilidades: ml.probabilidades, confianca: ml.confianca },
      input.aiModel,
    );
  }

  // 3) Ensemble
  if (!ai) {
    // Só ML (IA indisponível ou não solicitada)
    return {
      perfil: ml.perfil_predito,
      probabilidades: ml.probabilidades,
      risco_evasao: ml.risco_evasao,
      confianca: ml.confianca,
      source: 'ml_only',
      concordancia: null,
      human_review_needed: false,
      ml: mlPart,
      ai: null,
      raciocinio: null,
      signals_detected: [],
      recomendacoes_acao: ml.recomendacoes_acao,
    };
  }

  const concordancia = ml.perfil_predito === ai.perfil;

  if (concordancia) {
    // Concordância: blenda probabilidades, confiança = max
    const blended = blendProbabilities(ml.probabilidades, ai.probabilidades, ai.confianca);
    const conf = Math.max(ml.confianca, ai.confianca);
    return {
      perfil: ml.perfil_predito,
      probabilidades: blended,
      risco_evasao: calcRisco(blended),
      confianca: conf,
      source: 'hybrid',
      concordancia: true,
      human_review_needed: false,
      ml: mlPart,
      ai,
      raciocinio: ai.raciocinio,
      signals_detected: ai.signals_detected,
      recomendacoes_acao: input.acoesPorPerfil[ml.perfil_predito] ?? ml.recomendacoes_acao,
    };
  }

  // Discordância: vai com quem tem maior confiança individual
  const aiWins = ai.confianca > ml.confianca;
  const finalPerfil = aiWins ? ai.perfil : ml.perfil_predito;
  const finalProbs = aiWins ? ai.probabilidades : ml.probabilidades;
  const finalConf = Math.max(ml.confianca, ai.confianca) * 0.8; // discount por divergência

  return {
    perfil: finalPerfil,
    probabilidades: finalProbs,
    risco_evasao: calcRisco(finalProbs),
    confianca: finalConf,
    source: 'hybrid',
    concordancia: false,
    human_review_needed: true,
    ml: mlPart,
    ai,
    raciocinio: ai.raciocinio,
    signals_detected: ai.signals_detected,
    recomendacoes_acao: input.acoesPorPerfil[finalPerfil] ?? ml.recomendacoes_acao,
  };
}
