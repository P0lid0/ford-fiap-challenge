import type { FastifyInstance } from 'fastify';
import { requireUser } from '../plugins/auth.js';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { adminClient, publicClient } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { predict } from '../modules/retention/ml-client.js';
import { classifyHybrid } from '../modules/retention/hybrid-classifier.js';

const ACOES_POR_PERFIL: Record<'fiel'|'abandono'|'esquecido'|'economico', string[]> = {
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

// Schema Ford BR — campos do dataset real vin_share_Desafio_02.xlsx
// Modelos Ford disponíveis (extraídos do dataset):
const FORD_MODELS = [
  'RANGER', 'KA', 'ECOSPORT', 'TERRITORY', 'BRONCO SPORT', 'MAVERICK',
  'TRANSIT', 'F-150', 'MUSTANG', 'EDGE', 'MUSTANG MACH-E', 'FOCUS', 'FUSION/MONDEO',
  'F-SERIES', 'FIESTA', 'CARGO',
] as const;

const CreateClientBody = z.object({
  // === Identificação Ford (todos opcionais — sistema gera VIN_Hash se omitido) ===
  vin_hash: z.string().min(8).max(128).optional(),
  model_name: z.enum(FORD_MODELS),
  model_year: z.number().int().min(2010).max(2030),
  dealer_code_venda: z.number().int().optional(),

  // === Datas da venda ===
  sales_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  warranty_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  registration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // === Identidade (opcional, hasheada se vier) ===
  nome_cliente: z.string().min(1).max(120).optional(),
  cpf: z.string().regex(/^\d{11}$/).optional(),
  notas: z.string().max(4000).optional(),

  // === Legado opcional (compat com cadastros sintéticos) ===
  idade: z.number().int().min(18).max(95).optional(),
  genero: z.enum(['M', 'F', 'outro']).optional(),
  regiao: z.enum(['sul', 'sudeste', 'centro_oeste', 'nordeste', 'norte']).optional(),
  renda_mensal_brl: z.number().int().min(0).optional(),
  estado_civil: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo']).optional(),
  score_credito: z.number().int().min(0).max(1000).optional(),
  versao_comprada: z.string().min(1).max(60).optional(),
  preco_pago_brl: z.number().int().min(0).optional(),
  financiamento: z.enum(['a_vista', 'financiado', 'leasing', 'consorcio']).optional(),
  parcelas: z.number().int().min(0).max(84).optional(),
  canal_aquisicao: z.enum(['concessionaria', 'online', 'frota', 'indicacao']).optional(),
  primeiro_carro: z.boolean().optional(),
  test_drive_realizado: z.boolean().optional(),
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
    const u = requireUser(req);
    if (!u.dealership_id) {
      reply.code(400);
      return { error: 'no_dealership', message: 'usuário não está vinculado a uma concessionária' };
    }

    const body = req.body as z.infer<typeof CreateClientBody>;
    const { cpf, vin_hash, ...rest } = body;
    const sb = adminClient(); // service_role pra criar mesmo sem RLS-friendly profile

    // Gera VIN_Hash determinístico se não veio
    const vinFinal = vin_hash
      || createHash('sha256').update(`${rest.model_name}-${rest.model_year}-${rest.sales_date}-${Date.now()}-${u.id}`).digest('hex').slice(0, 64);

    const insertRow: any = {
      dealership_id: u.dealership_id,
      created_by: u.id,
      vin_hash: vinFinal,
      model_name: rest.model_name,
      model_year: rest.model_year,
      dealer_code_venda: rest.dealer_code_venda ?? null,
      sales_date: rest.sales_date,
      delivery_date: rest.delivery_date ?? null,
      warranty_start_date: rest.warranty_start_date ?? null,
      registration_date: rest.registration_date ?? null,
      nome_cliente: rest.nome_cliente ?? null,
      cpf_hash: cpf ? hashCpf(cpf) : null,
      notas: rest.notas ?? null,
      is_ford_real: false,
      data_source: 'manual',
      data_compra: rest.sales_date,
      // legado opcional (mantém compat com clientes sintéticos antigos)
      modelo_comprado: rest.model_name, // sincroniza com nome novo
      versao_comprada: rest.versao_comprada ?? '—',
      idade: rest.idade ?? null,
      genero: rest.genero ?? null,
      regiao: rest.regiao ?? null,
      renda_mensal_brl: rest.renda_mensal_brl ?? null,
      estado_civil: rest.estado_civil ?? null,
      score_credito: rest.score_credito ?? null,
      preco_pago_brl: rest.preco_pago_brl ?? null,
      financiamento: rest.financiamento ?? null,
      parcelas: rest.parcelas ?? null,
      canal_aquisicao: rest.canal_aquisicao ?? null,
      primeiro_carro: rest.primeiro_carro ?? null,
      test_drive_realizado: rest.test_drive_realizado ?? null,
    };

    const { data: client, error } = await sb.from('clients').insert(insertRow).select().single();
    if (error) {
      req.log.error({ error }, '[create client] failed');
      reply.code(400);
      return { error: 'insert_failed', message: error.message };
    }

    // Dispara predição síncrona — só faz se tiver dados sintéticos completos
    const hasSyntheticFeatures = rest.idade != null && rest.genero != null && rest.regiao != null
      && rest.renda_mensal_brl != null && rest.estado_civil != null && rest.score_credito != null
      && rest.preco_pago_brl != null && rest.financiamento != null;
    let prediction: any = null;
    if (hasSyntheticFeatures) {
      prediction = await predict({
        idade: rest.idade!, genero: rest.genero!, regiao: rest.regiao!,
        renda_mensal_brl: rest.renda_mensal_brl!, estado_civil: rest.estado_civil!,
        score_credito: rest.score_credito!, modelo_comprado: rest.model_name,
        versao_comprada: rest.versao_comprada ?? '—',
        preco_pago_brl: rest.preco_pago_brl!,
        financiamento: rest.financiamento!, parcelas: rest.parcelas ?? 0,
        canal_aquisicao: rest.canal_aquisicao ?? 'concessionaria',
        primeiro_carro: rest.primeiro_carro ?? false,
        test_drive_realizado: rest.test_drive_realizado ?? false,
        dealership_id: u.dealership_id,
      });
    }

    // predictions é insert-only pelo service_role (RLS bloqueia user).
    let predRow: any = null;
    if (prediction) {
      const r = await adminClient().from('predictions').insert({
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
        source: 'ml_only',
      }).select().single();
      if (r.error) req.log.error({ err: r.error }, 'failed to insert prediction');
      else predRow = r.data;
    }

    await logAudit({
      actor_id: u.id, action: 'client.created', entity: 'clients',
      entity_id: client.id,
      metadata: { perfil: prediction?.perfil_predito, vin: vinFinal.slice(0, 8) + '...' },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    });

    reply.code(201);
    return { client, prediction: predRow };
  });

  // Lista clientes da carteira (filtros + paginação) — adaptada pra schema Ford real
  app.get('/clients', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Lista clientes (Ford BR real ou cadastros manuais) com filtros',
      querystring: z.object({
        perfil: z.enum(['fiel', 'abandono', 'esquecido', 'economico']).optional(),
        perfil_real: z.enum(['fiel', 'abandono', 'esquecido', 'economico']).optional(),
        model_name: z.string().optional(),
        is_ford_real: z.coerce.boolean().optional(),
        risco_min: z.coerce.number().min(0).max(1).optional(),
        search: z.string().optional(), // busca por vin_hash prefix ou nome
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { perfil, perfil_real, model_name, is_ford_real, risco_min, search, limit, offset } = req.query as any;
    const sb = adminClient();

    let q = sb
      .from('clients')
      .select('id, vin_hash, model_name, model_year, dealer_code_venda, sales_date, ' +
              'num_revisoes, dias_desde_ultima_revisao, dealer_loyalty, perfil_real, ' +
              'is_ford_real, nome_cliente, modelo_comprado, versao_comprada, preco_pago_brl, ' +
              'financiamento, parcelas, created_at, ' +
              'predictions(perfil_predito, risco_evasao, confianca, created_at, source)',
              { count: 'exact' });

    if (typeof is_ford_real === 'boolean') q = q.eq('is_ford_real', is_ford_real);
    if (perfil_real) q = q.eq('perfil_real', perfil_real);
    if (model_name) q = q.eq('model_name', model_name);
    if (search) {
      // OR sobre vin_hash ou nome_cliente
      q = q.or(`vin_hash.ilike.${search}%,nome_cliente.ilike.%${search}%`);
    }

    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
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
    const u = requireUser(req);
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

  // ====================================================================
  // GET /clients/leads — leads priorizados pra retenção (Desafio 2)
  // ====================================================================
  // Combina TODOS os sinais disponíveis pra gerar um risco composto:
  //   - perfil_real (do ETL — 4 buckets) define o risco base
  //   - + bonificações: revisão atrasada, garantia vencida/vencendo,
  //     dealer loyalty baixa, veículo veterano, sem revisão alguma
  //
  // Retorna também o array `sinais` pra UI explicar POR QUE cada cliente
  // está naquela posição (transparência).
  //
  // Filtros suportados: perfil, modelo, dealer_code, sinal específico.
  // ====================================================================
  app.get('/clients/leads', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Leads priorizados (risco composto + sinais explicáveis)',
      querystring: z.object({
        risco_min: z.coerce.number().min(0).max(1).default(0.4),
        perfil: z.enum(['fiel', 'abandono', 'esquecido', 'economico']).optional(),
        modelo: z.string().optional(),
        dealer_code: z.coerce.number().int().optional(),
        sinal: z.enum([
          'revisao_atrasada',
          'garantia_vencida',
          'garantia_vencendo',
          'dealer_loyalty_baixa',
          'veiculo_veterano',
          'sem_revisao_alguma',
        ]).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      }),
    },
  }, async (req) => {
    requireUser(req);
    const { risco_min, perfil, modelo, dealer_code, sinal, limit } = req.query as any;
    const sb = adminClient();

    // RPC roda agregação dentro do Postgres (Postgrest tem limite de 1000 linhas)
    const { data, error } = await sb.rpc('leads_ranqueados', {
      risco_min,
      filtro_perfil: perfil ?? null,
      filtro_modelo: modelo ?? null,
      filtro_dealer: dealer_code ?? null,
      filtro_sinal: sinal ?? null,
      limite: limit,
    });
    if (error) throw error;

    // Mapeia pro formato que a UI espera
    return (data ?? []).map((r: any) => ({
      id: r.id,
      nome_cliente: r.nome_cliente,
      vin_hash: r.vin_hash,
      model_name: r.model_name,
      model_year: r.model_year,
      dealer_code_venda: r.dealer_code_venda,
      perfil_real: r.perfil_real,
      dias_desde_ultima_revisao: r.dias_desde_ultima_revisao,
      warranty_start_date: r.warranty_start_date,
      dealer_loyalty: r.dealer_loyalty != null ? Number(r.dealer_loyalty) : null,
      num_revisoes: r.num_revisoes,
      risco_composto: Number(r.risco_composto),
      sinais: r.sinais ?? [],
    }));
  });

  // GET /clients/leads/stats — KPIs agregados pros KPI cards da página /leads
  app.get('/clients/leads/stats', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Estatísticas agregadas de leads (volume por urgência + sinais mais comuns)',
    },
  }, async (req) => {
    requireUser(req);
    const sb = adminClient();
    const { data, error } = await sb.rpc('leads_ranqueados', {
      risco_min: 0.4, filtro_perfil: null, filtro_modelo: null,
      filtro_dealer: null, filtro_sinal: null, limite: 1_000_000,
    });
    if (error) throw error;
    const linhas = data ?? [];
    const alto = linhas.filter((r: any) => r.risco_composto >= 0.7).length;
    const medio = linhas.filter((r: any) => r.risco_composto >= 0.5 && r.risco_composto < 0.7).length;
    const baixo = linhas.filter((r: any) => r.risco_composto >= 0.4 && r.risco_composto < 0.5).length;
    // Contagem por sinal
    const porSinal: Record<string, number> = {};
    for (const r of linhas as any[]) {
      for (const s of (r.sinais ?? [])) porSinal[s] = (porSinal[s] ?? 0) + 1;
    }
    // Por perfil
    const porPerfil: Record<string, number> = {};
    for (const r of linhas as any[]) {
      const p = r.perfil_real ?? 'desconhecido';
      porPerfil[p] = (porPerfil[p] ?? 0) + 1;
    }
    return {
      total: linhas.length,
      breakdown_urgencia: { alto, medio, baixo },
      por_sinal: porSinal,
      por_perfil: porPerfil,
    };
  });

  // ============================================================
  // Notas livres do vendedor (entram no pipeline da IA)
  // ============================================================
  app.patch('/clients/:id/notas', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Atualiza notas livres do vendedor (entrada qualitativa pra IA)',
      params: z.object({ id: z.string().uuid() }),
      body: z.object({ notas: z.string().max(4000) }),
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const { notas } = req.body as any;
    const sb = adminClient();
    const { data, error } = await sb.from('clients')
      .update({ notas })
      .eq('id', id)
      .select('id, notas')
      .single();
    if (error || !data) {
      reply.code(404);
      return { error: 'not_found_or_failed', message: error?.message };
    }
    await logAudit({
      actor_id: u.id, action: 'client.notas_updated', entity: 'clients',
      entity_id: id, metadata: { len: notas.length },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    });
    return data;
  });

  // ============================================================
  // Reclassificação HÍBRIDA (ML + IA) com contexto qualitativo
  // ============================================================
  app.post('/clients/:id/reclassify', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Reclassifica cliente combinando ML (XGBoost) + IA (LLM com contexto qualitativo)',
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        force_ai: z.boolean().optional().default(true),
        ai_model: z.string().optional(),
      }).optional(),
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const body = (req.body ?? {}) as any;
    const sb = adminClient();

    // Carrega cliente + notas + histórico recente de ações
    const { data: client, error } = await sb.from('clients').select('*').eq('id', id).single();
    if (error || !client) { reply.code(404); return { error: 'not_found' }; }
    if (client.dealership_id !== u.dealership_id && u.role !== 'admin') {
      reply.code(403); return { error: 'forbidden' };
    }

    const { data: acoes } = await sb.from('acoes_retencao')
      .select('tipo, titulo, descricao, status, desfecho, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    const hybrid = await classifyHybrid({
      features: {
        idade: client.idade, genero: client.genero, regiao: client.regiao,
        renda_mensal_brl: client.renda_mensal_brl, estado_civil: client.estado_civil,
        score_credito: client.score_credito, modelo_comprado: client.modelo_comprado,
        versao_comprada: client.versao_comprada, preco_pago_brl: client.preco_pago_brl,
        financiamento: client.financiamento, parcelas: client.parcelas,
        canal_aquisicao: client.canal_aquisicao,
        primeiro_carro: client.primeiro_carro,
        test_drive_realizado: client.test_drive_realizado,
      },
      dealership_id: client.dealership_id,
      notas: client.notas,
      acoes: acoes ?? [],
      forceAI: body.force_ai !== false,
      aiModel: body.ai_model,
      acoesPorPerfil: ACOES_POR_PERFIL,
    });

    // Salva como nova predição
    const { data: predRow, error: predErr } = await sb.from('predictions').insert({
      client_id: id,
      model_version: hybrid.ai ? `hybrid:${hybrid.ml.model_version}+${hybrid.ai.model_label}` : hybrid.ml.model_version,
      perfil_predito: hybrid.perfil,
      prob_fiel: hybrid.probabilidades.fiel,
      prob_abandono: hybrid.probabilidades.abandono,
      prob_esquecido: hybrid.probabilidades.esquecido,
      prob_economico: hybrid.probabilidades.economico,
      risco_evasao: hybrid.risco_evasao,
      confianca: hybrid.confianca,
      recomendacoes_acao: hybrid.recomendacoes_acao,
      source: hybrid.source,
      raciocinio: hybrid.raciocinio,
      signals_detected: hybrid.signals_detected,
      ml_perfil: hybrid.ml.perfil,
      ai_perfil: hybrid.ai?.perfil ?? null,
      concordancia: hybrid.concordancia,
      ai_model: hybrid.ai?.model_label ?? null,
    }).select().single();
    if (predErr) {
      req.log.error({ predErr }, '[reclassify] insert failed');
    }

    await logAudit({
      actor_id: u.id, action: 'client.reclassified', entity: 'clients',
      entity_id: id,
      metadata: {
        source: hybrid.source,
        concordancia: hybrid.concordancia,
        ml_perfil: hybrid.ml.perfil,
        ai_perfil: hybrid.ai?.perfil,
        final: hybrid.perfil,
      },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    });

    return { hybrid, prediction: predRow };
  });
}
