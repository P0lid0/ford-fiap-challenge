import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../plugins/auth.js';
import { sql } from '../lib/db.js';
import { canReadAll, dealershipFilter } from '../lib/scope.js';

/**
 * KPIs da concessionária / rede pro Desafio 2 (Retenção VIN Share).
 *
 * Endpoints:
 *   GET /metrics/dealership            — KPIs gerais + filtros (dealer, modelo, idade)
 *   GET /metrics/proximas-revisoes     — lista veículos com próxima revisão estimada
 *   GET /metrics/garantia-status       — agrupado por status: vencida / vence em <90d / >90d
 *   GET /metrics/anomalias-dealer      — dealers cuja taxa de retenção foge da média (z-score)
 *
 * Heurística de "próxima revisão" (Ford manual padrão BR):
 *   - 10.000 km OU 12 meses, o que vier primeiro
 *   - Estimamos rodagem mensal = km_max / meses_desde_compra
 *   - Próxima revisão = ultimo_servico + max(12 meses, 10000 / rodagem_mensal meses)
 *   - Veículos abaixo de 7.000 km contam só pelo critério temporal
 */
const IDADE_BUCKETS = {
  novo: [0, 2],       // 0-2 anos
  intermediario: [2, 5], // 2-5 anos
  veterano: [5, 99],  // 5+ anos
} as const;

