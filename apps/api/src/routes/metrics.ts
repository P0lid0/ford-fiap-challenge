import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../plugins/auth.js';
import { adminClient } from '../lib/supabase.js';

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
    const sb = adminClient();
    const dealershipFilter = u.role === 'admin' || u.role === 'gestor' ? null : u.dealership_id;
    const { dealer_code, model_name, idade_bucket } = req.query as any;

    // Helper: aplica filtros opcionais (granularidade pedida no slide D2)
    const anoAtual = new Date().getFullYear();
    const applyFilters = (q: any) => {
      if (dealershipFilter) q = q.eq('dealership_id', dealershipFilter);
      if (dealer_code) q = q.eq('dealer_code_venda', dealer_code);
      if (model_name) q = q.eq('model_name', model_name);
      if (idade_bucket) {
        const [minA, maxA] = IDADE_BUCKETS[idade_bucket as keyof typeof IDADE_BUCKETS];
        q = q.gte('model_year', anoAtual - maxA).lte('model_year', anoAtual - minA);
      }
      return q;
    };

    // === KPIs ===
    const { count: totalCount, error: totalErr } = await applyFilters(
      sb.from('clients').select('id', { count: 'exact', head: true })
    );
    if (totalErr) throw totalErr;
    const totalClients = totalCount ?? 0;

    // Ativos: dias_desde_ultima_revisao <= 365
    const { count: ativosCount } = await applyFilters(
      sb.from('clients').select('id', { count: 'exact', head: true }).lte('dias_desde_ultima_revisao', 365)
    );

    // Por perfil_real
    const perfilCounts: Record<string, number> = { fiel: 0, abandono: 0, esquecido: 0, economico: 0 };
    for (const perfil of Object.keys(perfilCounts)) {
      const { count } = await applyFilters(
        sb.from('clients').select('id', { count: 'exact', head: true }).eq('perfil_real', perfil)
      );
      perfilCounts[perfil] = count ?? 0;
    }

    // Alto risco: abandono + 40% dos esquecidos (heurística)
    const altoRisco = (perfilCounts.abandono ?? 0)
      + Math.round((perfilCounts.esquecido ?? 0) * 0.4);

    // Por modelo
    const FORD_MODELS = ['RANGER', 'KA', 'ECOSPORT', 'TERRITORY', 'BRONCO SPORT',
      'MAVERICK', 'TRANSIT', 'F-150', 'MUSTANG', 'EDGE', 'MUSTANG MACH-E'];
    const porModelo: Record<string, number> = {};
    await Promise.all(FORD_MODELS.map(async (modelo) => {
      const { count } = await applyFilters(
        sb.from('clients').select('id', { count: 'exact', head: true }).eq('model_name', modelo)
      );
      if ((count ?? 0) > 0) porModelo[modelo] = count!;
    }));

    // Por bucket de idade do veículo
    const porIdade: Record<string, number> = {};
    for (const [bucket, [minA, maxA]] of Object.entries(IDADE_BUCKETS)) {
      const { count } = await applyFilters(
        sb.from('clients').select('id', { count: 'exact', head: true })
          .gte('model_year', anoAtual - maxA).lte('model_year', anoAtual - minA)
      );
      porIdade[bucket] = count ?? 0;
    }

    // Taxa de aderência: num_revisoes >= 2
    const { count: aderentes } = await applyFilters(
      sb.from('clients').select('id', { count: 'exact', head: true }).gte('num_revisoes', 2)
    );
    const taxaAderenciaRevisoes = totalClients > 0 ? (aderentes ?? 0) / totalClients : 0;

    const vinShareEstimado = totalClients > 0 ? (ativosCount ?? 0) / totalClients : 0;

    return {
      escopo: dealershipFilter ?? 'rede',
      filtros_aplicados: { dealer_code, model_name, idade_bucket },
      total_clientes: totalClients,
      clientes_ativos: ativosCount ?? 0,
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
    requireUser(req);
    const { dentro_de_dias, limit } = req.query as any;
    const sb = adminClient();

    // Pegamos um lote maior e filtramos em memória — Supabase não tem date_add nativo
    const { data, error } = await sb.from('clients')
      .select('id, nome_cliente, model_name, model_year, vin_hash, dealer_code_venda, ' +
              'sales_date, delivery_date, ultimo_servico, num_revisoes, km_max, ' +
              'dias_desde_ultima_revisao, perfil_real, warranty_start_date')
      .not('model_name', 'is', null)
      .limit(2000);
    if (error) throw error;

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
    requireUser(req);
    const { anos_garantia, limit } = req.query as any;
    const sb = adminClient();

    const { data, error } = await sb.from('clients')
      .select('id, nome_cliente, model_name, model_year, vin_hash, dealer_code_venda, ' +
              'warranty_start_date, perfil_real, num_revisoes')
      .not('warranty_start_date', 'is', null)
      .limit(2000);
    if (error) throw error;

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
    const sb = adminClient();

    // Agregação roda DENTRO do Postgres via RPC. Postgrest tem limite de 1000
    // linhas no SELECT direto, então uma agregação manual em JS com 175k VINs
    // não funcionaria. A função dealer_perfil_stats devolve uma linha por
    // dealer (~412 linhas) com pct_fiel/abandono/esquecido/economico já calculado.
    const { data: rpcData, error } = await sb.rpc('dealer_perfil_stats', {
      min_clientes,
    });
    if (error) throw error;

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
