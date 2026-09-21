import type { FastifyInstance } from 'fastify';
import { requireUser } from '../plugins/auth.js';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { aiAvailable, chat } from '../lib/ai.js';
import { sql } from '../lib/db.js';
import { dealershipFilter } from '../lib/scope.js';

const HOUR = 60 * 60 * 1000;
const TTL_PORTFOLIO = 6 * HOUR;
const TTL_CLIENT = 24 * HOUR;

function hashPayload(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 24);
}

type CachedInsight = { output: string; model_used: string; created_at: Date; expires_at: Date | null };

// Cache de insights é global (não depende do escopo do usuário): o hash do
// payload já garante que só reaproveitamos a mesma pergunta sobre os mesmos dados.
async function cachedInsight(scope: string, resourceId: string, payloadHash: string) {
  const [data] = await sql<CachedInsight[]>`
    select output, model_used, created_at, expires_at
    from public.ai_insights
    where scope = ${scope} and resource_id = ${resourceId} and payload_hash = ${payloadHash}
  `;
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
}

async function storeInsight(scope: string, resourceId: string, payloadHash: string, model: string, output: string, ttlMs: number) {
  const row = {
    scope, resource_id: resourceId, payload_hash: payloadHash,
    model_used: model, output, expires_at: new Date(Date.now() + ttlMs).toISOString(),
  };
  // upsert em (scope, resource_id, payload_hash) — índice único ai_insights_hash_uidx
  await sql`
    insert into public.ai_insights ${sql(row)}
    on conflict (scope, resource_id, payload_hash) do update set
      model_used = excluded.model_used,
      output = excluded.output,
      expires_at = excluded.expires_at
  `;
}

/** Modelo preferido do usuário para uma função de IA (ai_function_models), ou undefined. */
async function preferredModel(userId: string, functionName: string): Promise<string | undefined> {
  const [pref] = await sql<{ model_id: string }[]>`
    select model_id from public.ai_function_models
    where user_id = ${userId} and function_name = ${functionName}
  `;
  return pref?.model_id;
}

