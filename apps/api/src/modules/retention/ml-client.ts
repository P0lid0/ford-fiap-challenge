// Cliente HTTP para o serviço Python de ML.
// Falha silenciosamente para uma resposta mock se o serviço estiver fora —
// MVP-friendly. Em produção, propague o erro e use circuit breaker.

import { fetch } from 'undici';
import { env } from '../../config.js';

export type PredictInput = {
  idade: number; genero: string; regiao: string; renda_mensal_brl: number;
  estado_civil: string; score_credito: number; modelo_comprado: string;
  versao_comprada: string; preco_pago_brl: number; financiamento: string;
  parcelas: number; canal_aquisicao: string; primeiro_carro: boolean;
  test_drive_realizado: boolean; dealership_id: string;
};

export type PredictOutput = {
  model_version: string;
  perfil_predito: 'fiel' | 'abandono' | 'esquecido' | 'economico';
  probabilidades: Record<'fiel' | 'abandono' | 'esquecido' | 'economico', number>;
  risco_evasao: number;
  confianca: number;
  recomendacoes_acao: string[];
};

export async function predict(input: PredictInput): Promise<PredictOutput> {
  try {
    const res = await fetch(`${env.ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${env.ML_SERVICE_TOKEN}`,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`ml status=${res.status}`);
    return await res.json() as PredictOutput;
  } catch (err) {
    console.error('[ml-client] fallback to mock — ML service unavailable', err);
    // Mock determinístico para não bloquear UI durante demo.
    const lowAderencia = input.financiamento === 'financiado' && input.parcelas >= 60;
    const perfil = lowAderencia ? 'abandono'
      : input.renda_mensal_brl > 12000 ? 'fiel'
      : input.preco_pago_brl < 80000 ? 'economico' : 'esquecido';
    const probabilidades = { fiel: 0.2, abandono: 0.2, esquecido: 0.2, economico: 0.2 } as const;
    return {
      model_version: 'mock-fallback-0',
      perfil_predito: perfil,
      probabilidades: { ...probabilidades, [perfil]: 0.55 },
      risco_evasao: perfil === 'abandono' ? 0.75 : perfil === 'esquecido' ? 0.45 : 0.15,
      confianca: 0.55,
      recomendacoes_acao: [`fallback — ML service offline, perfil heurístico=${perfil}`],
    };
  }
}
