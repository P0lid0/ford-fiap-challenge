'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import { api } from '@/lib/api';

export default function ClienteDetalhe() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [insight, setInsight] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    api.getClient(params.id).then(setData).catch(console.error);
  }, [params.id]);

  async function loadInsight() {
    if (!params.id) return;
    setLoadingInsight(true); setInsightErr(null);
    try {
      const r = await api.insightClient(params.id);
      setInsight(r);
    } catch (e: any) {
      setInsightErr(e.message ?? String(e));
    } finally { setLoadingInsight(false); }
  }

  if (!data) {
    return <Shell><div className="p-8 text-gray-500">Carregando…</div></Shell>;
  }

  const c = data.client;
  const pred = data.predictions?.[0];
  const profileColors: Record<string, string> = {
    fiel: 'bg-success', abandono: 'bg-danger', esquecido: 'bg-warning', economico: 'bg-ford-blue',
  };

  return (
    <Shell>
      <div className="p-8 max-w-5xl mx-auto">
        <Link href="/clientes" className="inline-flex items-center gap-2 text-gray-600 hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="bg-ford-blue text-white rounded-2xl p-8 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-300 mb-2">Cliente</div>
              <h1 className="text-3xl font-bold">{c.nome_cliente ?? `Cliente ${c.id.slice(0, 8)}`}</h1>
              <p className="text-gray-200 mt-2">{c.modelo_comprado} {c.versao_comprada} · R$ {c.preco_pago_brl.toLocaleString('pt-BR')}</p>
            </div>
            {pred && <PerfilBadge perfil={pred.perfil_predito} />}
          </div>
        </div>

        {pred && (
          <div className="bg-white rounded-2xl border border-gray-300 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Risco de evasão</h2>
            <div className="flex items-center gap-8 mb-6">
              <div className={`text-7xl font-black ${pred.risco_evasao > 0.6 ? 'text-danger' : pred.risco_evasao > 0.3 ? 'text-warning' : 'text-success'}`}>
                {Math.round(pred.risco_evasao * 100)}%
              </div>
              <div className="flex-1">
                <div className="bg-gray-100 h-3 rounded-full overflow-hidden mb-2">
                  <div className={`h-full ${pred.risco_evasao > 0.6 ? 'bg-danger' : pred.risco_evasao > 0.3 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${pred.risco_evasao * 100}%` }} />
                </div>
                <p className="text-sm text-gray-600">Confiança do modelo: {Math.round(pred.confianca * 100)}%</p>
              </div>
            </div>
            <div className="space-y-2">
              {(['fiel','abandono','esquecido','economico'] as const).map(p => {
                const v = pred[`prob_${p}`];
                return (
                  <div key={p} className="flex items-center gap-3">
                    <div className="w-24 text-sm font-medium text-gray-800 capitalize">{p}</div>
                    <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${profileColors[p]}`} style={{ width: `${v * 100}%` }} />
                    </div>
                    <div className="w-12 text-right text-sm font-bold text-gray-700">{Math.round(v * 100)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-300 p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-ford-blue" />
            <h2 className="text-lg font-bold text-gray-900">Análise da IA</h2>
            {insight?.model && <span className="text-xs text-gray-500 ml-auto">{insight.model}</span>}
          </div>
          {!insight && !loadingInsight && (
            <button onClick={loadInsight}
              className="inline-flex items-center gap-2 px-5 py-3 bg-ford-blue text-white font-medium rounded-2xl hover:bg-ford-blue-dark transition">
              <Sparkles className="w-4 h-4" /> Explicar com OpenAI
            </button>
          )}
          {loadingInsight && <div className="text-gray-500">Consultando OpenAI gpt-4o-mini…</div>}
          {insightErr && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl">{insightErr}</div>}
          {insight && (
            <div className="prose prose-gray max-w-none whitespace-pre-wrap text-gray-800 leading-relaxed">
              {insight.output}
            </div>
          )}
        </div>

        {pred?.recomendacoes_acao?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-300 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Ações sugeridas</h2>
            <ul className="space-y-2">
              {pred.recomendacoes_acao.map((a: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-gray-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-ford-blue mt-2.5 flex-shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-300 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Dados da venda</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-sm">
            <Row k="Idade" v={`${c.idade} anos`} />
            <Row k="Região" v={c.regiao} />
            <Row k="Renda mensal" v={`R$ ${c.renda_mensal_brl.toLocaleString('pt-BR')}`} />
            <Row k="Score crédito" v={c.score_credito} />
            <Row k="Modelo" v={`${c.modelo_comprado} ${c.versao_comprada}`} />
            <Row k="Preço pago" v={`R$ ${c.preco_pago_brl.toLocaleString('pt-BR')}`} />
            <Row k="Financiamento" v={`${c.financiamento} (${c.parcelas}x)`} />
            <Row k="Canal" v={c.canal_aquisicao} />
            <Row k="Primeiro carro" v={c.primeiro_carro ? 'sim' : 'não'} />
            <Row k="Test drive" v={c.test_drive_realizado ? 'sim' : 'não'} />
          </dl>
        </div>
      </div>
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
      <dt className="text-gray-600">{k}</dt>
      <dd className="font-semibold text-gray-900 text-right">{v}</dd>
    </div>
  );
}
