'use client';
/**
 * Leads priorizados (Desafio 2).
 *
 * Como funciona:
 *   1. Para CADA cliente da base (175k Ford-real + cadastros manuais), o sistema
 *      calcula um "risco composto":
 *        risco_base   = f(perfil_real)         — do ETL (XGBoost)
 *        + bonificações por sinais:
 *           • revisão atrasada (>365d sem serviço)
 *           • garantia já vencida ou vencendo (<90d)
 *           • dealer loyalty baixa (<0.4)
 *           • veículo veterano (5+ anos)
 *           • sem revisão alguma (1ª revisão não feita após 15 meses)
 *   2. Cliente que ultrapassa o limiar (default 40%) entra na lista
 *   3. Ordenação: maior risco primeiro · empate desempata por num_revisoes asc
 *   4. UI mostra os SINAIS de cada lead — operador sabe POR QUE ele está ali
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle, Flame, Filter, ChevronRight, AlertTriangle,
  Activity, Building2, Car, Wrench, ShieldAlert, Calendar, Info,
  TrendingDown, Megaphone, X,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import { Card, PageHeader, EmptyState, LoadingState, LinkButton } from '@/components/ui';
import { api } from '@/lib/api';

const FORD_MODELS = ['RANGER', 'KA', 'ECOSPORT', 'TERRITORY', 'BRONCO SPORT',
  'MAVERICK', 'TRANSIT', 'F-150', 'MUSTANG', 'EDGE', 'MUSTANG MACH-E'];

const SINAL_META: Record<string, { label: string; description: string; icon: any; color: string }> = {
  revisao_atrasada:    { label: 'Revisão atrasada', description: 'Mais de 365 dias sem serviço na rede', icon: Wrench, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  sem_revisao_alguma:  { label: 'Sem 1ª revisão',   description: 'Veículo entregue há 15+ meses e nunca passou pela rede', icon: AlertTriangle, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  garantia_vencida:    { label: 'Garantia vencida', description: 'Garantia de 3 anos já expirou', icon: ShieldAlert, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  garantia_vencendo:   { label: 'Garantia vencendo', description: 'Garantia vence nos próximos 90 dias', icon: ShieldAlert, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  dealer_loyalty_baixa:{ label: 'Pouca fidelidade ao dealer', description: 'Menos de 40% das revisões no dealer original', icon: Building2, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  veiculo_veterano:    { label: 'Veículo veterano', description: '5 anos ou mais — risco natural de migrar pra oficina externa', icon: Calendar, color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

type SinalKey = 'revisao_atrasada' | 'garantia_vencida' | 'garantia_vencendo'
              | 'dealer_loyalty_baixa' | 'veiculo_veterano' | 'sem_revisao_alguma';
type Filters = {
  risco_min: number;
  perfil?: 'fiel' | 'abandono' | 'esquecido' | 'economico';
  modelo?: string;
  dealer_code?: number;
  sinal?: SinalKey;
};

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ risco_min: 0.5 });

  async function load() {
    setLoading(true);
    try {
      setLeads(await api.listLeads({ ...filters, limit: 100 }));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Carrega stats agregados 1x (independente dos filtros — mostra o universo total)
  useEffect(() => { api.leadsStats().then(setStats).catch(console.error); }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [
    filters.risco_min, filters.perfil, filters.modelo, filters.dealer_code, filters.sinal,
  ]);

  const hasFilters = !!(filters.perfil || filters.modelo || filters.dealer_code || filters.sinal);

  return (
    <Shell>
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader
          eyebrow={<><Flame className="w-3 h-3 text-rose-500" /> Atendimento prioritário · Desafio 2</>}
          title="Leads priorizados"
          description="Lista de clientes em risco de evasão da rede Ford, gerada automaticamente pelo modelo + sinais comportamentais."
          action={
            <div className="flex items-center gap-2 text-sm">
              <Flame className="w-4 h-4 text-rose-500" />
              <span className="font-bold text-charcoal tabular">{leads.length}</span>
              <span className="text-slate">leads exibidos</span>
            </div>
          }
        />

        {/* ============================================================ */}
        {/* SEÇÃO 1: EXPLICAÇÃO DA FONTE — alta visibilidade pro analista */}
        {/* ============================================================ */}
        <Card compact className="mb-6 bg-ford-blue-soft/30 border-ford-blue/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-ford-blue flex-shrink-0 mt-0.5" />
            <div className="text-sm text-charcoal leading-relaxed">
              <b>Como esta lista é gerada</b>: o sistema cruza o <b>perfil comportamental</b> do
              cliente (predito pelo XGBoost real) com <b>sinais operacionais</b> em tempo real
              (atraso de revisão, status da garantia, fidelidade ao dealer, idade do veículo).
              Cada sinal adiciona pontos ao risco composto. Ordenamos pelo maior risco —
              clientes com mais sinais críticos sobem no topo. Os <b>chips coloridos</b> em
              cada lead mostram exatamente <i>por que</i> ele está aí.
            </div>
          </div>
        </Card>

        {/* ============================================================ */}
        {/* SEÇÃO 2: KPIs DO UNIVERSO TOTAL DE LEADS                     */}
        {/* ============================================================ */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard color="bg-rose-500" label="Alto risco (≥70%)"
              value={stats.breakdown_urgencia.alto}
              desc="Ação no mesmo dia"
              onClick={() => setFilters(f => ({ ...f, risco_min: 0.7 }))} />
            <StatCard color="bg-amber-500" label="Médio (50-69%)"
              value={stats.breakdown_urgencia.medio}
              desc="Ação em 48h"
              onClick={() => setFilters(f => ({ ...f, risco_min: 0.5 }))} />
            <StatCard color="bg-blue-500" label="Baixo (40-49%)"
              value={stats.breakdown_urgencia.baixo}
              desc="Acompanhar semanal"
              onClick={() => setFilters(f => ({ ...f, risco_min: 0.4 }))} />
            <StatCard color="bg-ford-blue" label="Universo total"
              value={stats.total}
              desc="Toda a carteira com risco ≥40%" />
          </div>
        )}

        {/* ============================================================ */}
        {/* SEÇÃO 3: FILTROS GRANULARES                                  */}
        {/* ============================================================ */}
        <Card compact className="mb-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="label">Filtros:</span>
              <div className="flex items-center gap-2">
                <label className="label">Risco min:</label>
                <select value={filters.risco_min} onChange={e => setFilters(f => ({ ...f, risco_min: Number(e.target.value) }))}
                  className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
                  {[0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(v => (
                    <option key={v} value={v}>{Math.round(v * 100)}%</option>
                  ))}
                </select>
              </div>
              <select value={filters.perfil ?? ''} onChange={e => setFilters(f => ({ ...f, perfil: (e.target.value || undefined) as any }))}
                className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
                <option value="">Todos os perfis</option>
                <option value="abandono">Abandono</option>
                <option value="esquecido">Esquecido</option>
                <option value="economico">Econômico</option>
                <option value="fiel">Fiel (improvável)</option>
              </select>
              <select value={filters.modelo ?? ''} onChange={e => setFilters(f => ({ ...f, modelo: e.target.value || undefined }))}
                className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
                <option value="">Todos os modelos</option>
                {FORD_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="number" placeholder="Dealer code"
                value={filters.dealer_code ?? ''}
                onChange={e => setFilters(f => ({ ...f, dealer_code: e.target.value ? Number(e.target.value) : undefined }))}
                className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue w-28" />
            </div>

            {/* Filtro por sinal (chips clicáveis) */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="label">Sinal:</span>
              {Object.entries(SINAL_META).map(([key, meta]) => {
                const count = stats?.por_sinal?.[key] ?? 0;
                const active = filters.sinal === key;
                const Icon = meta.icon;
                return (
                  <button key={key}
                    onClick={() => setFilters(f => ({ ...f, sinal: active ? undefined : key as any }))}
                    title={meta.description}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition border ${
                      active
                        ? 'bg-ford-blue text-white border-ford-blue'
                        : `${meta.color} hover:opacity-80`
                    }`}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                    {count > 0 && <span className="opacity-70 ml-0.5">({count.toLocaleString('pt-BR')})</span>}
                  </button>
                );
              })}
            </div>

            {hasFilters && (
              <button onClick={() => setFilters({ risco_min: 0.5 })}
                className="text-xs text-ford-blue hover:underline inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
        </Card>

        {/* ============================================================ */}
        {/* SEÇÃO 4: LISTA DE LEADS                                       */}
        {/* ============================================================ */}
        {loading ? (
          <LoadingState text="Carregando leads…" />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title={hasFilters ? 'Nenhum lead com esses filtros' : 'Carteira saudável!'}
            description={hasFilters ? 'Afrouxe os filtros pra ver mais leads.' : 'Nenhum cliente em risco no momento.'}
            action={hasFilters
              ? <button onClick={() => setFilters({ risco_min: 0.5 })} className="text-sm text-ford-blue hover:underline">Limpar filtros</button>
              : undefined}
          />
        ) : (
          <div className="space-y-3">
            {leads.map((l: any, i: number) => <LeadCard key={l.id} lead={l} rank={i + 1} />)}
          </div>
        )}

        {/* Footer instrucional */}
        {!loading && leads.length > 0 && (
          <div className="mt-8 bg-ford-blue-soft/40 border border-ford-blue/15 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-ford-blue flex-shrink-0 mt-0.5" />
            <p className="text-xs text-charcoal leading-relaxed">
              <b>Próximo passo</b>: clica em <b>"Abrir ficha"</b> num lead → vê a Visão 360
              (próxima revisão, garantia, idade) → registra uma ação (ligação, WhatsApp, e-mail
              real) → o histórico fica em <Link href="/acoes" className="text-ford-blue underline font-bold">/acoes</Link>{' '}
              e calibra o modelo no próximo treino. Pra disparar campanha em lote por
              perfil/sinal, vai em <Link href="/acoes" className="text-ford-blue underline font-bold">/acoes</Link>.
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ====================================================================
function StatCard({ color, label, value, desc, onClick }: {
  color: string; label: string; value: number; desc: string; onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`text-left bg-white border border-gray-200 rounded-2xl p-4 shadow-soft transition ${
        onClick ? 'hover:border-ford-blue hover:shadow-md cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="label">{label}</span>
      </div>
      <div className="text-3xl font-black text-charcoal tabular">
        {value.toLocaleString('pt-BR')}
      </div>
      <div className="text-[10px] text-slate mt-1">{desc}</div>
    </Comp>
  );
}

// ====================================================================
function LeadCard({ lead, rank }: { lead: any; rank: number }) {
  const risco = lead.risco_composto;
  const bg = risco >= 0.7 ? 'bg-rose-500' : risco >= 0.5 ? 'bg-amber-500' : 'bg-blue-500';
  const textColor = risco >= 0.7 ? 'text-rose-500' : risco >= 0.5 ? 'text-amber-500' : 'text-blue-500';
  const sinais: string[] = lead.sinais ?? [];

  return (
    <div className="group bg-white rounded-2xl border border-gray-200 p-5 shadow-soft hover:border-ford-blue hover:shadow-card transition">
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg tabular ${textColor} bg-gray-50`}>
          #{rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <Link href={`/clientes/${lead.id}`}
                className="font-bold text-charcoal hover:text-ford-blue transition truncate block">
                {lead.nome_cliente ?? `VIN ${String(lead.vin_hash).slice(0, 10)}…`}
              </Link>
              <p className="text-sm text-slate mt-0.5 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Car className="w-3 h-3" /> {lead.model_name} {lead.model_year}
                </span>
                {lead.dealer_code_venda && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Dealer {lead.dealer_code_venda}
                  </span>
                )}
                {lead.num_revisoes != null && (
                  <span className="inline-flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> {lead.num_revisoes} revisão{lead.num_revisoes === 1 ? '' : 'ões'}
                  </span>
                )}
              </p>
            </div>
            <PerfilBadge perfil={lead.perfil_real} />
          </div>

          {/* Barra de risco */}
          <div className="bg-gray-100 h-2 rounded-full overflow-hidden mb-2">
            <div className={`${bg} h-full rounded-full transition-all`} style={{ width: `${risco * 100}%` }} />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className={`text-xs font-bold ${textColor} uppercase tracking-wider tabular`}>
              Risco composto: {Math.round(risco * 100)}%
            </div>
            <LinkButton href={`/clientes/${lead.id}`} variant="primary" size="sm" iconRight={ChevronRight} uppercase>
              Abrir ficha
            </LinkButton>
          </div>

          {/* Sinais — POR QUE este lead está aqui */}
          {sinais.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Sinais detectados:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sinais.map(s => {
                  const meta = SINAL_META[s];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <span key={s} title={meta.description}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${meta.color}`}>
                      <Icon className="w-2.5 h-2.5" />
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
