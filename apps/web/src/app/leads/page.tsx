'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Flame } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import { api } from '@/lib/api';

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listLeads(0.4).then(setLeads).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-ford-blue">Leads priorizados</h1>
            <p className="text-gray-600 mt-1">Clientes em risco, ordenados por probabilidade de evasão</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Flame className="w-4 h-4 text-danger" />
            {leads.length} leads ativos
          </div>
        </div>

        {loading && <div className="text-center py-16 text-gray-500">Carregando…</div>}

        {!loading && leads.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-300 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Carteira saudável!</h2>
            <p className="text-gray-600">Nenhum cliente em alto risco no momento.</p>
          </div>
        )}

        <div className="space-y-3">
          {leads.map((l: any, i: number) => {
            const c = l.clients;
            const color =
              l.risco_evasao > 0.7 ? 'bg-danger'
              : l.risco_evasao > 0.5 ? 'bg-warning' : 'bg-gray-400';
            const textColor =
              l.risco_evasao > 0.7 ? 'text-danger'
              : l.risco_evasao > 0.5 ? 'text-warning' : 'text-gray-600';
            return (
              <Link key={l.id} href={`/clientes/${c.id}`}
                className="block bg-white rounded-2xl border border-gray-300 p-5 hover:border-ford-blue hover:shadow-md transition">
                <div className="flex items-start gap-4">
                  <div className="text-3xl font-black text-gray-300 w-12">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <h3 className="font-bold text-gray-900 truncate">
                        {c.nome_cliente ?? `Cliente ${c.id.slice(0, 8)}`}
                      </h3>
                      <PerfilBadge perfil={l.perfil_predito} />
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {c.modelo_comprado} {c.versao_comprada} · comprou {new Date(c.data_compra).toLocaleDateString('pt-BR')}
                    </p>
                    <div className="bg-gray-100 h-2 rounded-full overflow-hidden mb-2">
                      <div className={color + ' h-full rounded-full transition-all'} style={{ width: `${l.risco_evasao * 100}%` }} />
                    </div>
                    <div className={`text-xs font-bold ${textColor} uppercase tracking-wider`}>
                      Risco de evasão: {Math.round(l.risco_evasao * 100)}% · Confiança {Math.round(l.confianca * 100)}%
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
