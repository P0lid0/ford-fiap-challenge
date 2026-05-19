/**
 * Ações de retenção — registro/timeline de toques com cliente (D2).
 *
 * Casos de uso:
 *   - Vendedor liga pra cliente em risco e registra a ligação
 *   - Gestor dispara campanha em lote pra todos os "Esquecidos" da loja
 *   - Painel de produtividade do consultor
 *   - Histórico que alimenta o re-treino do modelo (ação X → desfecho Y)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { requireUser } from '../plugins/auth.js';
import { adminClient, publicClient } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';

const TIPOS = ['ligacao', 'whatsapp', 'email', 'sms', 'visita_presencial',
               'oferta_enviada', 'agendamento_revisao', 'outro'] as const;
const STATUSES = ['planejada', 'em_andamento', 'concluida_sucesso',
                  'concluida_recusa', 'sem_resposta', 'cancelada'] as const;
const PERFIS = ['fiel', 'abandono', 'esquecido', 'economico'] as const;

const CreateAcaoBody = z.object({
  client_id: z.string().uuid(),
  tipo: z.enum(TIPOS),
  titulo: z.string().min(2).max(200),
  descricao: z.string().max(2000).optional(),
  perfil_alvo: z.enum(PERFIS).optional(),
  risco_no_disparo: z.number().min(0).max(1).optional(),
  scheduled_for: z.string().datetime().optional(),
  status: z.enum(STATUSES).default('planejada'),
});

const UpdateAcaoBody = z.object({
  status: z.enum(STATUSES).optional(),
  desfecho: z.string().max(2000).optional(),
  descricao: z.string().max(2000).optional(),
  titulo: z.string().min(2).max(200).optional(),
}).refine(o => Object.keys(o).length > 0, { message: 'envie pelo menos um campo' });

const CampaignBody = z.object({
  perfil: z.enum(PERFIS),
  tipo: z.enum(TIPOS),
  titulo: z.string().min(2).max(200),
  descricao: z.string().max(2000).optional(),
  risco_min: z.number().min(0).max(1).optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export async function acoesRoutes(app: FastifyInstance) {

  // ===== CRIAR ação individual =====
  app.post('/acoes', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Registra uma ação de retenção tomada com um cliente',
      body: CreateAcaoBody,
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    if (!u.dealership_id) {
      reply.code(400);
      return { error: 'no_dealership', message: 'usuário não está vinculado a uma concessionária' };
    }
    const body = req.body as z.infer<typeof CreateAcaoBody>;
    const sb = adminClient();

    // Confirma que o client pertence à mesma dealership (defense in depth além da RLS)
    const { data: client } = await sb.from('clients')
      .select('id, dealership_id').eq('id', body.client_id).maybeSingle();
    if (!client || client.dealership_id !== u.dealership_id) {
      reply.code(404);
      return { error: 'client_not_found' };
    }

    const { data, error } = await sb.from('acoes_retencao').insert({
      ...body,
      dealership_id: u.dealership_id,
      actor_id: u.id,
      completed_at: body.status?.startsWith('concluida_') ? new Date().toISOString() : null,
    }).select().single();
    if (error) {
      req.log.error({ error }, '[acoes] insert failed');
      reply.code(400);
      return { error: 'insert_failed', message: error.message };
    }

    await logAudit({
      actor_id: u.id, action: 'acao.created', entity: 'acoes_retencao',
      entity_id: data.id, metadata: { tipo: body.tipo, client_id: body.client_id },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    });
    reply.code(201);
    return data;
  });

  // ===== LISTAR ações (todas da dealership ou de um cliente) =====
  app.get('/acoes', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Lista ações da concessionária com filtros',
      querystring: z.object({
        client_id: z.string().uuid().optional(),
        status: z.enum(STATUSES).optional(),
        tipo: z.enum(TIPOS).optional(),
        perfil_alvo: z.enum(PERFIS).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const q = req.query as any;
    const sb = publicClient(u.jwt);

    let query = sb.from('acoes_retencao')
      .select('*, clients!inner(id, modelo_comprado, versao_comprada, nome_cliente)',
              { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(q.offset, q.offset + q.limit - 1);

    if (q.client_id) query = query.eq('client_id', q.client_id);
    if (q.status) query = query.eq('status', q.status);
    if (q.tipo) query = query.eq('tipo', q.tipo);
    if (q.perfil_alvo) query = query.eq('perfil_alvo', q.perfil_alvo);

    const { data, error, count } = await query;
    if (error) throw error;
    return { total: count ?? 0, results: data ?? [] };
  });

  // ===== ATUALIZAR ação (status, desfecho, etc) =====
  app.patch('/acoes/:id', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Atualiza status/desfecho de uma ação',
      params: z.object({ id: z.string().uuid() }),
      body: UpdateAcaoBody,
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const body = req.body as z.infer<typeof UpdateAcaoBody>;
    const sb = adminClient();

    const updates: any = { ...body };
    if (body.status?.startsWith('concluida_')) {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await sb.from('acoes_retencao')
      .update(updates).eq('id', id).select().single();
    if (error || !data) {
      reply.code(404);
      return { error: 'not_found_or_failed', message: error?.message };
    }

    await logAudit({
      actor_id: u.id, action: 'acao.updated', entity: 'acoes_retencao',
      entity_id: id, metadata: { status: body.status },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    });
    return data;
  });

  // ===== CAMPANHA em lote (cria N ações pra todos do perfil) =====
  app.post('/acoes/campanha', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Dispara campanha em lote — cria 1 ação planejada para cada cliente do perfil',
      body: CampaignBody,
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    if (!u.dealership_id) {
      reply.code(400);
      return { error: 'no_dealership' };
    }
    if (u.role !== 'gestor' && u.role !== 'admin') {
      reply.code(403);
      return { error: 'forbidden', message: 'apenas gestor/admin pode criar campanhas' };
    }
    const b = req.body as z.infer<typeof CampaignBody>;
    const sb = adminClient();

    // Busca clientes alvo
    let q = sb.from('clients')
      .select('id, predictions(perfil_predito, risco_evasao)')
      .eq('dealership_id', u.dealership_id)
      .limit(b.limit);
    const { data: clients, error: cerr } = await q;
    if (cerr) throw cerr;

    const targets = (clients ?? []).filter((c: any) => {
      const p = c.predictions?.[0];
      if (!p || p.perfil_predito !== b.perfil) return false;
      if (typeof b.risco_min === 'number' && p.risco_evasao < b.risco_min) return false;
      return true;
    });

    if (targets.length === 0) {
      return { ok: true, campaign_id: null, created: 0, message: 'nenhum cliente match' };
    }

    const campaign_id = randomUUID();
    const rows = targets.map((c: any) => ({
      client_id: c.id,
      dealership_id: u.dealership_id,
      actor_id: u.id,
      tipo: b.tipo,
      titulo: b.titulo,
      descricao: b.descricao,
      perfil_alvo: b.perfil,
      risco_no_disparo: c.predictions[0].risco_evasao,
      status: 'planejada' as const,
      campaign_id,
    }));

    const { data, error } = await sb.from('acoes_retencao').insert(rows).select();
    if (error) {
      req.log.error({ error }, '[campaign] insert failed');
      reply.code(400);
      return { error: 'campaign_failed', message: error.message };
    }

    await logAudit({
      actor_id: u.id, action: 'campaign.created', entity: 'acoes_retencao',
      entity_id: campaign_id,
      metadata: { perfil: b.perfil, tipo: b.tipo, count: data?.length ?? 0 },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    });
    reply.code(201);
    return { ok: true, campaign_id, created: data?.length ?? 0 };
  });

  // ===== KPIs de ações (pra dashboard) =====
  app.get('/acoes/kpis', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'KPIs agregados de ações da concessionária',
    },
  }, async (req) => {
    const u = requireUser(req);
    const sb = publicClient(u.jwt);
    const { data } = await sb.from('acoes_retencao').select('status, tipo, perfil_alvo, created_at, completed_at');
    const rows = data ?? [];

    const total = rows.length;
    const byStatus: Record<string, number> = {};
    const byTipo: Record<string, number> = {};
    const byPerfil: Record<string, number> = {};
    let concluidas = 0, sucessos = 0;
    let leadTimeMs = 0, leadTimeN = 0;

    for (const r of rows as any[]) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      byTipo[r.tipo] = (byTipo[r.tipo] ?? 0) + 1;
      if (r.perfil_alvo) byPerfil[r.perfil_alvo] = (byPerfil[r.perfil_alvo] ?? 0) + 1;
      if (r.status?.startsWith('concluida_')) {
        concluidas++;
        if (r.status === 'concluida_sucesso') sucessos++;
        if (r.completed_at && r.created_at) {
          leadTimeMs += new Date(r.completed_at).getTime() - new Date(r.created_at).getTime();
          leadTimeN++;
        }
      }
    }

    return {
      total,
      por_status: byStatus,
      por_tipo: byTipo,
      por_perfil: byPerfil,
      taxa_conclusao: total > 0 ? +(concluidas / total).toFixed(3) : 0,
      taxa_sucesso: concluidas > 0 ? +(sucessos / concluidas).toFixed(3) : 0,
      lead_time_horas_medio: leadTimeN > 0 ? +(leadTimeMs / leadTimeN / 3600000).toFixed(1) : null,
    };
  });
}
