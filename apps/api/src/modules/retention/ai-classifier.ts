/**
 * Classificador de perfil via LLM — complementa o XGBoost.
 *
 * Recebe:
 *   - Features Base 2 (mesmas do modelo ML)
 *   - Notas livres do vendedor
 *   - Histórico de ações tomadas com o cliente (com desfechos)
 *   - Predição do ML (pra IA poder concordar/discordar com base)
 *
 * Retorna:
 *   - perfil + probabilidades por classe
 *   - raciocinio (PT-BR) explicando a decisão
 *   - signals_detected (list de sinais qualitativos achados)
 *   - confidence (0-1)
 *
 * Modelo padrão: tier "smart" (gpt-4o ou claude-sonnet) — aqui a qualidade da
 * análise vale o custo extra ($0.01-0.05 por classificação).
 */
import { chat as aiChat, aiAvailable } from '../../lib/ai.js';

const PERFIS = ['fiel', 'abandono', 'esquecido', 'economico'] as const;
export type Perfil = (typeof PERFIS)[number];

export type ClientFeatures = {
  idade: number; genero: string; regiao: string;
  renda_mensal_brl: number; estado_civil: string;
  score_credito: number; modelo_comprado: string;
  versao_comprada: string; preco_pago_brl: number;
  financiamento: string; parcelas: number;
  canal_aquisicao: string; primeiro_carro: boolean;
  test_drive_realizado: boolean;
};

export type Acao = {
  tipo: string;
  titulo: string;
  descricao?: string | null;
  status: string;
  desfecho?: string | null;
  created_at: string;
};

export type MLPrediction = {
  perfil: Perfil;
  probabilidades: Record<Perfil, number>;
  confianca: number;
};

export type AIClassification = {
  perfil: Perfil;
  probabilidades: Record<Perfil, number>;
  raciocinio: string;
  signals_detected: string[];
  confianca: number;
  model_label: string;
};

const SYSTEM = `Você é um analista sênior de retenção de clientes da Ford, especialista nos 4 perfis
comportamentais definidos pelo programa VIN Share:

  FIEL       — retorna consistentemente à rede oficial, mesmo quando aparece opção
               mais barata. Cliente de alto valor — investir em fidelização premium.
  ESQUECIDO  — quer ser fiel, mas perde timing das revisões. Resgatável com
               lembretes proativos e facilidades (busca/entrega).
  ECONOMICO  — mantém vínculo mas é altamente sensível a preço. Funciona com
               pacote fechado e cross-sell progressivo.
  ABANDONO   — faz no máximo a primeira revisão e migra pra oficinas externas.
               Janela crítica: primeiros 6 meses. Ação proativa e desconto agressivo.

Sua tarefa: dado o perfil socio-econômico do cliente, as notas livres do vendedor
e o histórico de ações tomadas, classificar o cliente em UM dos 4 perfis e
explicar o raciocínio em PT-BR.

REGRAS:
1. Responda APENAS com JSON válido (sem markdown). Schema obrigatório abaixo.
2. As 4 probabilidades devem somar 1.0 (±0.01).
3. confianca: 0-1 — quão certo você está. Use:
     0.9+ se há sinais textuais inequívocos
     0.6-0.8 se a decisão é baseada principalmente em demográficos + ML
     0.3-0.5 se há sinais contraditórios (ML aponta X, notas sugerem Y)
4. raciocinio: 2-3 parágrafos, PT-BR informal, mencionando os principais fatores.
5. signals_detected: lista de tags (snake_case) dos sinais qualitativos identificados.
   Exemplos: ["interesse_upgrade", "reclamacao_atendimento", "indicou_amigos",
   "comparou_concorrente", "agendou_revisao", "respondeu_oferta", "sem_resposta_recorrente",
   "menciona_preco_alto", "menciona_localizacao_distante"].
   Lista vazia se não há sinais textuais relevantes.
6. Considere a predição do XGBoost como BASELINE — você pode concordar ou discordar
   fundamentadamente. Discordância só com sinais textuais fortes.

FORMATO JSON OBRIGATÓRIO:
{
  "perfil": "fiel"|"abandono"|"esquecido"|"economico",
  "probabilidades": {
    "fiel": 0.0,
    "abandono": 0.0,
    "esquecido": 0.0,
    "economico": 0.0
  },
  "raciocinio": "string PT-BR",
  "signals_detected": ["snake_case_tag", ...],
  "confianca": 0.0
}`;

