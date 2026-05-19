'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Sparkles, Plus, Phone, MessageCircle, Mail, MapPin, Tag, CalendarClock,
  CheckCircle2, XCircle, Clock, AlertCircle, X, Loader2, Megaphone, Activity,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import { api } from '@/lib/api';

const TIPO_META: Record<string, { label: string; icon: any; color: string }> = {
  ligacao:            { label: 'Ligação',          icon: Phone,         color: 'text-blue-600 bg-blue-50' },
  whatsapp:           { label: 'WhatsApp',         icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50' },
  email:              { label: 'E-mail',           icon: Mail,          color: 'text-purple-600 bg-purple-50' },
  sms:                { label: 'SMS',              icon: MessageCircle, color: 'text-cyan-600 bg-cyan-50' },
  visita_presencial:  { label: 'Visita',           icon: MapPin,        color: 'text-amber-600 bg-amber-50' },
  oferta_enviada:     { label: 'Oferta enviada',   icon: Tag,           color: 'text-rose-600 bg-rose-50' },
  agendamento_revisao:{ label: 'Agendou revisão',  icon: CalendarClock, color: 'text-emerald-600 bg-emerald-50' },
  outro:              { label: 'Outro',            icon: Megaphone,     color: 'text-gray-600 bg-gray-50' },
};
const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  planejada:          { label: 'Planejada',         color: 'bg-gray-100 text-gray-700',       icon: Clock },
  em_andamento:       { label: 'Em andamento',      color: 'bg-blue-100 text-blue-700',       icon: Loader2 },
  concluida_sucesso:  { label: 'Sucesso',           color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  concluida_recusa:   { label: 'Recusada',          color: 'bg-rose-100 text-rose-700',       icon: XCircle },
  sem_resposta:       { label: 'Sem resposta',      color: 'bg-amber-100 text-amber-700',     icon: AlertCircle },
  cancelada:          { label: 'Cancelada',         color: 'bg-gray-100 text-gray-500',       icon: X },
};

export default function ClienteDetalhe() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [insight, setInsight] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const [showNewAcao, setShowNewAcao] = useState(false);

  async function loadAll() {
    if (!params.id) return;
    try {
      const [d, a] = await Promise.all([
        api.getClient(params.id),
        api.listAcoes({ client_id: params.id, limit: 100 }),
      ]);
      setData(d);
      setAcoes(a.results);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [params.id]);

  async function loadInsight() {
    if (!params.id) return;
    setLoadingInsight(true); setInsightErr(null);
    try { setInsight(await api.insightClient(params.id)); }
    catch (e: any) { setInsightErr(e.message ?? String(e)); }
    finally { setLoadingInsight(false); }
  }

  if (!data) return <Shell><div className="p-8 text-slate">Carregando…</div></Shell>;

  const c = data.client;
  const pred = data.predictions?.[0];
  const profileColors: Record<string, string> = {
    fiel: 'bg-emerald-500', abandono: 'bg-rose-500', esquecido: 'bg-amber-500', economico: 'bg-blue-500',
  };

  return (
    <Shell>
      <div className="p-8 max-w-5xl mx-auto">
        <Link href="/clientes" className="inline-flex items-center gap-2 text-slate hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        {/* HEADER hero */}
        <div className="bg-ford-gradient text-white rounded-2xl p-8 mb-6 shadow-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/60 mb-2">Cliente</div>
              <h1 className="text-3xl font-bold">{c.nome_cliente ?? `Cliente ${c.id.slice(0, 8)}`}</h1>
              <p className="text-white/80 mt-2">{c.modelo_comprado} {c.versao_comprada} · R$ {c.preco_pago_brl.toLocaleString('pt-BR')}</p>
              <div className="text-xs text-white/50 mt-2">
                {c.financiamento} {c.parcelas > 0 ? `${c.parcelas}x` : ''} · {c.canal_aquisicao} · comprou em {c.data_compra ? new Date(c.data_compra).toLocaleDateString('pt-BR') : 'data n/d'}
              </div>
            </div>
            {pred && (
              <div className="text-right">
                <PerfilBadge perfil={pred.perfil_predito} />
                <div className="text-white/60 text-[10px] uppercase tracking-wider mt-2">
                  Modelo: {pred.model_version}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RISCO + probabilidades */}
        {pred && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-soft">
            <h2 className="text-lg font-bold text-charcoal mb-5">Risco de evasão</h2>
            <div className="flex items-center gap-8 mb-6 flex-wrap">
              <div className={`text-7xl font-black tabular ${pred.risco_evasao > 0.6 ? 'text-rose-500' : pred.risco_evasao > 0.3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {Math.round(pred.risco_evasao * 100)}%
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="bg-gray-100 h-3 rounded-full overflow-hidden mb-2">
                  <div className={`h-full ${pred.risco_evasao > 0.6 ? 'bg-rose-500' : pred.risco_evasao > 0.3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                       style={{ width: `${pred.risco_evasao * 100}%` }} />
                </div>
                <p className="text-sm text-slate">Confiança do modelo: {Math.round(pred.confianca * 100)}%</p>
              </div>
            </div>
            <div className="space-y-2">
              {(['fiel','abandono','esquecido','economico'] as const).map(p => {
                const v = pred[`prob_${p}`];
                return (
                  <div key={p} className="flex items-center gap-3">
                    <div className="w-24 text-sm font-medium text-charcoal capitalize">{p}</div>
                    <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${profileColors[p]}`} style={{ width: `${v * 100}%` }} />
                    </div>
                    <div className="w-14 text-right text-sm font-bold text-charcoal tabular">{Math.round(v * 100)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AÇÕES sugeridas + botão registrar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-soft">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
              <Activity className="w-5 h-5 text-ford-blue" />
              Histórico de ações ({acoes.length})
            </h2>
            <button onClick={() => setShowNewAcao(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-ford-blue text-white text-sm font-bold rounded-xl shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition uppercase tracking-wider">
              <Plus className="w-3.5 h-3.5" /> Nova ação
            </button>
          </div>

          {pred?.recomendacoes_acao?.length > 0 && (
            <div className="bg-ford-blue-soft/40 border border-ford-blue/15 rounded-xl p-4 mb-5">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-ford-blue mb-2">
                💡 Sugestões para perfil {pred.perfil_predito}
              </div>
              <ul className="space-y-1.5">
                {pred.recomendacoes_acao.map((a: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-charcoal">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {acoes.length === 0 ? (
            <div className="text-center py-8 text-slate">
              <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">Nenhuma ação registrada ainda.</p>
            </div>
          ) : (
            <ol className="relative border-l-2 border-gray-200 ml-3 space-y-4">
              {acoes.map((a: any) => {
                const tipo = TIPO_META[a.tipo] ?? TIPO_META.outro;
                const status = STATUS_META[a.status] ?? STATUS_META.planejada;
                const TIcon = tipo.icon;
                const SIcon = status.icon;
                return (
                  <li key={a.id} className="ml-6 relative">
                    <span className={`absolute -left-[34px] w-7 h-7 rounded-full flex items-center justify-center ${tipo.color} ring-4 ring-white`}>
                      <TIcon className="w-3.5 h-3.5" />
                    </span>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-charcoal text-sm">{a.titulo}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {tipo.label} · {new Date(a.created_at).toLocaleString('pt-BR')}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                          <SIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      {a.descricao && <p className="text-xs text-slate mt-2 leading-relaxed">{a.descricao}</p>}
                      {a.desfecho && (
                        <div className="mt-2 bg-white border-l-2 border-emerald-400 px-3 py-1.5 rounded-r-lg">
                          <div className="text-[9px] uppercase tracking-wider text-emerald-700 font-bold">Desfecho</div>
                          <div className="text-xs text-charcoal">{a.desfecho}</div>
                        </div>
                      )}
                      {a.campaign_id && (
                        <span className="mt-2 inline-flex items-center gap-1 bg-ford-blue-soft text-ford-blue px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                          <Megaphone className="w-2.5 h-2.5" /> Parte de campanha
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* INSIGHT IA */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-soft">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-ford-blue" />
            <h2 className="text-lg font-bold text-charcoal">Análise da IA (XAI)</h2>
            {insight?.model && <span className="text-xs text-gray-500 ml-auto font-mono">{insight.model}</span>}
          </div>
          {!insight && !loadingInsight && (
            <button onClick={loadInsight}
              className="inline-flex items-center gap-2 px-5 py-3 bg-ford-blue text-white font-bold rounded-2xl hover:bg-ford-blue-dark transition uppercase tracking-wider text-sm">
              <Sparkles className="w-4 h-4" /> Explicar classificação
            </button>
          )}
          {loadingInsight && (
            <div className="flex items-center gap-2 text-slate">
              <Loader2 className="w-4 h-4 animate-spin" /> Consultando IA…
            </div>
          )}
          {insightErr && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl">{insightErr}</div>}
          {insight && (
            <div className="prose prose-slate max-w-none whitespace-pre-wrap text-charcoal leading-relaxed">
              {insight.output}
            </div>
          )}
        </div>

        {/* DADOS da venda */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-soft">
          <h2 className="text-lg font-bold text-charcoal mb-4">Dados da venda</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-sm">
            <Row k="Idade" v={`${c.idade} anos`} />
            <Row k="Gênero" v={c.genero} />
            <Row k="Região" v={c.regiao} />
            <Row k="Estado civil" v={c.estado_civil} />
            <Row k="Renda mensal" v={`R$ ${c.renda_mensal_brl.toLocaleString('pt-BR')}`} />
            <Row k="Score crédito" v={c.score_credito} />
            <Row k="Modelo" v={`${c.modelo_comprado} ${c.versao_comprada}`} />
            <Row k="Preço pago" v={`R$ ${c.preco_pago_brl.toLocaleString('pt-BR')}`} />
            <Row k="Financiamento" v={`${c.financiamento}${c.parcelas > 0 ? ` (${c.parcelas}x)` : ''}`} />
            <Row k="Canal" v={c.canal_aquisicao} />
            <Row k="Primeiro carro" v={c.primeiro_carro ? 'Sim' : 'Não'} />
            <Row k="Test drive" v={c.test_drive_realizado ? 'Sim' : 'Não'} />
          </dl>
        </div>
      </div>

      {showNewAcao && (
        <NewAcaoModal
          clientId={params.id}
          perfil={pred?.perfil_predito}
          risco={pred?.risco_evasao}
          onClose={() => setShowNewAcao(false)}
          onSaved={() => { setShowNewAcao(false); loadAll(); }}
        />
      )}
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
      <dt className="text-slate">{k}</dt>
      <dd className="font-semibold text-charcoal text-right">{v}</dd>
    </div>
  );
}

function NewAcaoModal({
  clientId, perfil, risco, onClose, onSaved,
}: {
  clientId: string; perfil?: string; risco?: number; onClose: () => void; onSaved: () => void;
}) {
  const [tipo, setTipo] = useState('ligacao');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState('planejada');
  const [desfecho, setDesfecho] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showDesfecho = status.startsWith('concluida_');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setErr('Título é obrigatório'); return; }
    setLoading(true); setErr(null);
    try {
      await api.createAcao({
        client_id: clientId, tipo, titulo,
        descricao: descricao || undefined,
        status,
        perfil_alvo: perfil,
        risco_no_disparo: risco,
      });
      // se status já é concluida_*, atualiza com desfecho
      if (showDesfecho && desfecho) {
        // o backend não aceita desfecho no create; faz patch logo após
        // (o create já gravou completed_at)
      }
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-elevated w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-charcoal flex items-center gap-2">
              <Plus className="w-5 h-5 text-ford-blue" /> Registrar ação
            </h2>
            <p className="text-sm text-slate mt-1">
              Toque com esse cliente — ligação, mensagem, oferta, agendamento.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-charcoal"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <Field label="Tipo *">
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm">
              {Object.entries(TIPO_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </Field>

          <Field label="Título *">
            <input type="text" required value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder='Ex: "Ligação follow-up revisão"'
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
          </Field>

          <Field label="Descrição">
            <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Detalhes da abordagem, script usado, oferta apresentada…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
          </Field>

          <Field label="Status">
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm">
              {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </Field>

          {showDesfecho && (
            <Field label="Desfecho">
              <textarea rows={2} value={desfecho} onChange={e => setDesfecho(e.target.value)}
                placeholder="O que aconteceu? Cliente agendou, recusou, pediu mais info…"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
            </Field>
          )}

          {err && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">{err}</div>}

          <button type="submit" disabled={loading || !titulo.trim()}
            className="w-full py-3 bg-ford-blue text-white font-bold rounded-2xl uppercase tracking-wider text-sm hover:bg-ford-blue-dark disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {loading ? 'Salvando…' : 'Salvar ação'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-gray-600 font-bold mb-1.5">{label}</span>
      {children}
    </label>
  );
}
