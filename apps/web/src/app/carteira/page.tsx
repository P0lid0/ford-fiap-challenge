'use client';
/**
 * Carteira — painel UNIFICADO de retenção VIN Share (Desafio 2).
 *
 * Junta o que antes estava em /carteira + /visao-ford + /insights numa
 * única página com seções descritivas. Cobre os 3 blocos do slide D2:
 *
 *   1. Análise e Visualização → KPIs + filtros + por modelo + por idade
 *   2. Geração de Leads / Modelagem Preditiva → próximas revisões + garantia
 *   3. Otimização da Jornada → anomalias dealer + insights IA
 *
 * Mais a "transparência do modelo" antes em /visao-ford:
 *   4. Cohorts por ano de venda · dealer loyalty por perfil · matriz de confusão
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, AlertTriangle, TrendingUp, Users, Activity, ArrowUpRight,
  Sparkles, Megaphone, Target, Car, BarChart3, ShieldAlert, Wrench,
  X, ChevronRight, Building2, Filter, TrendingDown, Database,
  Calendar, RefreshCw, Loader2, Brain,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge, PERFIL_BAR_COLOR, type Perfil } from '@/components/PerfilBadge';
import {
  Card, PageHeader, KpiCard, EmptyState, LoadingState, LinkButton,
} from '@/components/ui';
import { api } from '@/lib/api';

const PERFIS: Perfil[] = ['fiel', 'esquecido', 'economico', 'abandono'];
const FORD_MODELS = ['RANGER', 'KA', 'ECOSPORT', 'TERRITORY', 'BRONCO SPORT',
  'MAVERICK', 'TRANSIT', 'F-150', 'MUSTANG', 'EDGE', 'MUSTANG MACH-E'];
const IDADE_BUCKETS = [
  { value: 'novo' as const, label: '0-2 anos' },
  { value: 'intermediario' as const, label: '2-5 anos' },
  { value: 'veterano' as const, label: '5+ anos' },
];

type Filters = {
  model_name?: string;
  dealer_code?: number;
  idade_bucket?: 'novo' | 'intermediario' | 'veterano';
};

export default function Carteira() {
  // KPIs operacionais (carteira original) — reage aos filtros
  const [metrics, setMetrics] = useState<any>(null);
  // Dados completos da base Ford (antigo /visao-ford) — só carregam 1x
  const [fordReal, setFordReal] = useState<any>(null);
  // KPIs de ações + Insight IA do portfolio (antigo /insights) — só 1x
  const [acoesKpis, setAcoesKpis] = useState<any>(null);
  const [insight, setInsight] = useState<any>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  // Leads quentes (timing + garantia + anomalias)
  const [proximas, setProximas] = useState<any>(null);
  const [garantia, setGarantia] = useState<any>(null);
  const [anomalias, setAnomalias] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({});

  // KPIs operacionais reagem aos filtros
  useEffect(() => {
    api.metrics(filters).then(setMetrics).catch(console.error);
  }, [filters.model_name, filters.dealer_code, filters.idade_bucket]);

  // Dados pesados carregam 1x
  useEffect(() => {
    Promise.all([
      api.fordReal().catch(() => null),
      api.acoesKpis().catch(() => null),
      api.proximasRevisoes(60, 30).catch(() => null),
      api.garantiaStatus(3, 30).catch(() => null),
      api.anomaliasDealer(50, 10).catch(() => null),
    ])
      .then(([f, k, p, g, a]) => {
        setFordReal(f);
        setAcoesKpis(k);
        setProximas(p);
        setGarantia(g);
        setAnomalias(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function loadInsight() {
    setInsightLoading(true); setInsightErr(null);
    try { setInsight(await api.insightPortfolio()); }
    catch (e: any) { setInsightErr(e.message ?? String(e)); }
    finally { setInsightLoading(false); }
  }

  const totalPerfil = metrics ? PERFIS.reduce((s, p) => s + (metrics.perfil_counts?.[p] ?? 0), 0) : 0;
  const hasFilters = !!(filters.model_name || filters.dealer_code || filters.idade_bucket);

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader
          eyebrow={<><BarChart3 className="w-3 h-3" /> Painel de retenção · Desafio 2</>}
          title="Carteira"
          description="Análise da base Ford + leads preditivos + insights IA. Tudo num só lugar."
          action={
            <>
              <LinkButton href="/acoes" variant="secondary" size="md" icon={Megaphone}>
                Ver ações
              </LinkButton>
              <LinkButton href="/clientes/novo" variant="primary" size="lg" icon={Plus} uppercase>
                Novo cliente
              </LinkButton>
            </>
          }
        />

        {loading ? (
          <LoadingState text="Carregando painel completo (KPIs + base Ford + leads + anomalias)…" />
        ) : (
          <div className="space-y-10">

            {/* ============================================================ */}
            {/* SEÇÃO 1: KPIS OPERACIONAIS + FILTROS                         */}
            {/* "Análise e Visualização" — bloco 1 do slide D2               */}
            {/* ============================================================ */}
            <section>
              <SectionHeader
                number="1"
                title="KPIs operacionais"
                description="Visão consolidada da carteira. Use os filtros para granularidade por dealer, modelo ou idade do veículo."
              />

              {/* Filtros */}
              <Card compact className="mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span className="label">Granularidade:</span>
                  <select value={filters.model_name ?? ''} onChange={e =>
                    setFilters(f => ({ ...f, model_name: e.target.value || undefined }))}
                    className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
                    <option value="">Todos os modelos</option>
                    {FORD_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={filters.idade_bucket ?? ''} onChange={e =>
                    setFilters(f => ({ ...f, idade_bucket: (e.target.value || undefined) as Filters['idade_bucket'] }))}
                    className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
                    <option value="">Qualquer idade</option>
                    {IDADE_BUCKETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  <input type="number" placeholder="Dealer code"
                    value={filters.dealer_code ?? ''}
                    onChange={e => setFilters(f => ({ ...f, dealer_code: e.target.value ? Number(e.target.value) : undefined }))}
                    className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue w-32" />
                  {hasFilters && (
                    <button onClick={() => setFilters({})}
                      className="text-xs text-ford-blue hover:underline inline-flex items-center gap-1">
                      <X className="w-3 h-3" /> Limpar
                    </button>
                  )}
                  {hasFilters && metrics && (
                    <span className="ml-auto text-xs text-slate">
                      <b className="text-ford-blue">{metrics.total_clientes.toLocaleString('pt-BR')}</b> com esses filtros
                    </span>
                  )}
                </div>
              </Card>

              {/* KPIs hero */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <KpiCard variant="hero" accent="blue" icon={Target}
                  label="VIN Share"
                  value={`${Math.round((metrics?.vin_share_estimado ?? 0) * 100)}%`}
                  sub={`${metrics?.clientes_ativos ?? 0} ativos na rede`} />
                <KpiCard variant="hero" accent="slate" icon={Users}
                  label="Total clientes"
                  value={(metrics?.total_clientes ?? 0).toLocaleString('pt-BR')}
                  sub={hasFilters ? 'com filtros aplicados' : 'na sua carteira'} />
                <KpiCard variant="hero" accent="rose" icon={AlertTriangle}
                  label="Alto risco"
                  value={metrics?.alto_risco_count ?? 0}
                  sub="ação esta semana" />
                <KpiCard variant="hero" accent="emerald" icon={TrendingUp}
                  label="Aderência revisões"
                  value={`${Math.round((metrics?.taxa_aderencia_revisoes ?? 0) * 100)}%`}
                  sub="realizadas vs esperadas" />
              </div>

              {/* KPIs de ações */}
              {acoesKpis && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KpiCard icon={Megaphone} label="Ações registradas"
                    value={(acoesKpis.total ?? 0).toLocaleString('pt-BR')} />
                  <KpiCard icon={Activity} label="Taxa de conclusão"
                    value={`${Math.round((acoesKpis.taxa_conclusao ?? 0) * 100)}%`} />
                  <KpiCard icon={Sparkles} accent="emerald" label="Taxa de sucesso"
                    value={`${Math.round((acoesKpis.taxa_sucesso ?? 0) * 100)}%`} />
                </div>
              )}
            </section>

            {/* ============================================================ */}
            {/* SEÇÃO 2: COMPORTAMENTO (perfis + por modelo + por idade)     */}
            {/* "Identificar padrões e tendências" — bloco 1 do slide D2     */}
            {/* ============================================================ */}
            <section>
              <SectionHeader
                number="2"
                title="Comportamento e granularidade"
                description="Os 4 perfis vêm do clustering (KMeans) sobre o histórico completo. A granularidade por modelo e idade do veículo permite isolar tendências por segmento."
              />

              <Card title="Distribuição por perfil comportamental"
                description="Cada cliente é classificado em um dos 4 arquétipos — fiel, esquecido, econômico ou abandono — pelo modelo XGBoost treinado nos 175k VINs reais.">
                {totalPerfil === 0 ? (
                  <EmptyState
                    bare icon={Users}
                    title="Nenhuma classificação ainda"
                    description="Cadastre clientes ou importe a base Ford pra ver a distribuição."
                  />
                ) : (
                  <div className="space-y-4">
                    {PERFIS.map(p => {
                      const count = metrics?.perfil_counts?.[p] ?? 0;
                      const pct = totalPerfil > 0 ? (count / totalPerfil) * 100 : 0;
                      return (
                        <div key={p}>
                          <div className="flex items-center justify-between mb-1.5">
                            <PerfilBadge perfil={p} />
                            <div className="text-sm font-bold text-charcoal tabular">
                              {count.toLocaleString('pt-BR')}
                              <span className="text-gray-400 font-normal ml-1">({pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-full ${PERFIL_BAR_COLOR[p]} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                {metrics?.por_modelo && Object.keys(metrics.por_modelo).length > 0 && (
                  <Card title="Por modelo Ford"
                    description="Volume de clientes por modelo na sua carteira (filtros aplicados).">
                    <div className="space-y-2">
                      {Object.entries(metrics.por_modelo)
                        .sort(([, a]: any, [, b]: any) => b - a)
                        .slice(0, 8)
                        .map(([modelo, count]: any) => {
                          const max = Math.max(...(Object.values(metrics.por_modelo) as number[]));
                          const pct = max > 0 ? (count / max) * 100 : 0;
                          return (
                            <div key={modelo} className="flex items-center gap-3">
                              <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <div className="w-28 text-xs font-medium text-charcoal truncate">{modelo}</div>
                              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div className="bg-ford-blue h-full" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="w-20 text-right text-xs tabular font-bold text-charcoal">
                                {count.toLocaleString('pt-BR')}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </Card>
                )}

                {metrics?.por_idade && (
                  <Card title="Por idade do veículo"
                    description="Veículos novos (0-2a) ainda têm garantia; veteranos (5+) têm maior risco de abandono.">
                    <div className="space-y-3">
                      {IDADE_BUCKETS.map(b => {
                        const count = metrics.por_idade[b.value] ?? 0;
                        const max = Math.max(...(Object.values(metrics.por_idade) as number[]));
                        const pct = max > 0 ? (count / max) * 100 : 0;
                        const color = b.value === 'novo' ? 'bg-emerald-500'
                          : b.value === 'intermediario' ? 'bg-amber-500' : 'bg-rose-500';
                        return (
                          <div key={b.value}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-bold text-charcoal">{b.label}</span>
                              <span className="text-sm font-bold tabular text-charcoal">
                                {count.toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className={`${color} h-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </div>
            </section>

            {/* ============================================================ */}
            {/* SEÇÃO 3: LEADS QUENTES                                       */}
            {/* "Geração de Leads e Modelagem Preditiva" — bloco 2 do slide  */}
            {/* ============================================================ */}
            <section>
              <SectionHeader
                number="3"
                title="Leads preditivos"
                description="Veículos que precisam de serviço (próxima revisão estimada) e oportunidades de lock-in (garantia vencendo). Clique pra abrir a ficha do cliente e disparar ação."
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProximasRevisoesCard data={proximas} />
                <GarantiaCard data={garantia} />
              </div>
            </section>

            {/* ============================================================ */}
            {/* SEÇÃO 4: ANOMALIAS                                           */}
            {/* "Identificar padrões, tendências e anomalias" — bloco 1      */}
            {/* ============================================================ */}
            <section>
              <SectionHeader
                number="4"
                title="Anomalias na rede"
                description="Dealers cuja taxa de retenção (% clientes fiéis) está mais de 1 desvio-padrão abaixo da média da rede. Esses dealers precisam de visita técnica, treinamento ou revisão do mix de produto."
              />
              <AnomaliasDealerCard data={anomalias} />
            </section>

            {/* ============================================================ */}
            {/* SEÇÃO 5: INSIGHT IA DA CARTEIRA (era /insights)              */}
            {/* "Otimização da jornada" — bloco 3 do slide                   */}
            {/* ============================================================ */}
            <section>
              <SectionHeader
                number="5"
                title="Briefing executivo da IA"
                description="Análise estratégica gerada por LLM cruzando perfis, risco médio, modelo predominante. Use pra orientar reunião com o time comercial."
                action={
                  <button onClick={loadInsight} disabled={insightLoading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-bold uppercase tracking-wider">
                    {insightLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {insightLoading ? 'Gerando…' : insight ? 'Atualizar' : 'Gerar briefing'}
                  </button>
                }
              />
              {insightErr && (
                <Card><div className="text-sm text-rose-700">{insightErr}</div></Card>
              )}
              {!insight && !insightLoading && !insightErr && (
                <Card>
                  <EmptyState bare icon={Brain}
                    title="Briefing ainda não gerado"
                    description="Clique 'Gerar briefing' acima — a IA vai cruzar os perfis, modelo predominante e risco médio pra produzir análise estratégica em PT-BR." />
                </Card>
              )}
              {insight && (
                <div className="bg-gradient-to-br from-ford-blue-dark to-ford-blue text-white rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">Análise estratégica</h3>
                      <p className="text-xs text-gray-300">{insight.model} · {insight.source === 'cache' ? 'cache' : 'fresh'}</p>
                    </div>
                  </div>
                  <div className="prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-sm">
                    {insight.output}
                  </div>
                  {insight.metrics && (
                    <div className="mt-5 pt-4 border-t border-white/20 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><div className="opacity-60">Total</div><div className="font-bold text-base">{insight.metrics.totalClients}</div></div>
                      <div><div className="opacity-60">Risco médio</div><div className="font-bold text-base">{Math.round(insight.metrics.avgRisco * 100)}%</div></div>
                      <div><div className="opacity-60">Fiéis</div><div className="font-bold text-base">{insight.metrics.perfilCounts?.fiel ?? 0}</div></div>
                      <div><div className="opacity-60">Abandono</div><div className="font-bold text-base">{insight.metrics.perfilCounts?.abandono ?? 0}</div></div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ============================================================ */}
            {/* SEÇÃO 6: ANÁLISE DA BASE FORD (era /visao-ford)              */}
            {/* "Padrões e tendências" — bloco 1 do slide                    */}
            {/* ============================================================ */}
            {fordReal && (
              <section>
                <SectionHeader
                  number="6"
                  title="Base Ford real — exploração"
                  description={`Análise do dataset oficial (vin_share_Desafio_02.xlsx · ${fordReal.totais?.vins_unicos?.toLocaleString('pt-BR')} VINs · atualizado ${fordReal.atualizado_em}). Cohorts mostram padrão temporal; dealer loyalty mostra fidelização operacional.`}
                />

                {/* KPIs da base */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <KpiCard icon={Database} accent="blue"
                    label="VINs únicos"
                    value={fordReal.totais.vins_unicos.toLocaleString('pt-BR')} />
                  <KpiCard icon={Wrench} accent="slate"
                    label="Service orders"
                    value={fordReal.totais.service_orders.toLocaleString('pt-BR')}
                    sub={`média ${fordReal.totais.media_servicos_por_vin} por VIN`} />
                  <KpiCard icon={Building2} accent="purple"
                    label="Concessionárias"
                    value={fordReal.totais.dealers.toLocaleString('pt-BR')} />
                  <KpiCard icon={Target} accent="emerald"
                    label="VIN Share estimado"
                    value={`${Math.round(fordReal.vin_share_estimado * 100)}%`}
                    sub="ativos < 365d na rede" />
                </div>

                {/* Cohorts por ano */}
                <Card
                  title="Cohorts por ano de venda — % fiéis vs abandono"
                  description="Cada ano de venda mostra quantos % dos veículos comprados naquele ano se tornaram fiéis vs abandonaram a rede. Padrão temporal pra detectar quando algo mudou (mudança de gerente, política de preço, etc.)."
                  className="mb-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                    {(fordReal.cohorts_por_ano_venda ?? [])
                      .filter((c: any) => c.ano_venda && c.ano_venda >= 2020)
                      .map((c: any) => (
                      <div key={c.ano_venda} className="bg-gray-50 rounded-xl p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">{c.ano_venda}</div>
                        <div className="text-lg font-black text-charcoal tabular">{c.total.toLocaleString('pt-BR')}</div>
                        <div className="text-[10px] text-gray-500 mb-2">vendas</div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700 font-bold">Fiel</span>
                            <span className="text-emerald-700 tabular">{Math.round(c.fieis_pct * 100)}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-rose-700 font-bold">Abandono</span>
                            <span className="text-rose-700 tabular">{Math.round(c.abandono_pct * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card title="Dias até a 1ª revisão (mediana por perfil)"
                    description="Cliente fiel volta cedo; cliente em abandono nunca volta ou demora.">
                    <div className="space-y-3">
                      {Object.entries(fordReal.dias_ate_1a_revisao_mediana_por_perfil ?? {}).map(([p, dias]: any) => (
                        <div key={p} className="flex items-center justify-between">
                          <PerfilBadge perfil={p as any} />
                          <div className="text-right">
                            <div className="text-2xl font-black text-charcoal tabular">{dias}</div>
                            <div className="text-[10px] text-gray-500">dias</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card title="Dealer loyalty média por perfil"
                    description="% das revisões feitas no mesmo dealer onde o carro foi comprado. Indica força da relação cliente↔dealer.">
                    <div className="space-y-3">
                      {Object.entries(fordReal.dealer_loyalty_media_por_perfil ?? {}).map(([p, loy]: any) => (
                        <div key={p}>
                          <div className="flex items-center justify-between mb-1">
                            <PerfilBadge perfil={p as any} />
                            <span className="text-sm tabular font-bold text-charcoal">{Math.round(loy * 100)}%</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={PERFIL_BAR_COLOR[p as Perfil]} style={{ width: `${loy * 100}%`, height: '100%' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </section>
            )}

            {/* ============================================================ */}
            {/* SEÇÃO 7: TRANSPARÊNCIA DO MODELO ML                          */}
            {/* Prova técnica que o XGBoost foi treinado direito             */}
            {/* ============================================================ */}
            {fordReal?.modelo_ml && (
              <section>
                <SectionHeader
                  number="7"
                  title="Transparência do modelo ML"
                  description={`O classificador (${fordReal.modelo_ml.model_version}) foi treinado nos dados reais sem data leakage — nenhuma feature usa comportamento futuro do mesmo VIN. A matriz de confusão mostra a qualidade da predição por classe.`}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <KpiCard icon={Target} accent="blue"
                    label="Accuracy"
                    value={`${Math.round(fordReal.modelo_ml.accuracy * 100)}%`} />
                  <KpiCard icon={TrendingUp} accent="emerald"
                    label="F1 weighted"
                    value={fordReal.modelo_ml.f1_weighted?.toFixed(3) ?? '—'} />
                  <KpiCard icon={Activity} accent="amber"
                    label="F1 macro"
                    value={fordReal.modelo_ml.f1_macro?.toFixed(3) ?? '—'} />
                  <KpiCard icon={Database} accent="slate"
                    label="Amostras treino"
                    value={fordReal.modelo_ml.n_samples_train?.toLocaleString('pt-BR') ?? '—'} />
                </div>

                <Card title="Matriz de confusão"
                  description="Diagonal verde = predições corretas. Off-diagonal = onde o modelo erra. Quanto mais concentrada na diagonal, melhor o modelo.">
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr>
                          <th className="px-2 py-1"></th>
                          {(fordReal.modelo_ml.labels ?? []).map((l: string) => (
                            <th key={l} className="px-2 py-1 text-center font-bold text-gray-500 uppercase text-[10px]">Pred {l}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(fordReal.modelo_ml.confusion_matrix ?? []).map((row: number[], i: number) => {
                          const label = fordReal.modelo_ml.labels[i];
                          const total = row.reduce((s: number, n: number) => s + n, 0);
                          return (
                            <tr key={i}>
                              <td className="px-2 py-1 font-bold text-gray-600 uppercase text-[10px]">Real {label}</td>
                              {row.map((v: number, j: number) => {
                                const isDiag = i === j;
                                const pct = total > 0 ? (v / total) * 100 : 0;
                                return (
                                  <td key={j} className={`px-2 py-1.5 text-center tabular ${isDiag ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-gray-50'}`}>
                                    <div>{v.toLocaleString('pt-BR')}</div>
                                    <div className="text-[9px] text-gray-400">{pct.toFixed(0)}%</div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </section>
            )}

            <div className="bg-ford-blue-soft/30 border border-ford-blue/15 rounded-2xl p-4 text-xs text-charcoal flex items-start gap-3">
              <Database className="w-4 h-4 text-ford-blue flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <b>Fonte:</b> {fordReal?.fonte ?? 'dataset oficial Ford'}. Dados anonimizados via VIN_Hash, nunca expostos em claro.
                {' '}Pipeline ETL em <code>scripts/etl-d2-real.py</code>, modelo em <code>services/ml/src/classifier_real.py</code>.
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ====================================================================
// Helpers
// ====================================================================

function SectionHeader({ number, title, description, action }: {
  number: string; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-ford-blue text-white flex items-center justify-center font-black text-sm">
          {number}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-charcoal">{title}</h2>
          {description && <p className="text-sm text-slate mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function ProximasRevisoesCard({ data }: { data: any }) {
  if (!data) {
    return (
      <Card title="Próximas revisões (60 dias)" description="Veículos com manutenção atrasada ou próxima do timing recomendado.">
        <EmptyState bare icon={Wrench} title="Sem dados de timing" description="Calculando…" />
      </Card>
    );
  }
  const urgenciaStyle: Record<string, string> = {
    vencida:  'bg-rose-100 text-rose-700 border-rose-200',
    imediata: 'bg-amber-100 text-amber-700 border-amber-200',
    proxima:  'bg-blue-100 text-blue-700 border-blue-200',
    distante: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <Card
      title="Próximas revisões (60 dias)"
      description={`${data.total} veículos · ${data.breakdown.vencida} atrasadas · ${data.breakdown.imediata} imediatas (≤30d). Estimado pela regra Ford: último serviço + 12 meses.`}
    >
      {data.results.length === 0 ? (
        <div className="text-sm text-slate py-4">Nenhum veículo com próxima revisão nos próximos 60 dias.</div>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {data.results.slice(0, 12).map((r: any) => (
            <Link key={r.id} href={`/clientes/${r.id}`}
              className="group flex items-center gap-3 bg-gray-50 hover:bg-ford-blue-soft/30 rounded-lg px-3 py-2 transition">
              <Wrench className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-charcoal truncate">
                  {r.nome_cliente ?? `VIN ${String(r.vin_hash).slice(0, 8)}…`}
                </div>
                <div className="text-[10px] text-slate truncate">
                  {r.model_name} {r.model_year} · {r.num_revisoes ?? 0} revisões
                  {r.dealer_code_venda && <> · Dealer {r.dealer_code_venda}</>}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${urgenciaStyle[r.urgencia]}`}>
                {r.urgencia === 'vencida' ? `${Math.abs(r.dias_ate_proxima)}d atrasada` : `${r.dias_ate_proxima}d`}
              </span>
              <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-ford-blue" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function GarantiaCard({ data }: { data: any }) {
  if (!data) {
    return (
      <Card title="Garantia — lock-in" description="Veículos com garantia perto de vencer (oportunidade de oferecer renovação/manutenção antes que ele saia da rede).">
        <EmptyState bare icon={ShieldAlert} title="Sem dados" description="Cadastre warranty_start_date pra ativar." />
      </Card>
    );
  }
  const statusStyle: Record<string, string> = {
    vencida:  'bg-rose-100 text-rose-700 border-rose-200',
    vencendo: 'bg-amber-100 text-amber-700 border-amber-200',
    atencao:  'bg-blue-100 text-blue-700 border-blue-200',
    em_dia:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return (
    <Card
      title="Garantia — oportunidades de lock-in"
      description={`${data.counts.vencida} vencidas · ${data.counts.vencendo} vencendo em 90d · ${data.counts.atencao} em alerta (180d). Cliente com garantia vencendo é alvo prioritário pra ofertar pacote pós-garantia.`}
    >
      {data.results.length === 0 ? (
        <div className="text-sm text-slate py-4">Sem veículos com garantia em risco.</div>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {data.results.slice(0, 12).map((r: any) => (
            <Link key={r.id} href={`/clientes/${r.id}`}
              className="group flex items-center gap-3 bg-gray-50 hover:bg-ford-blue-soft/30 rounded-lg px-3 py-2 transition">
              <ShieldAlert className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-charcoal truncate">
                  {r.nome_cliente ?? `VIN ${String(r.vin_hash).slice(0, 8)}…`}
                </div>
                <div className="text-[10px] text-slate truncate">
                  {r.model_name} {r.model_year} · Vence {new Date(r.warranty_end_date).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusStyle[r.status]}`}>
                {r.status === 'vencida' ? 'venc.' : `${r.dias_ate_vencer}d`}
              </span>
              <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-ford-blue" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function AnomaliasDealerCard({ data }: { data: any }) {
  if (!data || data.total_dealers === 0) {
    return (
      <Card>
        <EmptyState bare icon={TrendingDown} title="Sem dados suficientes"
          description="Precisamos de dealers com 50+ clientes pra detectar anomalias." />
      </Card>
    );
  }
  const mediaPct = (data.media_rede * 100).toFixed(1);
  return (
    <Card description={`Média da rede: ${mediaPct}% fiéis · ${data.anomalias.length} dealers abaixo de 1σ (precisam de ação)`}>
      {data.anomalias.length === 0 ? (
        <div className="text-sm text-emerald-700 py-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Toda a rede está dentro da curva normal — sem anomalias críticas.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {data.anomalias.slice(0, 6).map((d: any) => (
              <div key={d.dealer_code} className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-rose-600" />
                    <span className="font-bold text-sm text-charcoal">Dealer {d.dealer_code}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-200 px-1.5 py-0.5 rounded">
                    z: {d.z_score_fidelidade.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-slate mb-2">{d.total_clientes.toLocaleString('pt-BR')} clientes</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black tabular text-rose-700">{(d.pct_fiel * 100).toFixed(1)}%</span>
                  <span className="text-xs text-slate">fiéis</span>
                  <span className="text-xs text-rose-600 ml-auto">
                    {(d.delta_vs_media * 100).toFixed(1)}pp vs média
                  </span>
                </div>
              </div>
            ))}
          </div>
          {data.top_performers?.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <div className="label mb-2">Top performers (benchmark)</div>
              <div className="flex flex-wrap gap-2">
                {data.top_performers.slice(0, 5).map((d: any) => (
                  <div key={d.dealer_code} className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-xs">
                    <Building2 className="w-3 h-3 text-emerald-600" />
                    <span className="font-bold">Dealer {d.dealer_code}</span>
                    <span className="text-emerald-700 font-bold">{(d.pct_fiel * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
