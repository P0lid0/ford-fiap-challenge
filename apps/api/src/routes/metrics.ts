import type { FastifyInstance } from 'fastify';
import { adminClient } from '../lib/supabase.js';

/**
 * KPIs da concessionária / rede.
 * O VIN Share é estimado a partir do client_history quando disponível:
 *   VIN Share = clientes ativos na rede (revisões realizadas > 0 nos últimos 12 meses)
 *             / total de clientes vendidos
 */
export async function metricRoutes(app: FastifyInstance) {
  app.get('/metrics/dealership', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'KPIs da concessionária (ou rede, se admin)',
    },
  }, async (req) => {
    const u = req.requireUser();
    const sb = adminClient();
    const dealershipFilter = u.role === 'admin' || u.role === 'gestor' ? null : u.dealership_id;

    let q = sb.from('clients').select('id, dealership_id, modelo_comprado, data_compra, predictions(perfil_predito, risco_evasao), client_history(num_revisoes_realizadas, num_revisoes_esperadas, dias_desde_ultima_visita)');
    if (dealershipFilter) q = q.eq('dealership_id', dealershipFilter);
    const { data, error } = await q;
    if (error) throw error;
    const rows = data ?? [];

    const totalClients = rows.length;
    let ativos = 0;
    let totalRevisoesRealizadas = 0;
    let totalRevisoesEsperadas = 0;
    const perfilCounts: Record<string, number> = { fiel: 0, abandono: 0, esquecido: 0, economico: 0 };
    const porModelo: Record<string, number> = {};
    let altoRisco = 0;

    for (const r of rows as any[]) {
      const hist = r.client_history?.[0];
      const pred = r.predictions?.[0];
      if (hist) {
        totalRevisoesRealizadas += hist.num_revisoes_realizadas ?? 0;
        totalRevisoesEsperadas += hist.num_revisoes_esperadas ?? 0;
        if (hist.num_revisoes_realizadas > 0 && hist.dias_desde_ultima_visita < 365) ativos++;
      }
      if (pred) {
        perfilCounts[pred.perfil_predito] = (perfilCounts[pred.perfil_predito] ?? 0) + 1;
        if (pred.risco_evasao >= 0.6) altoRisco++;
      }
      porModelo[r.modelo_comprado] = (porModelo[r.modelo_comprado] ?? 0) + 1;
    }

    const vinShareEstimado = totalClients > 0 ? ativos / totalClients : 0;
    const taxaAderenciaRevisoes = totalRevisoesEsperadas > 0
      ? totalRevisoesRealizadas / totalRevisoesEsperadas : 0;

    return {
      escopo: dealershipFilter ?? 'rede',
      total_clientes: totalClients,
      clientes_ativos: ativos,
      vin_share_estimado: Number(vinShareEstimado.toFixed(3)),
      taxa_aderencia_revisoes: Number(taxaAderenciaRevisoes.toFixed(3)),
      alto_risco_count: altoRisco,
      perfil_counts: perfilCounts,
      por_modelo: porModelo,
    };
  });
}
