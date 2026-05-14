import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { publicClient } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { predict } from '../modules/retention/ml-client.js';

const CreateClientBody = z.object({
  // Base 2 — pré-compra
  idade: z.number().int().min(18).max(95),
  genero: z.enum(['M', 'F', 'outro']),
  regiao: z.enum(['sul', 'sudeste', 'centro_oeste', 'nordeste', 'norte']),
  renda_mensal_brl: z.number().int().min(0),
  estado_civil: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo']),
  score_credito: z.number().int().min(0).max(1000),
  modelo_comprado: z.string().min(1).max(60),
  versao_comprada: z.string().min(1).max(60),
  preco_pago_brl: z.number().int().min(0),
  financiamento: z.enum(['a_vista', 'financiado', 'leasing', 'consorcio']),
  parcelas: z.number().int().min(0).max(84),
  canal_aquisicao: z.enum(['concessionaria', 'online', 'frota', 'indicacao']),
  primeiro_carro: z.boolean(),
  test_drive_realizado: z.boolean(),
  // Identidade (vai ser anonimizada antes de gravar)
  nome_cliente: z.string().min(1).max(120).optional(),
  cpf: z.string().regex(/^\d{11}$/).optional(),
});

function hashCpf(cpf: string): string {
  return createHash('sha256').update(cpf + 'ford-fiap-pepper').digest('hex');
}

export async function clientRoutes(app: FastifyInstance) {
  // Cadastrar venda + disparar predição automática
  app.post('/clients', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Cadastra cliente (venda) e dispara classificação automática',
      body: CreateClientBody,
    },
  }, async (req, reply) => {
    const u = req.requireUser();
    if (!u.dealership_id) {
      reply.code(400);
      return { error: 'no_dealership', message: 'usuário não está vinculado a uma concessionária' };
    }

    const body = req.body as z.infer<typeof CreateClientBody>;
    const { cpf, ...rest } = body;
    const sb = publicClient(u.jwt);

    const { data: client, error } = await sb.from('clients').insert({
      ...rest,
      dealership_id: u.dealership_id,
      created_by: u.id,
      cpf_hash: cpf ? hashCpf(cpf) : null,
    }).select().single();
    if (error) throw error;

    // Dispara predição síncrona (estamos cadastrando 1 a 1, latência aceitável)
    const prediction = await predict({
      idade: rest.idade, genero: rest.genero, regiao: rest.regiao,
      renda_mensal_brl: rest.renda_mensal_brl, estado_civil: rest.estado_civil,
      score_credito: rest.score_credito, modelo_comprado: rest.modelo_comprado,
      versao_comprada: rest.versao_comprada, preco_pago_brl: rest.preco_pago_brl,
      financiamento: rest.financiamento, parcelas: rest.parcelas,
      canal_aquisicao: rest.canal_aquisicao, primeiro_carro: rest.primeiro_carro,
      test_drive_realizado: rest.test_drive_realizado, dealership_id: u.dealership_id,
    });

    const { data: predRow } = await sb.from('predictions').insert({
      client_id: client.id,
      model_version: prediction.model_version,
      perfil_predito: prediction.perfil_predito,
      prob_fiel: prediction.probabilidades.fiel,
      prob_abandono: prediction.probabilidades.abandono,
      prob_esquecido: prediction.probabilidades.esquecido,
      prob_economico: prediction.probabilidades.economico,
      risco_evasao: prediction.risco_evasao,
      confianca: prediction.confianca,
      recomendacoes_acao: prediction.recomendacoes_acao,
    }).select().single();

    await logAudit({
      actor_id: u.id, action: 'client.created', entity: 'clients',
      entity_id: client.id, metadata: { perfil: prediction.perfil_predito },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    });

    reply.code(201);
    return { client, prediction: predRow };
  });

  // Lista clientes da carteira (filtros + paginação)
  app.get('/clients', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Lista clientes da carteira (filtrado por RLS na dealership)',
      querystring: z.object({
        perfil: z.enum(['fiel', 'abandono', 'esquecido', 'economico']).optional(),
        risco_min: z.coerce.number().min(0).max(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
  }, async (req) => {
    const u = req.requireUser();
    const { perfil, risco_min, limit, offset } = req.query as any;
    const sb = publicClient(u.jwt);

    let q = sb
      .from('clients')
      .select('*, predictions(perfil_predito, risco_evasao, confianca, created_at)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    if (error) throw error;

    let filtered = data ?? [];
    if (perfil) {
      filtered = filtered.filter((c: any) =>
        c.predictions?.some((p: any) => p.perfil_predito === perfil));
    }
    if (typeof risco_min === 'number') {
      filtered = filtered.filter((c: any) =>
        c.predictions?.some((p: any) => p.risco_evasao >= risco_min));
    }
    return { total: count ?? 0, results: filtered };
  });

  // Detalhe + histórico de predições
  app.get('/clients/:id', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Detalhe do cliente (Base 2 + todas as predições)',
      params: z.object({ id: z.string().uuid() }),
    },
  }, async (req, reply) => {
    const u = req.requireUser();
    const { id } = req.params as any;
    const sb = publicClient(u.jwt);
    const { data: client, error } = await sb.from('clients').select('*').eq('id', id).single();
    if (error || !client) { reply.code(404); return { error: 'not_found' }; }

    const { data: predictions } = await sb
      .from('predictions').select('*').eq('client_id', id).order('created_at', { ascending: false });
    const { data: history } = await sb
      .from('client_history').select('*').eq('client_id', id).order('observado_em', { ascending: false });

    return { client, predictions: predictions ?? [], history: history ?? [] };
  });

  // Leads priorizados — proativos (varredura batch da carteira)
  app.get('/clients/leads', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Lista priorizada de clientes em alto risco — leads para o consultor',
      querystring: z.object({
        risco_min: z.coerce.number().min(0).max(1).default(0.6),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      }),
    },
  }, async (req) => {
    const u = req.requireUser();
    const { risco_min, limit } = req.query as any;
    const sb = publicClient(u.jwt);
    const { data, error } = await sb
      .from('predictions')
      .select('*, clients!inner(id, modelo_comprado, versao_comprada, nome_cliente, data_compra, dealership_id)')
      .gte('risco_evasao', risco_min)
      .order('risco_evasao', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  });
}