function buildPrompt(
  client: ClientFeatures,
  notas: string | null,
  acoes: Acao[],
  ml: MLPrediction,
): string {
  const acoesText = acoes.length === 0
    ? '— sem ações registradas ainda —'
    : acoes.slice(0, 10).map(a =>
        `[${a.created_at.slice(0, 10)}] ${a.tipo} (status: ${a.status}) "${a.titulo}"` +
        (a.descricao ? ` — ${a.descricao}` : '') +
        (a.desfecho ? ` → ${a.desfecho}` : '')
      ).join('\n');

  return `# Cliente para classificar

## Dados pré-compra (mesmas features do XGBoost)
- Idade: ${client.idade} anos
- Gênero: ${client.genero}
- Região: ${client.regiao}
- Estado civil: ${client.estado_civil}
- Renda mensal: R$ ${client.renda_mensal_brl.toLocaleString('pt-BR')}
- Score de crédito: ${client.score_credito}
- Modelo: ${client.modelo_comprado} ${client.versao_comprada}
- Preço pago: R$ ${client.preco_pago_brl.toLocaleString('pt-BR')}
- Forma de pagamento: ${client.financiamento}${client.parcelas > 0 ? ` (${client.parcelas}x)` : ''}
- Canal de aquisição: ${client.canal_aquisicao}
- Primeiro carro: ${client.primeiro_carro ? 'sim' : 'não'}
- Test drive: ${client.test_drive_realizado ? 'sim' : 'não'}

## Notas livres do vendedor
${notas?.trim() || '— sem notas —'}

## Histórico de ações de retenção tomadas
${acoesText}

## Baseline do XGBoost (modelo ML treinado)
- Perfil predito: **${ml.perfil}** (confiança ${(ml.confianca * 100).toFixed(0)}%)
- Probabilidades: fiel ${(ml.probabilidades.fiel * 100).toFixed(0)}%, ` +
  `esquecido ${(ml.probabilidades.esquecido * 100).toFixed(0)}%, ` +
  `economico ${(ml.probabilidades.economico * 100).toFixed(0)}%, ` +
  `abandono ${(ml.probabilidades.abandono * 100).toFixed(0)}%

---

Classifique esse cliente. Concorda ou discorda do ML? Por quê?
Retorne apenas o JSON conforme schema.`;
}

/**
 * Classifica um cliente via LLM. Retorna null se IA não está disponível.
 */
export async function classifyWithAI(
  client: ClientFeatures,
  notas: string | null,
  acoes: Acao[],
  ml: MLPrediction,
  modelOverride?: string,
): Promise<AIClassification | null> {
  if (!(await aiAvailable())) return null;

  const userPrompt = buildPrompt(client, notas, acoes, ml);

  try {
    const r = await aiChat(userPrompt, 'smart', {
      systemOverride: SYSTEM,
      modelOverride,
      jsonObjectMode: true,
      maxTokens: 1500,
    });
    if (!r.output) return null;

    const cleaned = r.output.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validação básica
    if (!PERFIS.includes(parsed.perfil)) {
      console.warn('[ai-classifier] invalid perfil:', parsed.perfil);
      return null;
    }
    const probs = parsed.probabilidades ?? {};
    for (const p of PERFIS) {
      if (typeof probs[p] !== 'number') probs[p] = 0;
    }
    // Normaliza pra somar 1
    const sum = PERFIS.reduce((s, p) => s + probs[p], 0);
    if (sum > 0 && Math.abs(sum - 1) > 0.05) {
      for (const p of PERFIS) probs[p] /= sum;
    }

    return {
      perfil: parsed.perfil,
      probabilidades: probs,
      raciocinio: String(parsed.raciocinio ?? '').slice(0, 4000),
      signals_detected: Array.isArray(parsed.signals_detected)
        ? parsed.signals_detected.slice(0, 20).map(String)
        : [],
      confianca: typeof parsed.confianca === 'number'
        ? Math.max(0, Math.min(1, parsed.confianca))
        : 0.5,
      model_label: `${r.provider}:${r.model}`,
    };
  } catch (err: any) {
    console.error('[ai-classifier] failed:', err?.message);
    return null;
  }
}
