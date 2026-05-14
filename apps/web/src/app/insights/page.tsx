'use client';
import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

export default function Insights() {
  const [insight, setInsight] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true); setError(null);
    api.insightPortfolio().then(setInsight).catch(e => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <Shell>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-ford-blue">Insights de IA</h1>
            <p className="text-gray-600 mt-1">Análise estratégica da carteira gerada por OpenAI</p>
          </div>
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-gray-300 p-12 text-center text-gray-500">
            Consultando OpenAI gpt-4o…
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 p-6 rounded-2xl">{error}</div>
        )}
        {insight && !loading && (
          <>
            <div className="bg-white rounded-2xl border border-gray-300 p-8 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-ford-blue flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Briefing executivo</h2>
                  <div className="text-xs text-gray-500">
                    {insight.model} · {insight.source === 'cache' ? 'cache' : 'fresh'}
                  </div>
                </div>
              </div>
              <div className="prose prose-gray max-w-none whitespace-pre-wrap text-gray-800 leading-relaxed">
                {insight.output}
              </div>
            </div>

            {insight.metrics && (
              <div className="bg-white rounded-2xl border border-gray-300 p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-600 mb-4">Métricas usadas</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Total clientes" value={insight.metrics.totalClients} />
                  <Stat label="Risco médio" value={`${Math.round(insight.metrics.avgRisco * 100)}%`} />
                  <Stat label="Fiéis" value={insight.metrics.perfilCounts.fiel} />
                  <Stat label="Em abandono" value={insight.metrics.perfilCounts.abandono} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-2xl font-black text-ford-blue">{value}</div>
      <div className="text-xs uppercase tracking-wider text-gray-600 mt-1">{label}</div>
    </div>
  );
}
