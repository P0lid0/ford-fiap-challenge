// Cliente HTTP para o serviço Python de ML.
// Cybersec:
//  - dealership_id é PSEUDONIMIZADO via HMAC-SHA256 antes de sair da API gateway
//    (ML service nunca vê o UUID original).
//  - Body assinado com HMAC-SHA256 no header X-Payload-Signature (integridade
//    em trânsito + previne replay manipulado).
//  - Sem PII direta no payload (nome, cpf, email, telefone NUNCA sobem).
// Falha silenciosamente para resposta mock se o serviço estiver fora — MVP-friendly.

import { createHmac, timingSafeEqual } from 'node:crypto';
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

/** HMAC-SHA256(secret, value) → hex de 16 chars (suficiente pra colisão prática zero a essa escala). */
function pseudonymize(value: string): string {
  return createHmac('sha256', env.ML_SERVICE_TOKEN).update(value).digest('hex').slice(0, 16);
}

/** Assina body para garantir integridade — ML service verifica antes de processar. */
function signPayload(body: string): string {
  return createHmac('sha256', env.ML_SERVICE_TOKEN).update(body).digest('hex');
}

export async function predict(input: PredictInput): Promise<PredictOutput> {
  // Substitui dealership_id pelo pseudônimo determinístico.
  // ML reproduz o mesmo hash localmente quando precisa correlacionar, sem nunca ver o UUID.
  const safeInput = {
    ...input,
    dealership_id: pseudonymize(input.dealership_id),
  };
  const body = JSON.stringify(safeInput);
  const signature = signPayload(body);

  try {
    const res = await fetch(`${env.ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${env.ML_SERVICE_TOKEN}`,
        'x-payload-signature': signature,
      },
      body,
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

/** Exportado para testes / outros consumidores (ex: ingest). */
export function _verifySignature(body: string, signature: string): boolean {
  const expected = signPayload(body);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
