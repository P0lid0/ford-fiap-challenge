'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search, GitCompare } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

export default function Veiculos() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listVehicles().then(setVehicles).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query) return vehicles;
    const q = query.toLowerCase();
    return vehicles.filter(v =>
      v.marca.toLowerCase().includes(q) ||
      v.modelo.toLowerCase().includes(q) ||
      v.versao.toLowerCase().includes(q),
    );
  }, [query, vehicles]);

  function toggle(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 5 ? s : [...s, id]);
  }

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto pb-32">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ford-blue">Inteligência Competitiva</h1>
          <p className="text-gray-600 mt-1">Catálogo de veículos · selecione 2 a 5 para comparar</p>
        </div>

        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" placeholder="Marca, modelo, versão..." value={query} onChange={e => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue transition" />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Carregando…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((v: any) => {
              const sel = selected.includes(v.id);
              return (
                <button key={v.id} onClick={() => toggle(v.id)}
                  className={`text-left bg-white rounded-2xl border-2 p-5 transition relative ${
                    sel ? 'border-ford-blue ring-4 ring-ford-blue/10' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                  {sel && (
                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-ford-blue text-white flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  <div className="text-xs uppercase tracking-wider text-gray-600">{v.marca}</div>
                  <div className="text-xl font-bold text-gray-900 mt-1">{v.modelo} {v.versao}</div>
                  <div className="text-sm text-gray-500 mb-4">{v.ano}</div>
                  <div className="grid grid-cols-2 gap-3 text-sm pt-4 border-t border-gray-100">
                    <Spec label="Potência" value={v.motor?.potencia_cv ? `${v.motor.potencia_cv} cv` : '—'} />
                    <Spec label="Torque" value={v.motor?.torque_nm ? `${v.motor.torque_nm} Nm` : '—'} />
                    <Spec label="0-100" value={v.desempenho?.aceleracao_0_100_s ? `${v.desempenho.aceleracao_0_100_s}s` : '—'} />
                    <Spec label="Preço" value={v.preco_brl ? `R$ ${(v.preco_brl/1000).toFixed(0)}k` : '—'} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selected.length >= 2 && (
          <div className="fixed bottom-6 left-72 right-6">
            <button onClick={() => router.push(`/veiculos/comparar?ids=${selected.join(',')}`)}
              className="w-full max-w-xl mx-auto flex items-center justify-center gap-3 py-4 bg-ford-blue text-white font-bold rounded-2xl shadow-lg hover:bg-ford-blue-dark transition uppercase tracking-wider text-sm">
              <GitCompare className="w-5 h-5" />
              Comparar {selected.length} veículos
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="font-bold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}
