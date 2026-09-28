/**
 * Ações de retenção — registro/timeline de toques com cliente (D2).
 *
 * Casos de uso:
 *   - Vendedor liga pra cliente em risco e registra a ligação
 *   - Gestor dispara campanha em lote pra todos os "Esquecidos" da loja
 *   - Painel de produtividade do consultor
 *   - Histórico que alimenta o re-treino do modelo (ação X → desfecho Y)
 *
 * Autorização:
 *   - Campanha em lote → gestor ou admin.
 *   - Demais rotas → qualquer usuário autenticado, limitado ao escopo de
 *     concessionária (lib/data-access.ts): leitura via readScopeOf,
 *     alteração/envio via writeScopeOf.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { authorize, requireUser } from '../plugins/auth.js';
import { adminClient } from '../lib/supabase.js';
import { assertCanModify, canAccessDealership, dbFor, readScopeOf, requireDealership } from '../lib/data-access.js';
import { forbidden, notFound, unprocessable } from '../lib/api-error.js';
import { logAudit } from '../lib/audit.js';
import { sendEmail, templateFor } from '../lib/email.js';

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
    const dealershipId = requireDealership(u); // 403 no_dealership
    const body = req.body as z.infer<typeof CreateAcaoBody>;
    const sb = dbFor(u);

    // Confirma que o client pertence à mesma dealership (defense in depth além da RLS)
    const { data: client, error: findErr } = await sb.from('clients')
      .select('id, dealership_id').eq('id', body.client_id).maybeSingle();
    if (findErr) throw findErr;
    if (!client || !canAccessDealership(readScopeOf(u), client.dealership_id)) {
      throw notFound('cliente não encontrado', 'client_not_found');
    }
    if (client.dealership_id !== dealershipId) {
      throw forbidden('ações só podem ser registradas para clientes da própria concessionária');
    }

    const { data, error } = await adminClient().from('acoes_retencao').insert({
      ...body,
      dealership_id: dealershipId,
      actor_id: u.id,
      completed_at: body.status?.startsWith('concluida_') ? new Date().toISOString() : null,
    }).select().single();
    if (error) throw error; // falha de banco → 500 (detalhe só no log)

    await logAudit({
      actor_id: u.id, action: 'acao.created', entity: 'acoes_retencao',
      entity_id: data.id, metadata: { tipo: body.tipo, client_id: body.client_id },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);
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
    const scope = readScopeOf(u);
    const q = req.query as any;
    const sb = dbFor(u);

    let query = sb.from('acoes_retencao')
      .select('*, clients!inner(id, modelo_comprado, versao_comprada, nome_cliente)',
              { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(q.offset, q.offset + q.limit - 1);

    if (scope.kind === 'dealership') query = query.eq('dealership_id', scope.dealershipId);
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
  }, async (req) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const body = req.body as z.infer<typeof UpdateAcaoBody>;
    const sb = dbFor(u);

    const { data: current, error: findErr } = await sb.from('acoes_retencao')
      .select('id, dealership_id').eq('id', id).maybeSingle();
    if (findErr) throw findErr;
    assertCanModify(u, current?.dealership_id, 'ação não encontrada'); // 404 ou 403
    if (!current) throw notFound('ação não encontrada');

    const updates: any = { ...body };
    if (body.status?.startsWith('concluida_')) {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await sb.from('acoes_retencao')
      .update(updates).eq('id', id).select().single();
    if (error) throw error;

    await logAudit({
      actor_id: u.id, action: 'acao.updated', entity: 'acoes_retencao',
      entity_id: id, metadata: { status: body.status },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);
    return data;
  });

  // ===== CAMPANHA em lote (cria N ações pra todos do perfil) =====
  app.post('/acoes/campanha', {
    onRequest: [authorize('gestor', 'admin')],
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Dispara campanha em lote — cria 1 ação planejada para cada cliente do perfil',
      body: CampaignBody,
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const dealershipId = requireDealership(u); // 403 no_dealership
    const b = req.body as z.infer<typeof CampaignBody>;
    const sb = dbFor(u);

    // Busca clientes alvo
    let q = sb.from('clients')
      .select('id, predictions(perfil_predito, risco_evasao)')
      .eq('dealership_id', dealershipId)
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
      dealership_id: dealershipId,
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
    if (error) throw error; // falha de banco → 500 (detalhe só no log)

    await logAudit({
      actor_id: u.id, action: 'campaign.created', entity: 'acoes_retencao',
      entity_id: campaign_id,
      metadata: { perfil: b.perfil, tipo: b.tipo, count: data?.length ?? 0 },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);
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
    const scope = readScopeOf(u);
    let query = dbFor(u).from('acoes_retencao').select('status, tipo, perfil_alvo, created_at, completed_at');
    if (scope.kind === 'dealership') query = query.eq('dealership_id', scope.dealershipId);
    const { data } = await query;
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

  // ====================================================================
  // POST /acoes/email-send
  // ====================================================================
  // Envia e-mail REAL pro cliente (provider Resend) e registra a ação +
  // log de envio. Se Resend não estiver configurado, cai pra modo mock
  // (registra no log mas não envia — útil pra demo).
  // ====================================================================
  app.post('/acoes/email-send', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Envia e-mail real pro cliente e registra como ação',
      body: z.object({
        client_id: z.string().uuid(),
        subject: z.string().min(2).max(200).regex(/^[^\r\n]+$/).optional(),
      }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { client_id, subject } = req.body as any;
    const sb = adminClient();

    // 1. Busca cliente
    const { data: client, error: cErr } = await sb.from('clients')
      .select('id, nome_cliente, email_cliente, model_name, modelo_comprado, dealer_code_venda, perfil_real, dealership_id')
      .eq('id', client_id).maybeSingle();
    if (cErr) throw cErr;
    assertCanModify(u, client?.dealership_id, 'cliente não encontrado'); // 404 ou 403
    if (!client) throw notFound('cliente não encontrado', 'client_not_found');

    const to = client.email_cliente;
    if (!to) {
      // Requisição válida, mas o cadastro do cliente impede o envio → 422.
      throw unprocessable(
        'Cliente sem e-mail cadastrado. Edite a ficha e adicione um e-mail antes de enviar.',
        'no_email',
      );
    }

    // 2. Monta subject + body — template do perfil ou customizado
    const modelo = client.model_name ?? client.modelo_comprado ?? 'seu Ford';
    const nome = client.nome_cliente ?? 'Cliente Ford';
    const dealer = client.dealer_code_venda ? String(client.dealer_code_venda) : '';
    const tpl = templateFor(client.perfil_real, modelo, nome, dealer);
    const finalSubject = (subject ?? tpl.subject).replace(/[\r\n]+/g, ' ').slice(0, 200);
    const finalHtml = tpl.html;

    // 3. Cria a ação primeiro (vincular o email_log)
    const { data: acao, error: aErr } = await sb.from('acoes_retencao').insert({
      id: randomUUID(),
      client_id,
      dealership_id: client.dealership_id,
      tipo: 'email',
      titulo: finalSubject,
      descricao: 'E-mail de retenção enviado',
      perfil_alvo: client.perfil_real,
      status: 'em_andamento',  // vai pra concluida_sucesso quando o envio confirmar
      actor_id: u.id,          // coluna correta no schema (não é created_by)
      created_at: new Date().toISOString(),
    }).select().single();
    if (aErr || !acao) throw aErr ?? new Error('falha ao registrar a ação de e-mail');

    // 4. Envia o e-mail (Resend ou mock)
    const result = await sendEmail({
      to,
      subject: finalSubject!,
      html: finalHtml!,
      client_id,
      acao_id: acao.id,
      sent_by_user_id: u.id,
    });

    // 5. Atualiza status da ação conforme resultado do envio.
    // IMPORTANTE: quando provider='mock' (Resend não configurado), NÃO marcamos
    // como sucesso real — usamos status 'planejada' + desfecho explicito de
    // simulação, pra não enganar quem lê o histórico depois.
    const isMockOnly = result.status === 'sent' && result.provider === 'mock';
    const isReallySent = result.status === 'sent' && result.provider !== 'mock';

    const novoStatus = isReallySent ? 'concluida_sucesso'
      : isMockOnly ? 'planejada'           // ainda não enviou de verdade
      : 'concluida_recusa';

    const novoDesfecho = isReallySent
      ? `E-mail enviado via ${result.provider}. ID: ${result.provider_message_id ?? 'n/d'}`
      : isMockOnly
        ? `⚠️ SIMULAÇÃO — e-mail NÃO foi enviado (Resend não configurado em /configuracoes). Configure a chave pra envio real.`
        : `Falha ao enviar: ${result.error}`;

    await sb.from('acoes_retencao').update({
      status: novoStatus,
      completed_at: isReallySent ? new Date().toISOString() : null,
      desfecho: novoDesfecho,
    }).eq('id', acao.id);

    // 6. Audit
    await logAudit({
      actor_id: u.id, action: 'email.send', entity: 'acoes_retencao', entity_id: acao.id,
      metadata: { client_id, provider: result.provider, status: result.status },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);

    return {
      ok: result.ok,
      acao_id: acao.id,
      log_id: result.log_id,
      provider: result.provider,
      provider_message_id: result.provider_message_id,
      status: result.status,
      // Flag explícita: o e-mail SAIU DE VERDADE ou foi só registrado em modo simulação?
      really_sent: isReallySent,
      mock_simulation: isMockOnly,
      error: result.error,
      preview: { to, subject: finalSubject },
    };
  });

  // ====================================================================
  // GET /acoes/email-config
  // ====================================================================
  // Diz pro front se o provider de e-mail está configurado.
  // Usado pra mostrar o banner amarelo no modal antes do envio.
  // ====================================================================
  app.get('/acoes/email-config', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Status da configuração de e-mail (Resend)',
    },
  }, async (req) => {
    requireUser(req);
    const sb = adminClient();
    const { data: rows } = await sb.from('ai_keys')
      .select('provider').in('provider', ['resend', 'email_from']);
    const has = new Set((rows ?? []).map((r: any) => r.provider));
    return {
      resend_configured: has.has('resend'),
      from_configured: has.has('email_from'),
      mode: has.has('resend') ? 'real' : 'mock',
      message: has.has('resend')
        ? 'Provider Resend configurado — envios serão reais.'
        : '⚠️ Resend não configurado. Os envios ficam em modo simulação (registram a ação mas não mandam e-mail real). Configure em /configuracoes.',
    };
  });

  // ====================================================================
  // GET /acoes/email-templates
  // ====================================================================
  // Devolve preview do template renderizado pra um cliente — usado no modal
  // antes do envio pra o vendedor revisar.
  // ====================================================================
  app.get('/acoes/email-templates/:client_id', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Renderiza preview do template de e-mail para o cliente',
      params: z.object({ client_id: z.string().uuid() }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { client_id } = req.params as any;
    const sb = dbFor(u);
    const { data: client } = await sb.from('clients')
      .select('id, nome_cliente, email_cliente, model_name, modelo_comprado, dealer_code_venda, perfil_real, dealership_id')
      .eq('id', client_id).maybeSingle();
    if (!client || !canAccessDealership(readScopeOf(u), client.dealership_id)) {
      throw notFound('cliente não encontrado', 'client_not_found');
    }
    const modelo = client.model_name ?? client.modelo_comprado ?? 'seu Ford';
    const nome = client.nome_cliente ?? 'Cliente Ford';
    const dealer = client.dealer_code_venda ? String(client.dealer_code_venda) : '';
    const tpl = templateFor(client.perfil_real, modelo, nome, dealer);
    return {
      client_id,
      destinatario: client.email_cliente,
      perfil: client.perfil_real,
      subject: tpl.subject,
      body_html: tpl.html,
    };
  });
}
