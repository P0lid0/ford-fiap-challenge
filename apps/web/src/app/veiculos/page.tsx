'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search, GitCompare, Loader2, Sparkles, Eye, Plus } from 'lucide-react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { BrandCombo } from '@/components/BrandCombo';
import { ConfianceBadge } from '@/components/SourceBadge';
import { SearchWizard } from '@/components/SearchWizard';
import { api } from '@/lib/api';

export default function Veiculos() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // estado da busca/ingestão
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchForm, setSearchForm] = useState({ marca: '', modelo: '', versao: '', ano: 2024 });
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setVehicles(await api.listVehicles()); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

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

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchForm.marca || !searchForm.modelo) return;
    setSearching(true); setSearchErr(null);
    try {
      const r = await api.searchVehicle({
        marca: searchForm.marca.trim(),
        modelo: searchForm.modelo.trim(),
        versao: searchForm.versao.trim() || undefined,
        ano: searchForm.ano || undefined,
      });
      // Adiciona no topo (ou substitui se já estava)
      setVehicles(vs => [r.vehicle, ...vs.filter((v: any) => v.id !== r.vehicle.id)]);
      setSearchForm({ marca: '', modelo: '', versao: '', ano: 2024 });
      setSearchOpen(false);
    } catch (e: any) {
      setSearchErr(e.message ?? String(e));
    } finally {
      setSearching(false);
    }
  }

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto pb-32">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-ford-blue">Inteligência Competitiva</h1>
            <p className="text-gray-600 mt-1">
              Busca em FIPE oficial + site da fabricante + IA · selecione 2-5 para comparar
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/veiculos/adicionar"
              className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-800 font-medium rounded-2xl hover:border-ford-blue hover:text-ford-blue transition">
              <Plus className="w-4 h-4" /> Adicionar manual
            </Link>
            <button onClick={() => setSearchOpen(s => !s)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-ford-blue text-white font-medium rounded-2xl hover:bg-ford-blue-dark transition">
              <Search className="w-4 h-4" /> Buscar carro
            </button>
          </div>
        </div>

        {searchOpen && (
          <SearchWizard
            onComplete={(v) => {
              setVehicles(vs => [v, ...vs.filter((x: any) => x.id !== v.id)]);
              setSearchOpen(false);
            }}
            onCancel={() => setSearchOpen(false)}
          />
        )}

        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" placeholder="Filtrar lista... (após buscar acima)" value={query} onChange={e => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue transition" />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Carregando…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((v: any) => {
              const sel = selected.includes(v.id);
              return (
                <div key={v.id}
                  className={`bg-white rounded-2xl border-2 p-5 transition relative ${
                    sel ? 'border-ford-blue ring-4 ring-ford-blue/10' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                  <button onClick={() => toggle(v.id)} className="absolute inset-0 z-0" aria-label="Selecionar para comparar" />
                  {sel && (
                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-ford-blue text-white flex items-center justify-center z-10">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                  <div className="relative z-10 pointer-events-none">
                    <div className="text-xs uppercase tracking-wider text-gray-600">{v.marca}</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">{v.modelo} {v.versao}</div>
                    <div className="text-sm text-gray-500 mb-3">{v.ano}</div>
                    {v.confianca_geral && (
                      <div className="mb-3">
                        <ConfianceBadge confianca={v.confianca_geral} />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-gray-100">
                      <Spec label="Potência" value={v.motor?.potencia_cv ? `${v.motor.potencia_cv} cv` : '—'} />
                      <Spec label="Torque" value={v.motor?.torque_nm ? `${v.motor.torque_nm} Nm` : '—'} />
                      <Spec label="0-100" value={v.desempenho?.aceleracao_0_100_s ? `${v.desempenho.aceleracao_0_100_s}s` : '—'} />
                      <Spec label="Preço FIPE" value={v.preco_brl ? `R$ ${(v.preco_brl/1000).toFixed(0)}k` : '—'} />
                    </div>
                  </div>
                  <Link href={`/veiculos/${v.id}`} onClick={e => e.stopPropagation()}
                    className="relative z-20 mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-ford-blue hover:underline">
                    <Eye className="w-3.5 h-3.5" /> Ver detalhes / editar
                  </Link>
                </div>
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
