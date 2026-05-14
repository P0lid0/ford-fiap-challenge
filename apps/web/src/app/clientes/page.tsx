'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import { api } from '@/lib/api';

export default function Clientes() {
  const [clients, setClients] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listClients().then(r => setClients(r.results)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const visible = filter
    ? clients.filter(c => (c.nome_cliente ?? '').toLowerCase().includes(filter.toLowerCase()) || c.modelo_comprado.toLowerCase().includes(filter.toLowerCase()))
    : clients;

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-ford-blue">Clientes</h1>
            <p className="text-gray-600 mt-1">{clients.length} clientes na carteira</p>
          </div>
          <Link href="/clientes/novo" className="inline-flex items-center gap-2 px-5 py-3 bg-ford-blue text-white font-medium rounded-2xl hover:bg-ford-blue-dark transition">
            <Plus className="w-4 h-4" /> Novo cliente
          </Link>
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" placeholder="Filtrar por nome ou modelo..." value={filter} onChange={e => setFilter(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue transition" />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Carregando…</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-300 overflow-hidden">
            {visible.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Nenhum cliente encontrado.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {visible.map((c: any) => (
                  <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{c.nome_cliente ?? `Cliente ${c.id.slice(0, 8)}`}</div>
                      <div className="text-sm text-gray-600">
                        {c.modelo_comprado} {c.versao_comprada} · {c.idade} anos · {c.regiao}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-500 text-xs uppercase">Pago</div>
                      <div className="font-bold text-gray-900">R$ {(c.preco_pago_brl / 1000).toFixed(0)}k</div>
                    </div>
                    {c.predictions?.[0] && <PerfilBadge perfil={c.predictions[0].perfil_predito} />}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