export async function insightRoutes(app: FastifyInstance) {
  app.get('/insights/client/:id', {
    schema: {
      tags: ['Diferencial — Insights de IA'],
      summary: 'Explicação em linguagem natural da classificação do cliente (XAI)',
      params: z.object({ id: z.string().uuid() }),
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const { id } = req.params as any;

    // Antes o RLS escondia clientes de outra dealership (virava 404); o filtro
    // explícito preserva esse comportamento.
    const [client] = await sql`
      select * from public.clients
      where id = ${id} ${dealershipFilter(u)}
    `;
    if (!client) { reply.code(404); return { error: 'not_found' }; }
    // Escopo da predição já garantido pelo cliente acima.
    const [pred] = await sql`
      select * from public.predictions
      where client_id = ${id}
      order by created_at desc
      limit 1
    `;
    if (!pred) { reply.code(404); return { error: 'no_prediction' }; }

    const payload = { client_id: id, perfil: pred.perfil_predito };
    const hash = hashPayload(payload);
    const cached = await cachedInsight('client', id, hash);
    if (cached) return { source: 'cache', model: cached.model_used, output: cached.output };

    if (!aiAvailable()) {
      return { source: 'fresh', model: 'rule-based-fallback', output: fallbackClientText(client, pred) };
    }

    let aiModel = req.headers['x-ai-model'] as string | undefined;
    if (!aiModel) aiModel = await preferredModel(u.id, 'client_insight');
    const r = await chat(buildClientPrompt(client, pred), 'fast', { modelOverride: aiModel });
    if (!r.output) {
      return { source: 'fresh', model: 'rule-based-fallback', output: fallbackClientText(client, pred) };
    }
    const modelLabel = `${r.provider}:${r.model}`;
    await storeInsight('client', id, hash, modelLabel, r.output, TTL_CLIENT);
    return { source: 'fresh', model: modelLabel, output: r.output };
  });

  app.get('/insights/portfolio', {
    schema: {
      tags: ['Diferencial — Insights de IA'],
      summary: 'Análise estratégica da carteira do analista',
    },
  }, async (req) => {
    const u = requireUser(req);
    // Embed 1:N `predictions(...)` do PostgREST → array via json_agg (mais recente
    // primeiro). O RLS limitava o analista à própria dealership; aqui é explícito.
    const clients = await sql<{
      id: string;
      modelo_comprado: string;
      renda_mensal_brl: number;
      predictions: { perfil_predito: string; risco_evasao: number }[];
    }[]>`
      select c.id, c.modelo_comprado, c.renda_mensal_brl,
        coalesce((
          select json_agg(json_build_object('perfil_predito', p.perfil_predito, 'risco_evasao', p.risco_evasao)
                          order by p.created_at desc)
          from public.predictions p
          where p.client_id = c.id
        ), '[]'::json) as predictions
      from public.clients c
      where true ${dealershipFilter(u, 'c.dealership_id')}
      limit 500
    `;

    const safe = clients ?? [];
    const totalClients = safe.length;
    const perfilCounts: Record<string, number> = { fiel: 0, abandono: 0, esquecido: 0, economico: 0 };
    let avgRisco = 0;
    for (const c of safe as any[]) {
      const p = c.predictions?.[0];
      if (!p) continue;
      perfilCounts[p.perfil_predito] = (perfilCounts[p.perfil_predito] ?? 0) + 1;
      avgRisco += p.risco_evasao;
    }
    avgRisco = totalClients > 0 ? avgRisco / totalClients : 0;
    const metrics = { dealership_id: u.dealership_id, totalClients, perfilCounts, avgRisco };
    const hash = hashPayload(metrics);
    const cached = await cachedInsight('portfolio', u.dealership_id ?? 'all', hash);
    if (cached) return { source: 'cache', metrics, model: cached.model_used, output: cached.output };

    if (!aiAvailable()) {
      return { source: 'fresh', metrics, model: 'rule-based-fallback', output: fallbackPortfolioText(totalClients, perfilCounts, avgRisco) };
    }
    let aiModel = req.headers['x-ai-model'] as string | undefined;
    if (!aiModel) aiModel = await preferredModel(u.id, 'portfolio_insight');
    const r = await chat(buildPortfolioPrompt(totalClients, perfilCounts, avgRisco), 'smart', { modelOverride: aiModel });
    if (!r.output) {
      return { source: 'fresh', metrics, model: 'rule-based-fallback', output: fallbackPortfolioText(totalClients, perfilCounts, avgRisco) };
    }
    const modelLabel = `${r.provider}:${r.model}`;
    await storeInsight('portfolio', u.dealership_id ?? 'all', hash, modelLabel, r.output, TTL_PORTFOLIO);
    return { source: 'fresh', metrics, model: modelLabel, output: r.output };
  });
}

function buildClientPrompt(client: any, pred: any) {
  return `Em 3-5 frases curtas, explique POR QUE este cliente foi classificado como "${pred.perfil_predito}".
Use SOMENTE os dados abaixo. Não invente. Termine com UMA ação concreta priorizada para o consultor.

Dados (momento da compra):
- Idade: ${client.idade} | Gênero: ${client.genero} | Estado civil: ${client.estado_civil}
- Região: ${client.regiao} | Renda: R$ ${client.renda_mensal_brl.toLocaleString('pt-BR')}
- Score de crédito: ${client.score_credito}
- Modelo: ${client.modelo_comprado} ${client.versao_comprada}
- Preço pago: R$ ${client.preco_pago_brl.toLocaleString('pt-BR')}
- Financiamento: ${client.financiamento} (${client.parcelas}x)
- Canal: ${client.canal_aquisicao} | Primeiro carro: ${client.primeiro_carro ? 'sim' : 'não'} | Test drive: ${client.test_drive_realizado ? 'sim' : 'não'}

Probabilidades preditas:
- fiel: ${(pred.prob_fiel * 100).toFixed(0)}%
- abandono: ${(pred.prob_abandono * 100).toFixed(0)}%
- esquecido: ${(pred.prob_esquecido * 100).toFixed(0)}%
- econômico: ${(pred.prob_economico * 100).toFixed(0)}%
Risco de evasão: ${(pred.risco_evasao * 100).toFixed(0)}%.`;
}

function buildPortfolioPrompt(total: number, counts: Record<string, number>, avgRisco: number) {
  return `Analise a carteira da concessionária Ford e produza um briefing executivo em até 6 bullets curtos.
Aponte: a) maior risco; b) melhor oportunidade de upsell/loyalty; c) recomendação imediata para o gestor.

Dados:
- Total de clientes: ${total}
- Distribuição:
  - fiel: ${counts['fiel']} (${total ? Math.round((counts['fiel']! / total) * 100) : 0}%)
  - abandono: ${counts['abandono']} (${total ? Math.round((counts['abandono']! / total) * 100) : 0}%)
  - esquecido: ${counts['esquecido']} (${total ? Math.round((counts['esquecido']! / total) * 100) : 0}%)
  - econômico: ${counts['economico']} (${total ? Math.round((counts['economico']! / total) * 100) : 0}%)
- Risco médio de evasão: ${Math.round(avgRisco * 100)}%`;
}

function fallbackClientText(_client: any, pred: any): string {
  const probs = [
    ['fiel', pred.prob_fiel], ['abandono', pred.prob_abandono],
    ['esquecido', pred.prob_esquecido], ['econômico', pred.prob_economico],
  ] as const;
  const dominante = probs.reduce((a, b) => (a[1] > b[1] ? a : b));
  return `Cliente classificado como ${pred.perfil_predito} com ${Math.round(pred.confianca * 100)}% de confiança. ` +
    `Probabilidade dominante: ${dominante[0]} (${Math.round(dominante[1] * 100)}%). ` +
    `Risco de evasão estimado em ${Math.round(pred.risco_evasao * 100)}%. ` +
    `Para análise textual com IA configure OPENAI_API_KEY.`;
}

function fallbackPortfolioText(total: number, counts: Record<string, number>, avgRisco: number): string {
  return `Carteira com ${total} clientes ativos. Risco médio de evasão: ${Math.round(avgRisco * 100)}%. ` +
    `${counts['abandono']} cliente(s) em perfil abandono. ${counts['fiel']} cliente(s) fiéis (foco em upsell).`;
}
