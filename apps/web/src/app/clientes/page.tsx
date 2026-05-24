'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, Database, ArrowUpRight, Car, Wrench, Building2,
  AlertTriangle, Users,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import {
  Card, PageHeader, EmptyState, LoadingState, LinkButton,
} from '@/components/ui';
import { api } from '@/lib/api';

const PERFIS = ['fiel', 'esquecido', 'economico', 'abandono'] as const;
const MODELS = [
  'RANGER', 'KA', 'ECOSPORT', 'TERRITORY', 'BRONCO SPORT', 'MAVERICK',
  'TRANSIT', 'F-150', 'MUSTANG', 'EDGE', 'MUSTANG MACH-E',
];

export default function Clientes() {
  const [clients, setClients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [perfilReal, setPerfilReal] = useState('');
  const [modelName, setModelName] = useState('');
  const [ordem, setOrdem] = useState<'recente' | 'risco'>('recente');
  const [origemFilter, setOrigemFilter] = useState<'todos' | 'ford' | 'manual'>('todos');

  async function load() {
    setLoading(true);
    try {
      const filters: any = { limit: 100 };
      if (perfilReal) filters.perfil_real = perfilReal;
      if (modelName) filters.model_name = modelName;
      if (origemFilter === 'ford') filters.is_ford_real = true;
      if (origemFilter === 'manual') filters.is_ford_real = false;
      if (search.trim()) filters.search = search.trim();
      const r = await api.listClients(filters);
      let results = r.results;
      if (ordem === 'risco') {
        results = results.slice().sort((a: any, b: any) =>
          (b.predictions?.[0]?.risco_evasao ?? 0) - (a.predictions?.[0]?.risco_evasao ?? 0));
      }
      setClients(results);
      setTotal(r.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [perfilReal, modelName, origemFilter, ordem]);
  useEffect(() => {
    const t = setTimeout(() => load(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search]);

  const fordCount = clients.filter(c => c.is_ford_real).length;
  const manualCount = clients.length - fordCount;

  return (
    <Shell>
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader
          eyebrow={<><Users className="w-3 h-3" /> Carteira</>}
          title="Clientes"
          description={
            <>
              <span className="font-bold text-ford-blue">{total.toLocaleString('pt-BR')}</span>{' '}
              clientes na base · <span className="text-emerald-700">{fordCount}</span> Ford real ·{' '}
              <span className="text-amber-700">{manualCount}</span> cadastros manuais
            </>
          }
          action={
            <LinkButton href="/clientes/novo" icon={Plus} size="lg" uppercase>
              Novo cliente
            </LinkButton>
          }
        />

        {/* Filtros */}
        <Card compact className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />

            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['todos', 'ford', 'manual'] as const).map(o => (
                <button key={o} onClick={() => setOrigemFilter(o)}
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                    origemFilter === o ? 'bg-ford-blue text-white' : 'text-slate hover:bg-gray-50'
                  }`}>
                  {o === 'todos' ? 'Todos' : o === 'ford' ? '🏢 Ford BR' : '✋ Manual'}
                </button>
              ))}
            </div>

            <SelectFilter label="Modelo" value={modelName}
              options={MODELS.map(m => ({ value: m, label: m }))}
              onChange={setModelName} />
            <SelectFilter label="Perfil" value={perfilReal}
              options={PERFIS.map(p => ({ value: p, label: p }))}
              onChange={setPerfilReal} />

            <div className="flex items-center gap-2 ml-auto">
              <span className="label">Ordem:</span>
              <select value={ordem} onChange={e => setOrdem(e.target.value as any)}
                className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
                <option value="recente">Mais recentes</option>
                <option value="risco">Maior risco</option>
              </select>
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="search" placeholder="Buscar por nome ou VIN_Hash (prefixo)…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
          </div>
        </Card>

        {loading ? (
          <LoadingState text="Carregando clientes…" />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Nenhum cliente encontrado"
            description="Tente afrouxar os filtros ou cadastrar um cliente novo."
            action={<LinkButton href="/clientes/novo" icon={Plus} size="sm">Novo cliente</LinkButton>}
          />
        ) : (
          <Card noPadding>
            <div className="divide-y divide-gray-100">
              {clients.map(c => <ClienteRow key={c.id} c={c} />)}
            </div>
          </Card>
        )}

        {/* Footer dica */}
        <div className="mt-6 bg-ford-blue-soft/40 border border-ford-blue/15 rounded-2xl p-4 text-xs text-charcoal flex items-start gap-3">
          <Database className="w-4 h-4 text-ford-blue flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <b>175.554 VINs reais Ford BR</b> ({clients.filter(c => c.is_ford_real).length} carregados na página)
            {' '}+ cadastros manuais. Clique em qualquer cliente pra ver histórico de revisões,
            fidelidade ao dealer e disparar reclassificação ML + IA.
          </div>
        </div>
      </div>
    </Shell>
  );
}

function SelectFilter({ label, value, options, onChange }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-ford-blue">
      <option value="">{label}: todos</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ClienteRow({ c }: { c: any }) {
  const pred = c.predictions?.[0];
  const risco = pred?.risco_evasao ?? 0;
  const riscoColor = risco > 0.6 ? 'text-rose-500' : risco > 0.3 ? 'text-amber-500' : 'text-emerald-500';

  return (
    <Link href={`/clientes/${c.id}`}
      className="group flex items-center gap-4 px-6 py-4 hover:bg-ford-blue-soft/30 transition">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        c.is_ford_real ? 'bg-ford-blue text-white' : 'bg-amber-100 text-amber-700'
      }`}>
        {c.is_ford_real ? <Database className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-charcoal truncate">
            {c.nome_cliente ?? (c.vin_hash ? `VIN ${String(c.vin_hash).slice(0, 10)}…` : `Cliente ${c.id.slice(0, 8)}`)}
          </span>
          {c.is_ford_real && (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold bg-ford-blue text-white px-1.5 py-0.5 rounded">
              <Database className="w-2.5 h-2.5" /> Ford real
            </span>
          )}
        </div>
        <div className="text-sm text-slate flex items-center gap-3 flex-wrap mt-0.5">
          <span className="inline-flex items-center gap-1">
            <Car className="w-3 h-3" /> {c.model_name ?? c.modelo_comprado} {c.model_year ?? ''}
          </span>
          {c.dealer_code_venda && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Dealer {c.dealer_code_venda}
            </span>
          )}
          {c.num_revisoes != null && (
            <span className="inline-flex items-center gap-1">
              <Wrench className="w-3 h-3" /> {c.num_revisoes} revisão{c.num_revisoes === 1 ? '' : 'ões'}
            </span>
          )}
          {c.sales_date && (
            <span className="text-gray-400">
              · vendido {new Date(c.sales_date).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {pred && (
        <div className="text-right hidden md:block">
          <div className="label">Risco</div>
          <div className={`text-base font-bold tabular ${riscoColor}`}>{Math.round(risco * 100)}%</div>
        </div>
      )}

      {c.perfil_real ? (
        <PerfilBadge perfil={c.perfil_real} />
      ) : pred ? (
        <PerfilBadge perfil={pred.perfil_predito} />
      ) : (
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Sem classificação</span>
      )}

      <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-ford-blue transition flex-shrink-0" />
    </Link>
  );
}
