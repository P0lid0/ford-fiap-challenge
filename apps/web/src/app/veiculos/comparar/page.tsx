'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy, Sparkles, Loader2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ConfianceBadge, SourceBadge } from '@/components/SourceBadge';
import { api } from '@/lib/api';

function ComparePage() {
  const search = useSearchParams();
  const ids = search.get('ids')?.split(',') ?? [];
  const [data, setData] = useState<any>(null);
  const [analise, setAnalise] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length < 2) return;
    api.compareVehicles(ids).then(setData).catch(console.error);
  }, [ids.length]);

  async function loadAi() {
    setLoadingAi(true); setAiErr(null);
    try { setAnalise(await api.analyzeComparison(ids)); }
    catch (e: any) { setAiErr(e.message ?? String(e)); }
    finally { setLoadingAi(false); }
  }

  if (!data) return <Shell><div className="p-8 text-gray-500">Carregando…</div></Shell>;

  // Mapeia path do field para a fonte (vinda do primeiro vehicle que tem o spec)
  function sourceForPath(path: string): string | undefined {
    for (const v of data.vehicles) {
      const ds = v.data_sources ?? {};
      if (ds[path]) return ds[path];
    }
    return undefined;
  }

  return (
    <Shell>
      <div className="p-8 max-w-full">
        <Link href="/veiculos" className="inline-flex items-center gap-2 text-gray-600 hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-ford-blue">Comparativo competitivo</h1>
            <p className="text-gray-600 mt-1">
              {data.vehicles.length} veículos · {data.fields.length} atributos · 🏆 verde = vencedor
            </p>
          </div>
          <button onClick={loadAi} disabled={loadingAi}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-ford-blue to-ford-blue-light text-white font-bold rounded-2xl hover:opacity-90 transition disabled:opacity-50">
            {loadingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loadingAi ? 'Analisando com gpt-4o...' : 'Análise inteligente da IA'}
          </button>
        </div>

        {/* Confiança por veículo */}
        <div className="mb-6 flex flex-wrap gap-3">
          {data.vehicles.map((v: any) => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-300 p-3 flex items-center gap-3 text-sm">
              <span className="font-semibold text-gray-900">{v.marca} {v.modelo}</span>
              <ConfianceBadge confianca={v.confianca_geral ?? 'baixa'} />
            </div>
          ))}
        </div>

        {/* ANÁLISE IA */}
        {aiErr && (
          <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded-2xl mb-6">{aiErr}</div>
        )}
        {analise && (
          <div className="bg-gradient-to-br from-ford-blue-dark to-ford-blue text-white rounded-2xl p-8 mb-8 shadow-xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Análise IA do comparativo</h2>
                <p className="text-xs text-gray-300">{analise.model}</p>
              </div>
            </div>
            <div className="prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
              {analise.analise}
            </div>
          </div>
        )}

        {/* Tabela comparativa */}
        <div className="bg-white rounded-2xl border border-gray-300 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ford-blue-dark text-white sticky top-0">
              <tr>
                <th className="text-left px-6 py-4 font-bold w-56">Atributo</th>
                {data.vehicles.map((v: any) => (
                  <th key={v.id} className="px-4 py-4 text-left min-w-[200px]">
                    <div className="text-xs text-gray-300 uppercase tracking-wide">{v.marca}</div>
                    <div className="text-base font-bold">{v.modelo} {v.versao}</div>
                    <div className="text-[10px] text-gray-300 mt-1">{v.ano}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.fields.map((f: any, i: number) => {
                const src = sourceForPath(f.path);
                return (
                  <tr key={`${f.path}-${i}`} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-800">{f.label}</div>
                      <SourceBadge source={src} />
                    </td>
                    {f.values.map((val: any, idx: number) => {
                      const winner = f.winner_index === idx;
                      return (
                        <td key={idx} className={`px-4 py-3 ${winner ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-gray-900'}`}>
                          <div className="flex items-center gap-2">
                            {winner && <Trophy className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
                            <span>{val === null || val === undefined ? '—' : String(val)}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
          <SourceBadge source="fipe" /> Preço oficial Brasil
          <SourceBadge source="manufacturer:toyota.com.br" /> Site oficial da fabricante
          <SourceBadge source="nhtsa" /> NHTSA (catálogo DOT/USA)
          <SourceBadge source="ai:gpt-4o-mini" /> Estimativa de IA (verifique)
        </div>
      </div>
    </Shell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Shell><div className="p-8 text-gray-500">Carregando…</div></Shell>}>
      <ComparePage />
    </Suspense>
  );
}
