'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, AlertTriangle, TrendingUp, Users, Activity, ArrowUpRight,
  Sparkles, Megaphone, Target, Car,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import { api } from '@/lib/api';

const PERFIS = ['fiel', 'esquecido', 'economico', 'abandono'] as const;
const PERFIL_COLOR: Record<string, string> = {
  fiel: 'bg-emerald-500', esquecido: 'bg-amber-500', economico: 'bg-blue-500', abandono: 'bg-rose-500',
};

export default function Carteira() {
  const [metrics, setMetrics] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [acoesKpis, setAcoesKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.metrics(), api.listClients(), api.acoesKpis().catch(() => null)])
      .then(([m, c, k]) => { setMetrics(m); setClients(c.results); setAcoesKpis(k); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalPerfil = metrics ? PERFIS.reduce((s, p) => s + (metrics.perfil_counts?.[p] ?? 0), 0) : 0;

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-charcoal">Carteira</h1>
            <p className="text-slate mt-1">Visão consolidada da concessionária — VIN Share, perfis e ações.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/acoes"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-charcoal rounded-xl text-sm font-bold hover:border-ford-blue hover:text-ford-blue transition">
              <Megaphone className="w-4 h-4" /> Ver ações
            </Link>
            <Link href="/clientes/novo"
              className="inline-flex items-center gap-2 px-5 py-3 bg-ford-blue text-white font-bold rounded-2xl shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition uppercase tracking-wider text-sm">
              <Plus className="w-4 h-4" /> Novo cliente
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate">Carregando…</div>
        ) : (
          <>
            {/* KPIs principais (4 cards de destaque) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <KpiHero
                icon={Target} label="VIN Share"
                value={`${Math.round((metrics?.vin_share_estimado ?? 0) * 100)}%`}
                accent="from-ford-blue to-ford-blue-light"
                sub={`${metrics?.clientes_ativos ?? 0} ativos na rede`}
              />
              <KpiHero
                icon={Users} label="Total clientes"
                value={metrics?.total_clientes ?? 0}
                accent="from-slate-700 to-slate-900"
                sub="na sua carteira"
              />
              <KpiHero
                icon={AlertTriangle} label="Alto risco"
                value={metrics?.alto_risco_count ?? 0}
                accent="from-rose-500 to-rose-700"
                sub="precisam ação esta semana"
              />
              <KpiHero
                icon={TrendingUp} label="Aderência revisões"
                value={`${Math.round((metrics?.taxa_aderencia_revisoes ?? 0) * 100)}%`}
                accent="from-emerald-500 to-emerald-700"
                sub="realizadas vs esperadas"
              />
            </div>

            {/* Insights secundários (ações) */}
            {acoesKpis && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <SubKpi icon={Megaphone} label="Ações registradas" value={acoesKpis.total ?? 0} />
                <SubKpi icon={Activity} label="Taxa de conclusão" value={`${Math.round((acoesKpis.taxa_conclusao ?? 0) * 100)}%`} />
                <SubKpi icon={Sparkles} label="Taxa de sucesso" value={`${Math.round((acoesKpis.taxa_sucesso ?? 0) * 100)}%`} accent="emerald" />
              </div>
            )}

            {/* Distribuição por perfil — visual com barras horizontais */}
            <Card title="Distribuição por perfil comportamental" className="mb-6">
              {totalPerfil === 0 ? (
                <div className="text-center py-6 text-slate text-sm">
                  Nenhuma classificação ainda. Cadastre clientes em <Link href="/clientes/novo" className="text-ford-blue hover:underline">Novo cliente</Link>.
                </div>
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
                            {count} <span className="text-gray-400 font-normal">({pct.toFixed(0)}%)</span>
                          </div>
                        </div>
                        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className={`h-full ${PERFIL_COLOR[p]} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Por modelo */}
            {metrics?.por_modelo && Object.keys(metrics.por_modelo).length > 0 && (
              <Card title="Vendas por modelo" className="mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(metrics.por_modelo)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .slice(0, 8)
                    .map(([modelo, count]: any) => (
                      <div key={modelo} className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
                        <Car className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate truncate">{modelo}</div>
                          <div className="text-xl font-bold text-charcoal tabular">{count}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {/* Lista de clientes recentes */}
            <Card title={`Clientes recentes (${clients.length})`}>
              {clients.length === 0 ? (
                <div className="text-center py-12 text-slate">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p>Nenhum cliente ainda.</p>
                  <Link href="/clientes/novo" className="text-ford-blue hover:underline mt-3 inline-block text-sm">
                    Cadastrar primeira venda →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {clients.slice(0, 20).map((c: any) => {
                    const p = c.predictions?.[0];
                    return (
                      <Link key={c.id} href={`/clientes/${c.id}`}
                        className="group flex items-center gap-4 py-4 -mx-6 px-6 hover:bg-ford-blue-soft/30 transition">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-charcoal truncate">
                            {c.nome_cliente ?? `Cliente ${c.id.slice(0, 8)}`}
                          </div>
                          <div className="text-sm text-slate truncate">
                            {c.modelo_comprado} {c.versao_comprada} · R$ {c.preco_pago_brl.toLocaleString('pt-BR')} · {c.financiamento}{c.parcelas > 0 ? ` ${c.parcelas}x` : ''}
                          </div>
                        </div>
                        {p && (
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Risco</div>
                              <div className={`text-lg font-bold tabular ${p.risco_evasao > 0.6 ? 'text-rose-500' : p.risco_evasao > 0.3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {Math.round(p.risco_evasao * 100)}%
                              </div>
                            </div>
                            <PerfilBadge perfil={p.perfil_predito} />
                          </div>
                        )}
                        <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-ford-blue transition flex-shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}

function KpiHero({ icon: Icon, label, value, accent, sub }: { icon: any; label: string; value: any; accent: string; sub?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${accent} shadow-card`}>
      <div className="absolute -top-6 -right-6 opacity-10">
        <Icon className="w-24 h-24" />
      </div>
      <Icon className="w-5 h-5 opacity-70 mb-3" />
      <div className="text-3xl font-black tabular">{value}</div>
      <div className="text-[11px] uppercase tracking-wider opacity-80 mt-1">{label}</div>
      {sub && <div className="text-[10px] opacity-60 mt-1.5">{sub}</div>}
    </div>
  );
}

function SubKpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: 'emerald' }) {
  const color = accent === 'emerald' ? 'text-emerald-600' : 'text-ford-blue';
  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4 shadow-soft">
      <div className="w-10 h-10 rounded-xl bg-ford-blue-soft/50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-ford-blue" />
      </div>
      <div>
        <div className={`text-2xl font-black tabular ${color}`}>{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-6 shadow-soft ${className}`}>
      {title && <h2 className="text-lg font-bold text-charcoal mb-5">{title}</h2>}
      {children}
    </div>
  );
}
