'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Check, Search, GitCompare, Plus, Eye, ChevronDown, ChevronUp,
  Car, Truck, ShoppingCart, X, SlidersHorizontal, ArrowUpDown,
  Layers, Grid3x3, Sparkles, Fuel, Gauge,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ConfianceBadge } from '@/components/SourceBadge';
import { SearchWizard } from '@/components/SearchWizard';
import { api } from '@/lib/api';

const CATEGORIA_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  hatch:            { label: 'Hatch',          icon: Car,          color: 'bg-blue-50 text-blue-700 border-blue-200' },
  sedan:            { label: 'Sedan',          icon: Car,          color: 'bg-purple-50 text-purple-700 border-purple-200' },
  suv:              { label: 'SUV',            icon: Car,          color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  picape_compacta:  { label: 'Picape compacta', icon: Truck,       color: 'bg-amber-50 text-amber-700 border-amber-200' },
  picape_media:     { label: 'Picape média',    icon: Truck,       color: 'bg-orange-50 text-orange-700 border-orange-200' },
  picape_grande:    { label: 'Picape grande',   icon: Truck,       color: 'bg-red-50 text-red-700 border-red-200' },
  minivan:          { label: 'Minivan',         icon: Car,         color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  cupe:             { label: 'Cupê',            icon: Car,         color: 'bg-pink-50 text-pink-700 border-pink-200' },
  conversivel:      { label: 'Conversível',     icon: Car,         color: 'bg-rose-50 text-rose-700 border-rose-200' },
  comercial:        { label: 'Comercial',       icon: ShoppingCart, color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

type GroupBy = 'marca' | 'categoria' | 'nenhum';
type SortBy = 'marca' | 'preco_asc' | 'preco_desc' | 'potencia' | 'recente';

export default function Veiculos() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  // Filtros
  const [query, setQuery] = useState('');
  const [marcaFilter, setMarcaFilter] = useState<string>('');
  const [catFilter, setCatFilter] = useState<string[]>([]);
  const [confiancaFilter, setConfiancaFilter] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('marca');
  const [sortBy, setSortBy] = useState<SortBy>('marca');
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Seleção pra comparar
  const [selected, setSelected] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try { setVehicles(await api.listVehicles()); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function toggleSel(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 5 ? s : [...s, id]);
  }
  function toggleCollapse(key: string) {
    setCollapsed(s => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Estatísticas + opções de filtro
  const stats = useMemo(() => {
    const marcas = new Set<string>();
    const cats = new Map<string, number>();
    for (const v of vehicles) {
      marcas.add(v.marca);
      cats.set(v.categoria, (cats.get(v.categoria) ?? 0) + 1);
    }
    return {
      total: vehicles.length,
      marcas: marcas.size,
      cats: cats.size,
      catCounts: Object.fromEntries(cats),
      marcasList: [...marcas].sort(),
    };
  }, [vehicles]);

  // Pipeline: filtrar → ordenar → agrupar
  const filtered = useMemo(() => {
    let r = [...vehicles];
    if (query) {
      const q = query.toLowerCase();
      r = r.filter(v => `${v.marca} ${v.modelo} ${v.versao}`.toLowerCase().includes(q));
    }
    if (marcaFilter) r = r.filter(v => v.marca === marcaFilter);
    if (catFilter.length) r = r.filter(v => catFilter.includes(v.categoria));
    if (confiancaFilter.length) r = r.filter(v => confiancaFilter.includes(v.confianca_geral ?? 'baixa'));

    r.sort((a, b) => {
      switch (sortBy) {
        case 'preco_asc':  return (a.preco_brl ?? Infinity) - (b.preco_brl ?? Infinity);
        case 'preco_desc': return (b.preco_brl ?? 0) - (a.preco_brl ?? 0);
        case 'potencia':   return (b.motor?.potencia_cv ?? 0) - (a.motor?.potencia_cv ?? 0);
        case 'recente':    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        default:           return `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`);
      }
    });
    return r;
  }, [vehicles, query, marcaFilter, catFilter, confiancaFilter, sortBy]);

  const groups = useMemo(() => {
    if (groupBy === 'nenhum') return [{ key: 'todos', label: `${filtered.length} veículos`, items: filtered }];
    const map = new Map<string, any[]>();
    for (const v of filtered) {
      const key = groupBy === 'marca' ? v.marca : v.categoria;
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    return [...map.entries()]
      .map(([key, items]) => ({ key, label: groupBy === 'categoria' ? (CATEGORIA_LABELS[key]?.label ?? key) : key, items }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, groupBy]);

  const catsDisponiveis = Object.keys(stats.catCounts).sort();

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ford-blue">Catálogo competitivo</h1>
            <p className="text-gray-600 mt-1">
              <strong>{stats.total}</strong> veículos · <strong>{stats.marcas}</strong> marcas · <strong>{stats.cats}</strong> categorias
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

        {/* Wizard */}
        {searchOpen && (
          <SearchWizard
            onComplete={async (v) => {
              await load();
              setSearchOpen(false);
            }}
            onCancel={() => setSearchOpen(false)}
          />
        )}

        {/* Categoria chips quick filter */}
        {catsDisponiveis.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setCatFilter([])}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition border ${
                catFilter.length === 0 ? 'bg-ford-blue text-white border-ford-blue' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
              }`}>
              <Layers className="w-3.5 h-3.5" /> Todas ({stats.total})
            </button>
            {catsDisponiveis.map(cat => {
              const info = CATEGORIA_LABELS[cat] ?? { label: cat, icon: Car, color: '' };
              const Icon = info.icon;
              const sel = catFilter.includes(cat);
              return (
                <button key={cat}
                  onClick={() => setCatFilter(s => sel ? s.filter(c => c !== cat) : [...s, cat])}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition border ${
                    sel ? 'bg-ford-blue text-white border-ford-blue' : `${info.color} hover:border-current`
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {info.label} ({stats.catCounts[cat]})
                </button>
              );
            })}
          </div>
        )}

        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-gray-50 -mx-8 px-8 py-3 mb-4 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="search" placeholder="Buscar por marca, modelo, versão…" value={query} onChange={e => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue transition text-sm" />
            </div>
            <select value={marcaFilter} onChange={e => setMarcaFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-ford-blue">
              <option value="">Todas as marcas</option>
              {stats.marcasList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="relative inline-block">
              <ArrowUpDown className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
                className="pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm appearance-none focus:outline-none focus:border-ford-blue">
                <option value="marca">Marca A-Z</option>
                <option value="preco_asc">Preço ↑</option>
                <option value="preco_desc">Preço ↓</option>
                <option value="potencia">Potência</option>
                <option value="recente">Recém adicionados</option>
              </select>
            </div>
            <div className="inline-flex border border-gray-300 rounded-xl overflow-hidden bg-white">
              {(['marca', 'categoria', 'nenhum'] as GroupBy[]).map(g => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`px-3 py-2 text-sm transition ${groupBy === g ? 'bg-ford-blue text-white' : 'hover:bg-gray-50'}`}>
                  {g === 'marca' ? 'Agrupar marca' : g === 'categoria' ? 'Agrupar tipo' : 'Sem grupo'}
                </button>
              ))}
            </div>
            {(query || marcaFilter || catFilter.length > 0 || confiancaFilter.length > 0) && (
              <button onClick={() => { setQuery(''); setMarcaFilter(''); setCatFilter([]); setConfiancaFilter([]); }}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-red-600 transition">
                <X className="w-4 h-4" /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Resultados */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-300 p-12 text-center">
            <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900">Nenhum veículo encontrado</h2>
            <p className="text-gray-600 mt-1">Ajuste os filtros ou busque um carro novo.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(({ key, label, items }) => {
              const isCollapsed = collapsed.has(key);
              return (
                <section key={key}>
                  {groupBy !== 'nenhum' && (
                    <button onClick={() => toggleCollapse(key)}
                      className="w-full flex items-center justify-between mb-3 group">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black text-ford-blue uppercase tracking-tight">{label}</h2>
                        <span className="px-2.5 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-bold">{items.length}</span>
                      </div>
                      {isCollapsed ? <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-ford-blue transition" />
                        : <ChevronUp className="w-5 h-5 text-gray-500 group-hover:text-ford-blue transition" />}
                    </button>
                  )}
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map(v => <VehicleCard key={v.id} v={v} sel={selected.includes(v.id)} onToggle={toggleSel} />)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Comparison bar (sticky bottom) */}
        {selected.length >= 2 && (
          <div className="fixed bottom-6 left-72 right-6 z-20">
            <button onClick={() => router.push(`/veiculos/comparar?ids=${selected.join(',')}`)}
              className="w-full max-w-xl mx-auto flex items-center justify-center gap-3 py-4 bg-ford-blue text-white font-bold rounded-2xl shadow-2xl hover:bg-ford-blue-dark transition uppercase tracking-wider text-sm">
              <GitCompare className="w-5 h-5" /> Comparar {selected.length} veículos
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function VehicleCard({ v, sel, onToggle }: { v: any; sel: boolean; onToggle: (id: string) => void }) {
  const catInfo = CATEGORIA_LABELS[v.categoria] ?? { label: v.categoria, icon: Car, color: 'bg-gray-50 text-gray-700' };

  return (
    <div className={`group bg-white rounded-2xl border-2 transition relative overflow-hidden ${
      sel ? 'border-ford-blue ring-4 ring-ford-blue/10' : 'border-gray-300 hover:border-ford-blue hover:shadow-md'
    }`}>
      {sel && (
        <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-ford-blue text-white flex items-center justify-center z-10">
          <Check className="w-4 h-4" />
        </div>
      )}
      <button onClick={() => onToggle(v.id)} className="absolute inset-0 z-0" aria-label="Selecionar para comparar" />

      <div className="relative z-10 p-5 pointer-events-none">
        {/* Header: marca + categoria */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500">{v.marca}</div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${catInfo.color}`}>
            {catInfo.label}
          </span>
        </div>

        {/* Modelo + ano */}
        <h3 className="text-lg font-bold text-gray-900 leading-tight truncate" title={`${v.modelo} ${v.versao}`}>
          {v.modelo} {v.versao}
        </h3>
        <div className="text-sm text-gray-500 mb-3">{v.ano}</div>

        {/* Preço destaque */}
        {v.preco_brl ? (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <div className="text-2xl font-black text-ford-blue leading-none">
              R$ {(v.preco_brl).toLocaleString('pt-BR')}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">
              {v.fipe_codigo ? `FIPE oficial · ${v.fipe_mes_referencia ?? ''}` : 'sem FIPE'}
            </div>
          </div>
        ) : (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <div className="text-sm text-gray-400">Preço não disponível</div>
          </div>
        )}

        {/* Specs em chips */}
        <div className="flex flex-wrap gap-2 text-xs mb-3">
          {v.motor?.potencia_cv && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md">
              <Gauge className="w-3 h-3 text-gray-500" />
              <span className="font-bold">{v.motor.potencia_cv}</span> cv
            </span>
          )}
          {v.motor?.torque_nm && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md">
              <span className="font-bold">{v.motor.torque_nm}</span> Nm
            </span>
          )}
          {v.desempenho?.aceleracao_0_100_s && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md">
              <Sparkles className="w-3 h-3 text-gray-500" />
              <span className="font-bold">{v.desempenho.aceleracao_0_100_s}</span>s
            </span>
          )}
          {v.motor?.combustivel && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md">
              <Fuel className="w-3 h-3 text-gray-500" />
              {v.motor.combustivel}
            </span>
          )}
        </div>

        {/* Confiança + traction */}
        <div className="flex flex-wrap items-center gap-2">
          {v.confianca_geral && <ConfianceBadge confianca={v.confianca_geral} />}
          {v.transmissao?.tracao && (
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{v.transmissao.tracao}</span>
          )}
        </div>
      </div>

      {/* Botão Ver detalhes (z-20 para escapar do botão de seleção) */}
      <Link href={`/veiculos/${v.id}`} onClick={e => e.stopPropagation()}
        className="relative z-20 block bg-gray-50 px-5 py-3 text-sm font-medium text-ford-blue hover:bg-ford-blue hover:text-white transition border-t border-gray-100 flex items-center justify-center gap-1.5">
        <Eye className="w-3.5 h-3.5" /> Ver detalhes / editar
      </Link>
    </div>
  );
}
