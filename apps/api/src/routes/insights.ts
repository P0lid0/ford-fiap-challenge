import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config.js';
import { publicClient, adminClient } from '../lib/supabase.js';

// Cliente Anthropic (instância única). Falta de API key cai em fallback rule-based.
const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

const HOUR = 60 * 60 * 1000;
const TTL_PORTFOLIO = 6 * HOUR;
const TTL_CLIENT = 24 * HOUR;

function hashPayload(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 24);
}

async function cachedInsight(scope: string, resourceId: string, payloadHash: string) {
  const { data } = await adminClient()
    .from('ai_insights').select('output, model_used, created_at, expires_at')
    .eq('scope', scope).eq('resource_id', resourceId).eq('payload_hash', payloadHash)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
}

async function storeInsight(scope: string, resourceId: string, payloadHash: string, model: string, output: string, ttlMs: number) {
  await adminClient().from('ai_insights').upsert({
    scope, resource_id: resourceId, payload_hash: payloadHash,
    model_used: model, output, expires_at: new Date(Date.now() + ttlMs).toISOString(),
  }, { onConflict: 'scope,resource_id,payload_hash' });
}

export async function insightRoutes(app: FastifyInstance) {
  // XAI por cliente — explica em PT-BR por que aquele perfil foi predito.
  app.get('/insights/client/:id', {
    schema: {
      tags: ['Diferencial — Insights de IA'],
      summary: 'Explicação em linguagem natural da classificação do cliente',
      params: z.object({ id: z.string().uuid() }),
    },
  }, async (req, reply) => {
    const u = req.requireUser();
    const { id } = req.params as any;
    const sb = publicClient(u.jwt);

    const { data: client, error } = await sb.from('clients').select('*').eq('id', id).single();
    if (error || !client) { reply.code(404); return { error: 'not_found' }; }
    const { data: pred } = await sb.from('predictions').select('*')
      .eq('client_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!pred) { reply.code(404); return { error: 'no_prediction' }; }

    const payload = { client_id: id, perfil: pred.perfil_predito, probabilidades: {
      fiel: pred.prob_fiel, abandono: pred.prob_abandono, esquecido: pred.prob_esquecido, economico: pred.prob_economico,
    }};
    const hash = hashPayload(payload);
    const cached = await cachedInsight('client', id, hash);
    if (cached) return { source: 'cache', model: cached.model_used, output: cached.output };

    const prompt = `Você é um analista de retenção da rede Ford. Em 3-5 frases curtas em PT-BR,
explique POR QUE este cliente foi classificado como "${pred.perfil_predito}". Use os dados
abaixo. Não invente. Termine com UMA ação concreta e priorizada para o consultor.

Dados do cliente (momento da compra):
- Idade: ${client.idade}, Gênero: ${client.genero}, Estado civil: ${client.estado_civil}
- Região: ${client.regiao}, Renda: R$ ${client.renda_mensal_brl.toLocaleString('pt-BR')}
- Score: ${client.score_credito}
- Modelo: ${client.modelo_comprado} ${client.versao_comprada}
- Preço pago: R$ ${client.preco_pago_brl.toLocaleString('pt-BR')}
- Financiamento: ${client.financiamento} (${client.parcelas}x)
- Canal: ${client.canal_aquisicao}, Primeiro carro: ${client.primeiro_carro ? 'sim' : 'não'}, Test drive: ${client.test_drive_realizado ? 'sim' : 'não'}

Probabilidades preditas:
- fiel: ${(pred.prob_fiel * 100).toFixed(0)}%
- abandono: ${(pred.prob_abandono * 100).toFixed(0)}%
- esquecido: ${(pred.prob_esquecido * 100).toFixed(0)}%
- econômico: ${(pred.prob_economico * 100).toFixed(0)}%
Risco de evasão: ${(pred.risco_evasao * 100).toFixed(0)}%.`;

    let output: string;
    let model: string;
    if (anthropic) {
      model = env.CLAUDE_MODEL_FAST;
      const msg = await anthropic.messages.create({
        model, max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });
      output = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    } else {
      model = 'rule-based-fallback';
      output = `Cliente classificado como ${pred.perfil_predito} com ${(pred.confianca * 100).toFixed(0)}% de confiança. ` +
        `Probabilidade dominante: ${(Math.max(pred.prob_fiel, pred.prob_abandono, pred.prob_esquecido, pred.prob_economico) * 100).toFixed(0)}%. ` +
        `Para análise detalhada com linguagem natural, configure ANTHROPIC_API_KEY.`;
    }

    await storeInsight('client', id, hash, model, output, TTL_CLIENT);
    return { source: 'fresh', model, output };
  });

  // Insights da carteira (agregado da dealership do usuário)
  app.get('/insights/portfolio', {
    schema: {
      tags: ['Diferencial — Insights de IA'],
      summary: 'Análise estratégica da carteira do analista em PT-BR',
    },
  }, async (req) => {
    const u = req.requireUser();
    const sb = publicClient(u.jwt);

    // Métricas agregadas
    const { data: clients } = await sb.from('clients')
      .select('id, modelo_comprado, renda_mensal_brl, predictions(perfil_predito, risco_evasao)')
      .limit(500);

    const safeClients = clients ?? [];
    const totalClients = safeClients.length;
    const perfilCounts: Record<string, number> = { fiel: 0, abandono: 0, esquecido: 0, economico: 0 };
    let avgRisco = 0;
    for (const c of safeClients as any[]) {
      const p = c.predictions?.[0];
      if (!p) continue;
      perfilCounts[p.perfil_predito] = (perfilCounts[p.perfil_predito] ?? 0) + 1;
      avgRisco += p.risco_evasao;
    }
    avgRisco = totalClients > 0 ? avgRisco / totalClients : 0;

    const payload = { dealership_id: u.dealership_id, totalClients, perfilCounts, avgRisco };
    const hash = hashPayload(payload);
    const cached = await cachedInsight('portfolio', u.dealership_id ?? 'all', hash);
    if (cached) return { source: 'cache', metrics: payload, model: cached.model_used, output: cached.output };

    const prompt = `Você é um analista sênior de retenção da Ford. Analise a carteira da concessionária e produza
um briefing executivo em PT-BR (máximo 6 bullets). Identifique: a) maior risco;
b) melhor oportunidade de upsell; c) recomendação imediata para o gestor. Sem floreio.

Dados:
- Total de clientes: ${totalClients}
- Distribuição de perfis:
  - fiel: ${perfilCounts['fiel']} (${totalClients ? ((perfilCounts['fiel']! / totalClients) * 100).toFixed(0) : 0}%)
  - abandono: ${perfilCounts['abandono']} (${totalClients ? ((perfilCounts['abandono']! / totalClients) * 100).toFixed(0) : 0}%)
  - esquecido: ${perfilCounts['esquecido']} (${totalClients ? ((perfilCounts['esquecido']! / totalClients) * 100).toFixed(0) : 0}%)
  - econômico: ${perfilCounts['economico']} (${totalClients ? ((perfilCounts['economico']! / totalClients) * 100).toFixed(0) : 0}%)
- Risco médio de evasão: ${(avgRisco * 100).toFixed(0)}%`;

    let output: string; let model: string;
    if (anthropic) {
      model = env.CLAUDE_MODEL_SMART;
      const msg = await anthropic.messages.create({ model, max_tokens: 600,
        messages: [{ role: 'user', content: prompt }] });
      output = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    } else {
      model = 'rule-based-fallback';
      output = `Carteira com ${totalClients} clientes. Risco médio: ${(avgRisco * 100).toFixed(0)}%. ` +
        `${perfilCounts['abandono']} cliente(s) em alto risco (perfil abandono). Configure ANTHROPIC_API_KEY para insights ricos.`;
    }

    await storeInsight('portfolio', u.dealership_id ?? 'all', hash, model, output, TTL_PORTFOLIO);
    return { source: 'fresh', metrics: payload, model, output };
  });
}
