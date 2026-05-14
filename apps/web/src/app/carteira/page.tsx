'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, AlertTriangle, TrendingUp, Users, Activity } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import { api } from '@/lib/api';

export default function Carteira() {
  const [metrics, setMetrics] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.metrics(), api.listClients()])
      .then(([m, c]) => { setMetrics(m); setClients(c.results); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-ford-blue">Carteira</h1>
            <p className="text-gray-600 mt-1">Visão geral da concessionária + clientes ativos</p>
          </div>
          <Link href="/clientes/novo" className="inline-flex items-center gap-2 px-5 py-3 bg-ford-blue text-white font-medium rounded-2xl hover:bg-ford-blue-dark transition">
            <Plus className="w-4 h-4" /> Novo cliente
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Carregando…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Kpi icon={Activity} label="VIN Share" value={`${Math.round((metrics?.vin_share_estimado ?? 0) * 100)}%`} color="text-success" />
              <Kpi icon={Users} label="Total clientes" value={metrics?.total_clientes ?? 0} />
              <Kpi icon={AlertTriangle} label="Alto risco" value={metrics?.alto_risco_count ?? 0} color="text-danger" />
              <Kpi icon={TrendingUp} label="Aderência revisões" value={`${Math.round((metrics?.taxa_aderencia_revisoes ?? 0) * 100)}%`} />
            </div>

            <Card title="Distribuição por perfil" className="mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['fiel','abandono','esquecido','economico'] as const).map(p => (
                  <div key={p} className="text-center">
                    <div className="text-4xl font-black text-ford-blue mb-2">{metrics?.perfil_counts?.[p] ?? 0}</div>
                    <PerfilBadge perfil={p} />
                  </div>
                ))}
              </div>
            </Card>

            <Card title={`Clientes recentes (${clients.length})`}>
              {clients.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Nenhum cliente ainda.<br />
                  <Link href="/clientes/novo" className="text-ford-blue hover:underline mt-3 inline-block">Cadastrar primeira venda →</Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {clients.slice(0, 20).map((c: any) => (
                    <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center gap-4 py-4 hover:bg-gray-50 -mx-6 px-6 transition">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          {c.nome_cliente ?? `Cliente ${c.id.slice(0, 8)}`}
                        </div>
                        <div className="text-sm text-gray-600">
                          {c.modelo_comprado} {c.versao_comprada} · R$ {c.preco_pago_brl.toLocaleString('pt-BR')} · {c.financiamento} {c.parcelas}x
                        </div>
                      </div>
                      {c.predictions?.[0] && (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Risco</div>
                            <div className={`text-lg font-bold ${c.predictions[0].risco_evasao > 0.6 ? 'text-danger' : c.predictions[0].risco_evasao > 0.3 ? 'text-warning' : 'text-success'}`}>
                              {Math.round(c.predictions[0].risco_evasao * 100)}%
                            </div>
                          </div>
                          <PerfilBadge perfil={c.predictions[0].perfil_predito} />
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </Shell>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-300 p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <div className={`text-3xl font-black ${color ?? 'text-ford-blue'}`}>{value}</div>
      <div className="text-xs uppercase tracking-wider text-gray-600 mt-1">{label}</div>
    </div>
  );
}

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-300 p-6 ${className}`}>
      {title && <h2 className="text-lg font-bold text-gray-900 mb-5">{title}</h2>}
      {children}
    </div>
  );
}