export async function metricRoutes(app: FastifyInstance) {
  app.get('/metrics/dealership', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'KPIs da concessionária (ou rede, se admin) com filtros opcionais',
      querystring: z.object({
        dealer_code: z.coerce.number().int().optional(),
        model_name: z.string().optional(),
        // bucket de idade do veículo: 'novo' (0-2a), 'intermediario' (2-5a), 'veterano' (5+a)
        idade_bucket: z.enum(['novo', 'intermediario', 'veterano']).optional(),
      }),
    },
  }, async (req) => {
    const u = requireUser(req);
    // Escopo em código (esta rota nunca dependeu do RLS): admin/gestor veem a
    // rede; analista só a própria dealership. Analista sem dealership continua
    // vendo a rede, como antes — comportamento preservado.
    const dealershipFilter = canReadAll(u) ? null : u.dealership_id;
    const { dealer_code, model_name, idade_bucket } = req.query as any;

    // Filtros opcionais (granularidade pedida no slide D2) como fragmentos SQL
    const anoAtual = new Date().getFullYear();
    const idadeRange = (bucket: keyof typeof IDADE_BUCKETS) => {
      const [minA, maxA] = IDADE_BUCKETS[bucket];
      return sql`model_year >= ${anoAtual - maxA} and model_year <= ${anoAtual - minA}`;
    };
    const filters = sql`
      ${dealershipFilter ? sql`and dealership_id = ${dealershipFilter}` : sql``}
      ${dealer_code ? sql`and dealer_code_venda = ${dealer_code}` : sql``}
      ${model_name ? sql`and model_name = ${model_name}` : sql``}
      ${idade_bucket ? sql`and ${idadeRange(idade_bucket as keyof typeof IDADE_BUCKETS)}` : sql``}
    `;

    // === KPIs ===
    // Uma única passada com count(*) filter — antes eram ~20 HEAD counts no PostgREST.
    const [kpi] = await sql<{
      total: number; ativos: number; aderentes: number;
      fiel: number; abandono: number; esquecido: number; economico: number;
      idade_novo: number; idade_intermediario: number; idade_veterano: number;
    }[]>`
      select
        count(*)::int as total,
        count(*) filter (where dias_desde_ultima_revisao <= 365)::int as ativos,
        count(*) filter (where num_revisoes >= 2)::int as aderentes,
        count(*) filter (where perfil_real = 'fiel')::int as fiel,
        count(*) filter (where perfil_real = 'abandono')::int as abandono,
        count(*) filter (where perfil_real = 'esquecido')::int as esquecido,
        count(*) filter (where perfil_real = 'economico')::int as economico,
        count(*) filter (where ${idadeRange('novo')})::int as idade_novo,
        count(*) filter (where ${idadeRange('intermediario')})::int as idade_intermediario,
        count(*) filter (where ${idadeRange('veterano')})::int as idade_veterano
      from public.clients
      where true ${filters}
    `;

    const totalClients = kpi?.total ?? 0;
    const ativosCount = kpi?.ativos ?? 0;

    // Por perfil_real
    const perfilCounts: Record<string, number> = {
      fiel: kpi?.fiel ?? 0,
      abandono: kpi?.abandono ?? 0,
      esquecido: kpi?.esquecido ?? 0,
      economico: kpi?.economico ?? 0,
    };

    // Alto risco: abandono + 40% dos esquecidos (heurística)
    const altoRisco = (perfilCounts.abandono ?? 0)
      + Math.round((perfilCounts.esquecido ?? 0) * 0.4);

    // Por modelo (só modelos com count > 0, como antes)
    const FORD_MODELS = ['RANGER', 'KA', 'ECOSPORT', 'TERRITORY', 'BRONCO SPORT',
      'MAVERICK', 'TRANSIT', 'F-150', 'MUSTANG', 'EDGE', 'MUSTANG MACH-E'];
    const modeloRows = await sql<{ model_name: string; count: number }[]>`
      select model_name, count(*)::int as count
      from public.clients
      where model_name in ${sql(FORD_MODELS)} ${filters}
      group by model_name
    `;
    const porModelo: Record<string, number> = {};
    for (const modelo of FORD_MODELS) {
      const row = modeloRows.find((r) => r.model_name === modelo);
      if (row && row.count > 0) porModelo[modelo] = row.count;
    }

    // Por bucket de idade do veículo
    const porIdade: Record<string, number> = {
      novo: kpi?.idade_novo ?? 0,
      intermediario: kpi?.idade_intermediario ?? 0,
      veterano: kpi?.idade_veterano ?? 0,
    };

    // Taxa de aderência: num_revisoes >= 2
    const aderentes = kpi?.aderentes ?? 0;
    const taxaAderenciaRevisoes = totalClients > 0 ? aderentes / totalClients : 0;

    const vinShareEstimado = totalClients > 0 ? ativosCount / totalClients : 0;

    return {
      escopo: dealershipFilter ?? 'rede',
      filtros_aplicados: { dealer_code, model_name, idade_bucket },
      total_clientes: totalClients,
      clientes_ativos: ativosCount,
      vin_share_estimado: Number(vinShareEstimado.toFixed(3)),
      taxa_aderencia_revisoes: Number(taxaAderenciaRevisoes.toFixed(3)),
      alto_risco_count: altoRisco,
      perfil_counts: perfilCounts,
      por_modelo: porModelo,
      por_idade: porIdade,
    };
  });

  // ====================================================================
  // GET /metrics/proximas-revisoes
  // ====================================================================
  // Veículos cuja PRÓXIMA revisão estimada cai nos próximos N dias.
  // Heurística Ford manual padrão: 10.000 km OU 12 meses, o que vier primeiro.
  // Estimativa de próxima data:
  //   - Se temos ultimo_servico: ultimo_servico + 12 meses (ou km/rodagem se maior)
  //   - Senão usamos delivery_date + 12 meses (1ª revisão obrigatória)
  // ====================================================================
  app.get('/metrics/proximas-revisoes', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Veículos com próxima revisão estimada — fonte de leads proativos',
      querystring: z.object({
        dentro_de_dias: z.coerce.number().int().min(7).max(365).default(60),
        limit: z.coerce.number().int().min(1).max(200).default(50),
      }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { dentro_de_dias, limit } = req.query as any;

    // Pegamos um lote e filtramos em memória. admin/gestor leem a rede inteira;
    // analista só a própria dealership (a lista traz nome/vin_hash por cliente).
    const data = await sql`
      select id, nome_cliente, model_name, model_year, vin_hash, dealer_code_venda,
             sales_date, delivery_date, ultimo_servico, num_revisoes, km_max,
             dias_desde_ultima_revisao, perfil_real, warranty_start_date
      from public.clients
      where model_name is not null ${dealershipFilter(u)}
      limit 2000
    `;

    const hoje = new Date();
    const linhas = (data ?? []).map((c: any) => {
      // base = última visita conhecida (último serviço OU entrega se nunca foi)
      const base = c.ultimo_servico ? new Date(c.ultimo_servico)
        : c.delivery_date ? new Date(c.delivery_date)
        : c.sales_date ? new Date(c.sales_date)
        : null;
      if (!base) return null;
      // 12 meses depois
      const proxima = new Date(base);
      proxima.setMonth(proxima.getMonth() + 12);
      const diasAteProxima = Math.round((proxima.getTime() - hoje.getTime()) / 86_400_000);

      // sinaliza km (acima de 10k desde último serviço já indica próxima)
      const kmDesdeUltimoServico = c.km_max ? Math.min(c.km_max, 10000) : null;

      return {
        id: c.id,
        nome_cliente: c.nome_cliente,
        model_name: c.model_name,
        model_year: c.model_year,
        vin_hash: c.vin_hash,
        dealer_code_venda: c.dealer_code_venda,
        ultimo_servico: c.ultimo_servico,
        num_revisoes: c.num_revisoes,
        perfil_real: c.perfil_real,
        proxima_revisao_estimada: proxima.toISOString().slice(0, 10),
        dias_ate_proxima: diasAteProxima,
        urgencia: diasAteProxima <= 0 ? 'vencida'
          : diasAteProxima <= 30 ? 'imediata'
          : diasAteProxima <= 60 ? 'proxima'
          : 'distante',
        km_indicativo: kmDesdeUltimoServico,
      };
    }).filter((r: any): r is NonNullable<typeof r> => r !== null)
      // dentro da janela: próxima nos próximos N dias OU já vencida
      .filter((r: any) => r.dias_ate_proxima <= dentro_de_dias)
      .sort((a: any, b: any) => a.dias_ate_proxima - b.dias_ate_proxima)
      .slice(0, limit);

    return {
      janela_dias: dentro_de_dias,
      total: linhas.length,
      breakdown: {
        vencida: linhas.filter((r: any) => r.urgencia === 'vencida').length,
        imediata: linhas.filter((r: any) => r.urgencia === 'imediata').length,
        proxima: linhas.filter((r: any) => r.urgencia === 'proxima').length,
        distante: linhas.filter((r: any) => r.urgencia === 'distante').length,
      },
      results: linhas,
    };
  });

  // ====================================================================
  // GET /metrics/garantia-status
  // ====================================================================
  // Lista veículos por status de garantia. Garantia padrão Ford BR = 3 anos
  // a partir de warranty_start_date (config se quiser ajustar).
  // ====================================================================
  app.get('/metrics/garantia-status', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Status de garantia — oportunidade de lock-in na rede oficial',
      querystring: z.object({
        anos_garantia: z.coerce.number().int().min(1).max(10).default(3),
        limit: z.coerce.number().int().min(1).max(200).default(100),
      }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { anos_garantia, limit } = req.query as any;

    // admin/gestor leem a rede inteira; analista só a própria dealership.
    const data = await sql`
      select id, nome_cliente, model_name, model_year, vin_hash, dealer_code_venda,
             warranty_start_date, perfil_real, num_revisoes
      from public.clients
      where warranty_start_date is not null ${dealershipFilter(u)}
      limit 2000
    `;

    const hoje = new Date();
    const enriched = (data ?? []).map((c: any) => {
      const inicio = new Date(c.warranty_start_date);
      const fim = new Date(inicio);
      fim.setFullYear(fim.getFullYear() + anos_garantia);
      const diasAteVencer = Math.round((fim.getTime() - hoje.getTime()) / 86_400_000);
      return {
        id: c.id,
        nome_cliente: c.nome_cliente,
        model_name: c.model_name,
        model_year: c.model_year,
        vin_hash: c.vin_hash,
        dealer_code_venda: c.dealer_code_venda,
        warranty_start_date: c.warranty_start_date,
        warranty_end_date: fim.toISOString().slice(0, 10),
        dias_ate_vencer: diasAteVencer,
        status: diasAteVencer < 0 ? 'vencida'
          : diasAteVencer <= 90 ? 'vencendo'
          : diasAteVencer <= 180 ? 'atencao'
          : 'em_dia',
        perfil_real: c.perfil_real,
        num_revisoes: c.num_revisoes,
      };
    });

    const counts = {
      vencida: enriched.filter((r: any) => r.status === 'vencida').length,
      vencendo: enriched.filter((r: any) => r.status === 'vencendo').length,
      atencao: enriched.filter((r: any) => r.status === 'atencao').length,
      em_dia: enriched.filter((r: any) => r.status === 'em_dia').length,
    };

    // Prioriza vencendo + atencao (oportunidades quentes)
    const results = enriched
      .filter((r: any) => r.status === 'vencendo' || r.status === 'atencao' || r.status === 'vencida')
      .sort((a: any, b: any) => a.dias_ate_vencer - b.dias_ate_vencer)
      .slice(0, limit);

    return {
      anos_garantia,
      total: enriched.length,
      counts,
      results,
    };
  });

  // ====================================================================
  // GET /metrics/anomalias-dealer
  // ====================================================================
  // Detecta dealers cuja taxa de retenção (% perfil "fiel") está
  // significativamente abaixo da média da rede — z-score < -1.
  // Útil pra ação corretiva: visita do regional, treinamento, etc.
  // ====================================================================
  app.get('/metrics/anomalias-dealer', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'Dealers com taxa de fidelização anômala (z-score < -1)',
      querystring: z.object({
        min_clientes: z.coerce.number().int().min(10).default(50),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
    },
  }, async (req) => {
    requireUser(req);
    const { min_clientes, limit } = req.query as any;

    // Agregação roda DENTRO do Postgres (função dealer_perfil_stats, migration
    // 016): devolve uma linha por dealer (~412 linhas) com pct_fiel/abandono/
    // esquecido/economico já calculado — agregar 175k VINs em JS não faria sentido.
    const rpcData = await sql`
      select * from public.dealer_perfil_stats(min_clientes => ${min_clientes})
    `;

    const dealers = (rpcData ?? []).map((r: any) => ({
      dealer_code: r.dealer_code as number,
      total_clientes: Number(r.total_clientes),
      pct_fiel: Number(r.pct_fiel),
      pct_abandono: Number(r.pct_abandono),
      pct_esquecido: Number(r.pct_esquecido),
      pct_economico: Number(r.pct_economico),
    }));

    if (dealers.length === 0) {
      return { total_dealers: 0, media_rede: null, dp_rede: null, anomalias: [] };
    }

    // Z-score em pct_fiel
    const pctFielArr = dealers.map((d: any) => d.pct_fiel);
    const media = pctFielArr.reduce((a: number, b: number) => a + b, 0) / pctFielArr.length;
    const variancia = pctFielArr.reduce((acc: number, v: number) => acc + (v - media) ** 2, 0) / pctFielArr.length;
    const dp = Math.sqrt(variancia);

    const enriched = dealers.map((d: any) => ({
      ...d,
      z_score_fidelidade: dp > 0 ? (d.pct_fiel - media) / dp : 0,
      delta_vs_media: d.pct_fiel - media,
    }));

    // Anomalia: z-score < -1 (significativamente abaixo da média)
    const anomalias = enriched
      .filter((d: any) => d.z_score_fidelidade < -1)
      .sort((a: any, b: any) => a.z_score_fidelidade - b.z_score_fidelidade)
      .slice(0, limit);

    // Top performers como referência
    const topPerformers = enriched
      .filter((d: any) => d.z_score_fidelidade > 1)
      .sort((a: any, b: any) => b.z_score_fidelidade - a.z_score_fidelidade)
      .slice(0, 5);

    return {
      total_dealers: dealers.length,
      media_rede: Number(media.toFixed(3)),
      dp_rede: Number(dp.toFixed(3)),
      anomalias,       // dealers que precisam de ação
      top_performers:  topPerformers, // pra referência/benchmark
    };
  });
}
