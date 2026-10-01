import type { FastifyInstance } from 'fastify';
import { authorize, requireUser } from '../plugins/auth.js';
import { z } from 'zod';
import { createHash, createHmac } from 'node:crypto';
import { sql, pgErrorCode, PG_UNIQUE_VIOLATION } from '../lib/db.js';
import { assertCanModify, canAccessDealership, readScopeOf, requireDealership, scopeFilter } from '../lib/data-access.js';
import { conflict, notFound } from '../lib/api-error.js';
import { logAudit } from '../lib/audit.js';
import { env } from '../config.js';
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
  return createHmac('sha256', env.CLIENT_CPF_PEPPER).update(cpf).digest('hex');
}

/**
 * Autorização: todas as rotas exigem usuário autenticado (plugin de auth).
 * Escopo de concessionária (lib/data-access.ts), aplicado EXPLICITAMENTE nas queries
 * (não há RLS: a API usa um único papel no PostgreSQL):
 *   - leitura (lista/detalhe) → readScopeOf + scopeFilter: analista só a própria loja; gestor/admin a rede
 *   - alteração (notas/reclassificar) → assertCanModify (writeScopeOf): admin a rede; demais só a própria loja
 */
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
    const dealershipId = requireDealership(u); // 403 no_dealership: todo cliente pertence a uma loja

    const body = req.body as z.infer<typeof CreateClientBody>;
    const { cpf, vin_hash, ...rest } = body;

    // Gera VIN_Hash determinístico se não veio
    const vinFinal = vin_hash
      || createHash('sha256').update(`${rest.model_name}-${rest.model_year}-${rest.sales_date}-${Date.now()}-${u.id}`).digest('hex').slice(0, 64);

    const insertRow: any = {
      dealership_id: dealershipId,
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
      primeiro_carro: rest.primeiro_carro,
      test_drive_realizado: rest.test_drive_realizado,
    };
    // As colunas são NOT NULL default false: omitidas, valem o default do banco
    // (um null explícito violaria a constraint).
    if (insertRow.primeiro_carro === undefined) delete insertRow.primeiro_carro;
    if (insertRow.test_drive_realizado === undefined) delete insertRow.test_drive_realizado;

    let client: any;
    try {
      [client] = await sql`insert into public.clients ${sql(insertRow)} returning *`;
    } catch (error) {
      // 23505 = unique_violation no Postgres (vin_hash é único).
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) throw conflict('já existe um cliente com este VIN', 'vin_already_exists');
      throw error; // demais falhas de banco → 500 (detalhe só no log)
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
        dealership_id: dealershipId,
      });
    }

    // Falha ao gravar a predição não derruba o cadastro (só loga).
    let predRow: any = null;
    if (prediction) {
      try {
        [predRow] = await sql`insert into public.predictions ${sql({
          client_id: client.id,
          model_version: prediction.model_version,
          perfil_predito: prediction.perfil_predito,
          prob_fiel: prediction.probabilidades.fiel,
          prob_abandono: prediction.probabilidades.abandono,
          prob_esquecido: prediction.probabilidades.esquecido,
          prob_economico: prediction.probabilidades.economico,
          risco_evasao: prediction.risco_evasao,
          confianca: prediction.confianca,
          recomendacoes_acao: prediction.recomendacoes_acao ?? [],
          source: 'ml_only',
        })} returning *`;
      } catch (err) {
        req.log.error({ err }, 'failed to insert prediction');
        predRow = null;
      }
    }

    await logAudit({
      actor_id: u.id, action: 'client.created', entity: 'clients',
      entity_id: client.id,
      metadata: { perfil: prediction?.perfil_predito, vin: vinFinal.slice(0, 8) + '...' },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);

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
    const scope = readScopeOf(u);
    const { perfil, perfil_real, model_name, is_ford_real, risco_min, search, limit, offset } = req.query as any;
    // Escopo explícito (antes vinha do RLS via dbFor): analista só a própria loja;
    // gestor/admin a rede. O mesmo `where` serve à query de contagem.
    const where = sql`
      where true
      ${scopeFilter(scope, 'c.dealership_id')}
      ${typeof is_ford_real === 'boolean' ? sql`and c.is_ford_real = ${is_ford_real}` : sql``}
      ${perfil_real ? sql`and c.perfil_real = ${perfil_real}` : sql``}
      ${model_name ? sql`and c.model_name = ${model_name}` : sql``}
      ${search
        // OR sobre vin_hash (prefixo) ou nome_cliente (qualquer posição)
        ? sql`and (c.vin_hash ilike ${search + '%'} or c.nome_cliente ilike ${'%' + search + '%'})`
        : sql``}
    `;

    // Embed 1:N `predictions(...)` do PostgREST → array via json_agg (mais recente
    // primeiro). `count: 'exact'` → contagem separada, sem a paginação.
    const [data, countRows] = await Promise.all([
      sql<any[]>`
        select c.id, c.vin_hash, c.model_name, c.model_year, c.dealer_code_venda, c.sales_date,
               c.num_revisoes, c.dias_desde_ultima_revisao, c.dealer_loyalty, c.perfil_real,
               c.is_ford_real, c.nome_cliente, c.modelo_comprado, c.versao_comprada, c.preco_pago_brl,
               c.financiamento, c.parcelas, c.created_at,
               coalesce((
                 select json_agg(json_build_object(
                   'perfil_predito', p.perfil_predito,
                   'risco_evasao', p.risco_evasao,
                   'confianca', p.confianca,
                   -- UTC fixo, no formato que o PostgREST entregava (independe do fuso da sessão)
                   'created_at', to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"'),
                   'source', p.source
                 ) order by p.created_at desc)
                 from public.predictions p
                 where p.client_id = c.id
               ), '[]'::json) as predictions
        from public.clients c
        ${where}
        order by c.created_at desc
        limit ${limit} offset ${offset}
      `,
      sql<{ count: number }[]>`select count(*)::int as count from public.clients c ${where}`,
    ]);
    const count = countRows[0]?.count ?? 0;

    let filtered: any[] = data ?? [];
    if (perfil) {
      filtered = filtered.filter((c: any) =>
        c.predictions?.some((p: any) => p.perfil_predito === perfil));
    }
    if (typeof risco_min === 'number') {
      filtered = filtered.filter((c: any) =>
        c.predictions?.some((p: any) => p.risco_evasao >= risco_min));
    }
    return { total: count, results: filtered };
  });

  // Detalhe + histórico de predições
  app.get('/clients/:id', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Detalhe do cliente (Base 2 + todas as predições)',
      params: z.object({ id: z.string().uuid() }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const scope = readScopeOf(u);
    // Cliente de outra concessionária → 404 (não revela que o registro existe).
    // O escopo entra na query (antes, o RLS) e é conferido de novo no código.
    const [client] = await sql<any[]>`
      select * from public.clients
      where id = ${id} ${scopeFilter(scope)}
    `;
    if (!client || !canAccessDealership(scope, client.dealership_id)) {
      throw notFound('cliente não encontrado');
    }

    // Escopo já garantido pelo cliente acima (predictions/history seguem o client).
    const predictions = await sql`
      select * from public.predictions
      where client_id = ${id}
      order by created_at desc
    `;
    const history = await sql`
      select * from public.client_history
      where client_id = ${id}
      order by observado_em desc
    `;

    return { client, predictions, history };
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
    onRequest: [authorize('gestor', 'admin')],
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
    const u = requireUser(req);
    const { risco_min, perfil, modelo, dealer_code, sinal, limit } = req.query as any;

    // Agregação dentro do Postgres. A rota é só gestor/admin (leitura = rede inteira),
    // então não há filtro de concessionária. Parâmetros nomeados com cast explícito:
    // o driver manda os valores sem tipo e o cast resolve a assinatura da função.
    const data = await sql<any[]>`
      select * from public.leads_ranqueados(
        risco_min     => ${risco_min}::numeric,
        filtro_perfil => ${perfil ?? null}::text,
        filtro_modelo => ${modelo ?? null}::text,
        filtro_dealer => ${dealer_code ?? null}::integer,
        filtro_sinal  => ${sinal ?? null}::text,
        limite        => ${limit}::integer
      )
    `;

    // Mapeia pro formato que a UI espera
    return data.map((r: any) => ({
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
    onRequest: [authorize('gestor', 'admin')],
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Estatísticas agregadas de leads (volume por urgência + sinais mais comuns)',
    },
  }, async (req) => {
    requireUser(req);
    const [stats] = await sql<any[]>`select * from public.leads_ranqueados_stats()`;
    return {
      total: Number(stats?.total ?? 0),
      breakdown_urgencia: {
        alto: Number(stats?.alto ?? 0),
        medio: Number(stats?.medio ?? 0),
        baixo: Number(stats?.baixo ?? 0),
      },
      por_sinal: stats?.por_sinal ?? {},
      por_perfil: stats?.por_perfil ?? {},
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
  }, async (req) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const { notas } = req.body as any;

    const [current] = await sql<{ id: string; dealership_id: string | null }[]>`
      select id, dealership_id from public.clients where id = ${id}
    `;
    assertCanModify(u, current?.dealership_id, 'cliente não encontrado'); // 404 ou 403
    if (!current) throw notFound('cliente não encontrado');

    const [data] = await sql<{ id: string; notas: string | null }[]>`
      update public.clients set notas = ${notas}
      where id = ${id}
      returning id, notas
    `;
    // O .single() original tratava 0 linhas como erro (PGRST116 → 500): registro
    // removido entre a leitura e a gravação.
    if (!data) throw new Error('cliente removido durante a atualização das notas');
    await logAudit({
      actor_id: u.id, action: 'client.notas_updated', entity: 'clients',
      entity_id: id, metadata: { len: notas.length },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);
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
  }, async (req) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const body = (req.body ?? {}) as any;

    // Carrega cliente + notas + histórico recente de ações
    const [client] = await sql<any[]>`select * from public.clients where id = ${id}`;
    assertCanModify(u, client?.dealership_id, 'cliente não encontrado'); // 404 ou 403
    if (!client) throw notFound('cliente não encontrado');

    const acoes = await sql<any[]>`
      select tipo, titulo, descricao, status, desfecho, created_at
      from public.acoes_retencao
      where client_id = ${id}
      order by created_at desc
      limit 20
    `;

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
      acoes,
      forceAI: body.force_ai !== false,
      aiModel: body.ai_model,
      acoesPorPerfil: ACOES_POR_PERFIL,
    });

    // Salva como nova predição (falha só loga, a resposta segue com prediction null)
    let predRow: any = null;
    try {
      [predRow] = await sql`insert into public.predictions ${sql({
      client_id: id,
      model_version: hybrid.ai ? `hybrid:${hybrid.ml.model_version}+${hybrid.ai.model_label}` : hybrid.ml.model_version,
      perfil_predito: hybrid.perfil,
      prob_fiel: hybrid.probabilidades.fiel,
      prob_abandono: hybrid.probabilidades.abandono,
      prob_esquecido: hybrid.probabilidades.esquecido,
      prob_economico: hybrid.probabilidades.economico,
      risco_evasao: hybrid.risco_evasao,
      confianca: hybrid.confianca,
      recomendacoes_acao: hybrid.recomendacoes_acao ?? [],
      source: hybrid.source,
      raciocinio: hybrid.raciocinio ?? null,
      signals_detected: hybrid.signals_detected ?? [],
      ml_perfil: hybrid.ml.perfil,
      ai_perfil: hybrid.ai?.perfil ?? null,
      concordancia: hybrid.concordancia ?? null,
      ai_model: hybrid.ai?.model_label ?? null,
      })} returning *`;
    } catch (predErr) {
      req.log.error({ predErr }, '[reclassify] insert failed');
      predRow = null;
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
    }, req.log);

    return { hybrid, prediction: predRow };
  });
}
