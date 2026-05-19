'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle, Flame, Filter, Phone, MessageCircle, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import { api } from '@/lib/api';

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minRisk, setMinRisk] = useState(0.4);
  const [perfilFilter, setPerfilFilter] = useState<string>('');

  async function load() {
    setLoading(true);
    try {
      const r = await api.listLeads(minRisk);
      setLeads(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [minRisk]);

  const filtered = perfilFilter
    ? leads.filter(l => l.perfil_predito === perfilFilter)
    : leads;

  const altoRiscoCount = leads.filter(l => l.risco_evasao >= 0.7).length;
  const medioRiscoCount = leads.filter(l => l.risco_evasao >= 0.5 && l.risco_evasao < 0.7).length;

  return (
    <Shell>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-charcoal">Leads priorizados</h1>
            <p className="text-slate mt-1">Clientes em risco de evasão, ordenados por probabilidade.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Flame className="w-4 h-4 text-rose-500" />
              <span className="font-bold text-charcoal">{filtered.length}</span>
              <span className="text-slate">leads ativos</span>
            </div>
          </div>
        </div>

        {/* Resumo de risco */}
        {!loading && leads.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <RiscoCard color="bg-rose-500" label="≥ 70%" count={altoRiscoCount} desc="Ação no mesmo dia" />
            <RiscoCard color="bg-amber-500" label="50-69%" count={medioRiscoCount} desc="Ação em 48h" />
            <RiscoCard color="bg-blue-500" label="40-49%" count={leads.length - altoRiscoCount - medioRiscoCount} desc="Acompanhar semanal" />
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap shadow-soft">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-wider text-gray-600 font-bold">Risco min:</label>
            <select value={minRisk} onChange={e => setMinRisk(Number(e.target.value))}
              className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
              <option value={0.4}>40%</option>
              <option value={0.5}>50%</option>
              <option value={0.6}>60%</option>
              <option value={0.7}>70%</option>
              <option value={0.8}>80%</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-wider text-gray-600 font-bold">Perfil:</label>
            <select value={perfilFilter} onChange={e => setPerfilFilter(e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
              <option value="">Todos</option>
              <option value="abandono">Abandono</option>
              <option value="esquecido">Esquecido</option>
              <option value="economico">Econômico</option>
            </select>
          </div>
          {perfilFilter && (
            <button onClick={() => setPerfilFilter('')} className="text-xs text-ford-blue hover:underline">Limpar</button>
          )}
        </div>

        {loading && <div className="text-center py-16 text-slate">Carregando…</div>}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-soft">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-charcoal mb-2">Carteira saudável!</h2>
            <p className="text-slate">Nenhum cliente em risco nesse filtro no momento.</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((l: any, i: number) => {
            const c = l.clients;
            const bg =
              l.risco_evasao >= 0.7 ? 'bg-rose-500'
              : l.risco_evasao >= 0.5 ? 'bg-amber-500' : 'bg-blue-500';
            const textColor =
              l.risco_evasao >= 0.7 ? 'text-rose-500'
              : l.risco_evasao >= 0.5 ? 'text-amber-500' : 'text-blue-500';
            return (
              <div key={l.id} className="group bg-white rounded-2xl border border-gray-200 p-5 hover:border-ford-blue hover:shadow-card transition shadow-soft">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg tabular ${textColor} bg-gray-50`}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <Link href={`/clientes/${c.id}`}
                          className="font-bold text-charcoal hover:text-ford-blue transition truncate block">
                          {c.nome_cliente ?? `Cliente ${c.id.slice(0, 8)}`}
                        </Link>
                        <p className="text-sm text-slate mt-0.5">
                          {c.modelo_comprado} {c.versao_comprada}
                          {c.data_compra && <span> · comprou {new Date(c.data_compra).toLocaleDateString('pt-BR')}</span>}
                        </p>
                      </div>
                      <PerfilBadge perfil={l.perfil_predito} />
                    </div>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden mb-2">
                      <div className={`${bg} h-full rounded-full transition-all`} style={{ width: `${l.risco_evasao * 100}%` }} />
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className={`text-xs font-bold ${textColor} uppercase tracking-wider tabular`}>
                        Risco {Math.round(l.risco_evasao * 100)}% · confiança {Math.round(l.confianca * 100)}%
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/clientes/${c.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-ford-blue text-white rounded-lg hover:bg-ford-blue-dark font-bold uppercase tracking-wider">
                          Abrir ficha
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dica */}
        {!loading && leads.length > 0 && (
          <div className="mt-8 bg-ford-blue-soft/30 border border-ford-blue/15 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-ford-blue flex-shrink-0 mt-0.5" />
            <p className="text-xs text-charcoal leading-relaxed">
              <b>Como usar:</b> abra a ficha do cliente, registre a ação tomada (ligação, WhatsApp, oferta…)
              e o desfecho. Isso alimenta o histórico em <Link href="/acoes" className="text-ford-blue underline">/acoes</Link>
              {' '}e calibra o modelo no próximo treino.
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}

function RiscoCard({ color, label, count, desc }: { color: string; label: string; count: number; desc: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-soft">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-xs uppercase tracking-wider text-gray-500 font-bold">{label}</span>
      </div>
      <div className="text-3xl font-black text-charcoal tabular">{count}</div>
      <div className="text-[10px] text-slate mt-1">{desc}</div>
    </div>
  );
}
