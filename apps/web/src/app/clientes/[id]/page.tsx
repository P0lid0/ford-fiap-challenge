'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Sparkles, Plus, Phone, MessageCircle, Mail, MapPin, Tag, CalendarClock,
  CheckCircle2, XCircle, Clock, AlertCircle, X, Loader2, Megaphone, Activity,
  Brain, Cpu, Zap, AlertTriangle, RefreshCw, Save, NotebookPen, ScanSearch,
  Wrench, ShieldAlert, Calendar,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';
import {
  Card, Modal, ModalBody, ModalFooter, Button, LoadingState, Field,
} from '@/components/ui';
import { useConfirm } from '@/components/ConfirmDialog';
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
  const { confirm, dialog } = useConfirm();
  const [data, setData] = useState<any>(null);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [insight, setInsight] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const [showNewAcao, setShowNewAcao] = useState(false);
  // Híbrido ML+IA
  const [hybridResult, setHybridResult] = useState<any>(null);
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyErr, setReclassifyErr] = useState<string | null>(null);
  // Notas
  const [notasDraft, setNotasDraft] = useState('');
  const [savingNotas, setSavingNotas] = useState(false);
  const [notasDirty, setNotasDirty] = useState(false);

  async function loadAll() {
    if (!params.id) return;
    try {
      const [d, a] = await Promise.all([
        api.getClient(params.id),
        api.listAcoes({ client_id: params.id, limit: 100 }),
      ]);
      setData(d);
      setAcoes(a.results);
      setNotasDraft(d.client?.notas ?? '');
      setNotasDirty(false);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [params.id]);

  async function saveNotas() {
    if (!params.id || !notasDirty) return;
    setSavingNotas(true);
    try {
      await api.updateClientNotas(params.id, notasDraft);
      setNotasDirty(false);
    } catch (e: any) { alert(e.message); }
    finally { setSavingNotas(false); }
  }

  async function reclassifyHybrid() {
    if (!params.id) return;
    const ok = await confirm({
      title: 'Reclassificar este cliente com ML + IA?',
      message: (
        <>
          O modelo XGBoost + um LLM (Anthropic/OpenAI/Gemini) vão recalcular o perfil
          comportamental e o risco de evasão. Sobrescreve a predição atual no histórico.
        </>
      ),
      details: (
        <>
          Custo estimado: <b>$0.01-0.03</b> por execução. Suas notas atuais entram no
          contexto da IA — salve antes se quiser que ela considere a versão mais nova.
        </>
      ),
      confirmLabel: 'Sim, reclassificar',
      cancelLabel: 'Cancelar',
      variant: 'ai',
    });
    if (!ok) return;
    setReclassifying(true); setReclassifyErr(null); setHybridResult(null);
    try {
      // Salva notas primeiro se houver mudanças (pra IA pegar versão atualizada)
      if (notasDirty) await saveNotas();
      const r = await api.reclassifyClient(params.id, { force_ai: true });
      setHybridResult(r.hybrid);
      await loadAll(); // recarrega pra mostrar nova prediction no topo
    } catch (e: any) {
      setReclassifyErr(e.message ?? String(e));
    } finally { setReclassifying(false); }
  }

  async function loadInsight() {
    if (!params.id) return;
    const ok = await confirm({
      title: 'Gerar insight XAI com IA?',
      message: 'A IA vai gerar uma explicação textual da classificação e do risco de evasão deste cliente.',
      details: <>Custo estimado: <b>$0.005-0.02</b> por execução.</>,
      confirmLabel: 'Sim, gerar',
      cancelLabel: 'Cancelar',
      variant: 'ai',
    });
    if (!ok) return;
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
      {dialog}
      <div className="p-8 max-w-5xl mx-auto">
        <Link href="/clientes" className="inline-flex items-center gap-2 text-slate hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        {/* HEADER hero */}
        <div className="bg-ford-gradient text-white rounded-2xl p-8 mb-6 shadow-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs uppercase tracking-[0.25em] text-white/60">
                  {c.is_ford_real ? 'Ford BR · dataset real' : 'Cliente cadastrado'}
                </span>
                {c.is_ford_real && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold bg-white/15 border border-white/20 rounded">
                    vin_share_Desafio_02
                  </span>
                )}
                {c.perfil_real && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-bold bg-emerald-400/30 border border-emerald-300/50 rounded">
                    Perfil real (ETL): {c.perfil_real}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold">
                {c.nome_cliente ?? `${c.model_name ?? c.modelo_comprado} ${c.model_year ?? ''}`.trim()}
              </h1>
              <p className="text-white/80 mt-2">
                {c.model_name ?? c.modelo_comprado}
                {c.versao_comprada && c.versao_comprada !== '—' ? ` ${c.versao_comprada}` : ''}
                {c.model_year ? ` · ${c.model_year}` : ''}
                {c.preco_pago_brl ? ` · R$ ${c.preco_pago_brl.toLocaleString('pt-BR')}` : ''}
              </p>
              <div className="text-xs text-white/50 mt-2 flex items-center gap-3 flex-wrap">
                {c.vin_hash && (
                  <span className="font-mono">VIN {String(c.vin_hash).slice(0, 12)}…</span>
                )}
                {c.dealer_code_venda && <span>Dealer {c.dealer_code_venda}</span>}
                {c.sales_date && <span>Vendido {new Date(c.sales_date).toLocaleDateString('pt-BR')}</span>}
                {c.financiamento && <span>{c.financiamento}{c.parcelas > 0 ? ` ${c.parcelas}x` : ''}</span>}
              </div>
            </div>
            {pred && (
              <div className="text-right flex-shrink-0">
                <PerfilBadge perfil={pred.perfil_predito} />
                <div className="text-white/60 text-[10px] uppercase tracking-wider mt-2">
                  ML · {pred.model_version}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === VISÃO 360 — sinais de retenção computados em tempo real === */}
        {/* Atende explicitamente o slide D2: "visão 360 graus do cliente e do veículo" + */}
        {/* "modelagem preditiva pra veículos que precisam de serviço" + "status da garantia" */}
        <RetencaoSignals client={c} />

        {/* === Bloco Ford BR (campos do dataset real) === */}
        {c.is_ford_real && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-soft">
            <h2 className="text-lg font-bold text-charcoal mb-5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-ford-blue font-bold">
                Dataset Ford BR
              </span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricBox label="Modelo" value={c.model_name ?? '—'} />
              <MetricBox label="Ano modelo" value={c.model_year ?? '—'} />
              <MetricBox label="Dealer venda" value={c.dealer_code_venda ?? '—'} />
              <MetricBox label="KM máx" value={c.km_max ? c.km_max.toLocaleString('pt-BR') : '—'} />
              <MetricBox label="Revisões" value={c.num_revisoes ?? '0'} accent={c.num_revisoes >= 4 ? 'emerald' : c.num_revisoes <= 1 ? 'rose' : 'amber'} />
              <MetricBox label="Service orders" value={c.num_servicos_total ?? '0'} />
              <MetricBox label="Dealer loyalty" value={c.dealer_loyalty != null ? `${Math.round(c.dealer_loyalty * 100)}%` : '—'} accent={c.dealer_loyalty >= 0.7 ? 'emerald' : c.dealer_loyalty <= 0.4 ? 'rose' : 'amber'} />
              <MetricBox label="Dias última revisão" value={c.dias_desde_ultima_revisao ?? '—'} accent={c.dias_desde_ultima_revisao > 365 ? 'rose' : c.dias_desde_ultima_revisao > 180 ? 'amber' : 'emerald'} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {c.sales_date && <DateBox label="Venda" date={c.sales_date} />}
              {c.delivery_date && <DateBox label="Entrega" date={c.delivery_date} />}
              {c.warranty_start_date && <DateBox label="Garantia" date={c.warranty_start_date} />}
              {c.primeiro_servico && <DateBox label="1º serviço" date={c.primeiro_servico} />}
              {c.ultimo_servico && <DateBox label="Último serviço" date={c.ultimo_servico} />}
              {c.dias_ate_1a_revisao != null && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Dias até 1ª revisão</div>
                  <div className="text-base font-bold text-charcoal tabular">{c.dias_ate_1a_revisao} dias</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RISCO + probabilidades */}
        {pred && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-soft">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h2 className="text-lg font-bold text-charcoal">Risco de evasão</h2>
              <div className="flex items-center gap-2">
                {pred.source && (
                  <SourceTag source={pred.source} concordancia={pred.concordancia} />
                )}
                <button onClick={reclassifyHybrid} disabled={reclassifying}
                  title="Roda ML + IA com contexto qualitativo (notas + ações)"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-gradient-to-r from-ford-blue to-ford-blue-light text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-bold uppercase tracking-wider">
                  {reclassifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                  {reclassifying ? 'Analisando…' : 'Reclassificar ML + IA'}
                </button>
              </div>
            </div>
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

        {/* ERRO de reclassificação */}
        {reclassifyErr && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <div>
              <b>Falha ao reclassificar:</b> {reclassifyErr}
            </div>
          </div>
        )}

        {/* COMPARAÇÃO ML ↔ IA (renderiza só se hybridResult ou pred tem ML+AI) */}
        {hybridResult && hybridResult.source === 'hybrid' && (
          <div className="bg-white rounded-2xl border-2 border-ford-blue/30 p-6 mb-6 shadow-card animate-slide-up">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
                <Brain className="w-5 h-5 text-ford-blue" />
                Análise Híbrida — ML + IA
              </h2>
              {hybridResult.concordancia ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" /> Concordância
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3" /> Divergência — revisar
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              {/* ML */}
              <PredCard
                title="XGBoost (ML)"
                icon={Cpu}
                perfil={hybridResult.ml.perfil}
                conf={hybridResult.ml.confianca}
                probs={hybridResult.ml.probabilidades}
                subtitle={hybridResult.ml.model_version}
              />
              {/* IA */}
              {hybridResult.ai && (
                <PredCard
                  title="LLM (IA crítico)"
                  icon={Sparkles}
                  perfil={hybridResult.ai.perfil}
                  conf={hybridResult.ai.confianca}
                  probs={hybridResult.ai.probabilidades}
                  subtitle={hybridResult.ai.model_label}
                />
              )}
            </div>

            {/* Resultado ensemble */}
            <div className="bg-ford-blue text-white rounded-xl p-4 mb-4">
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-80 mb-1">Decisão final (ensemble)</div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <PerfilBadge perfil={hybridResult.perfil} />
                  <span className="text-sm">Confiança {Math.round(hybridResult.confianca * 100)}%</span>
                </div>
                {hybridResult.human_review_needed && (
                  <span className="text-xs bg-amber-400 text-amber-900 px-2 py-1 rounded-md font-bold uppercase">
                    Revisão humana sugerida
                  </span>
                )}
              </div>
            </div>

            {/* Raciocínio da IA */}
            {hybridResult.raciocinio && (
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 mb-3">
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-purple-700 mb-2 flex items-center gap-1">
                  <ScanSearch className="w-3 h-3" /> Raciocínio da IA
                </div>
                <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                  {hybridResult.raciocinio}
                </p>
              </div>
            )}

            {/* Sinais detectados */}
            {hybridResult.signals_detected?.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mb-2">
                  Sinais qualitativos detectados
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hybridResult.signals_detected.map((s: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-charcoal text-[11px] rounded-md border border-gray-200">
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOTAS livres (entrada qualitativa pra IA) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-soft">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-lg font-bold text-charcoal flex items-center gap-2">
              <NotebookPen className="w-5 h-5 text-ford-blue" />
              Notas do consultor
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              📝 Entram no contexto da IA quando você reclassificar
            </span>
          </div>
          <p className="text-xs text-slate mb-3 leading-relaxed">
            Anote aqui sinais qualitativos que o ML não capta: reclamações, intenções de troca,
            observações de comportamento, contexto de vida. A IA usa esse texto pra refinar a classificação.
          </p>
          <textarea
            value={notasDraft}
            onChange={e => { setNotasDraft(e.target.value); setNotasDirty(true); }}
            placeholder='Ex: "Cliente reclamou do tempo de espera na última revisão. Mencionou que está pensando em trocar de marca. Tem 2 filhos pequenos — talvez SUV maior."'
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm leading-relaxed"
          />
          {notasDirty && (
            <div className="flex justify-end mt-2">
              <button onClick={saveNotas} disabled={savingNotas}
                className="inline-flex items-center gap-2 px-4 py-2 bg-ford-blue text-white rounded-lg text-xs font-bold hover:bg-ford-blue-dark disabled:opacity-50 uppercase tracking-wider">
                {savingNotas ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {savingNotas ? 'Salvando…' : 'Salvar notas'}
              </button>
            </div>
          )}
        </div>

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

        {/* DADOS da venda — só renderiza se houver pelo menos um campo preenchido.
            Clientes Ford-real têm esses campos NULL (vêm só com VIN_Hash + dados Ford). */}
        {hasDadosVenda(c) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-soft">
            <h2 className="text-lg font-bold text-charcoal mb-4">Dados da venda</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-sm">
              {c.idade != null && <Row k="Idade" v={`${c.idade} anos`} />}
              {c.genero && <Row k="Gênero" v={c.genero} />}
              {c.regiao && <Row k="Região" v={c.regiao} />}
              {c.estado_civil && <Row k="Estado civil" v={c.estado_civil} />}
              {c.renda_mensal_brl != null && (
                <Row k="Renda mensal" v={`R$ ${Number(c.renda_mensal_brl).toLocaleString('pt-BR')}`} />
              )}
              {c.score_credito != null && <Row k="Score crédito" v={c.score_credito} />}
              {(c.modelo_comprado || c.versao_comprada) && (
                <Row k="Modelo" v={`${c.modelo_comprado ?? ''} ${c.versao_comprada ?? ''}`.trim()} />
              )}
              {c.preco_pago_brl != null && (
                <Row k="Preço pago" v={`R$ ${Number(c.preco_pago_brl).toLocaleString('pt-BR')}`} />
              )}
              {c.financiamento && (
                <Row k="Financiamento" v={`${c.financiamento}${(c.parcelas ?? 0) > 0 ? ` (${c.parcelas}x)` : ''}`} />
              )}
              {c.canal_aquisicao && <Row k="Canal" v={c.canal_aquisicao} />}
              {c.primeiro_carro != null && <Row k="Primeiro carro" v={c.primeiro_carro ? 'Sim' : 'Não'} />}
              {c.test_drive_realizado != null && <Row k="Test drive" v={c.test_drive_realizado ? 'Sim' : 'Não'} />}
            </dl>
          </div>
        )}
      </div>

      {showNewAcao && (
        <NewAcaoModal
          clientId={params.id}
          clientEmail={c.email_cliente}
          perfil={pred?.perfil_predito ?? c.perfil_real}
          risco={pred?.risco_evasao}
          onClose={() => setShowNewAcao(false)}
          onSaved={() => { setShowNewAcao(false); loadAll(); }}
        />
      )}
    </Shell>
  );
}

// Verifica se vale renderizar o bloco "Dados da venda" (campos sintéticos
// opcionais — clientes Ford-real vêm todos null aqui).
function hasDadosVenda(c: any): boolean {
  return !!(
    c.idade != null || c.genero || c.regiao || c.estado_civil ||
    c.renda_mensal_brl != null || c.score_credito != null ||
    c.modelo_comprado || c.versao_comprada ||
    c.preco_pago_brl != null || c.financiamento ||
    c.canal_aquisicao || c.primeiro_carro != null || c.test_drive_realizado != null
  );
}

// ====================================================================
// Visão 360 — sinais de retenção computados em tempo real
// (atende: "modelagem preditiva pra veículos que precisam de serviço"
//  + "status da garantia" + "visão 360 do cliente e do veículo")
// ====================================================================
function RetencaoSignals({ client }: { client: any }) {
  // Próxima revisão estimada (Ford manual: 12 meses do último serviço)
  const base = client.ultimo_servico ? new Date(client.ultimo_servico)
    : client.delivery_date ? new Date(client.delivery_date)
    : client.sales_date ? new Date(client.sales_date)
    : null;
  const proxima = base ? new Date(base) : null;
  if (proxima) proxima.setMonth(proxima.getMonth() + 12);
  const diasAteProxima = proxima ? Math.round((proxima.getTime() - Date.now()) / 86_400_000) : null;

  // Status garantia (Ford BR: 3 anos)
  const inicioGarantia = client.warranty_start_date ? new Date(client.warranty_start_date) : null;
  const fimGarantia = inicioGarantia ? new Date(inicioGarantia) : null;
  if (fimGarantia) fimGarantia.setFullYear(fimGarantia.getFullYear() + 3);
  const diasGarantia = fimGarantia ? Math.round((fimGarantia.getTime() - Date.now()) / 86_400_000) : null;

  // Idade do veículo
  const anoAtual = new Date().getFullYear();
  const idadeAnos = client.model_year ? anoAtual - client.model_year : null;

  if (!base && !inicioGarantia && idadeAnos == null) return null;

  // Sugestão de ação baseada nos sinais
  const sugestoes: string[] = [];
  if (diasAteProxima != null && diasAteProxima <= 0) {
    sugestoes.push(`🚨 Revisão atrasada há ${Math.abs(diasAteProxima)} dias — contato imediato`);
  } else if (diasAteProxima != null && diasAteProxima <= 30) {
    sugestoes.push(`📞 Lembrete de revisão (${diasAteProxima}d) — agendar pelo dealer`);
  }
  if (diasGarantia != null && diasGarantia <= 0) {
    sugestoes.push(`⚠️ Garantia vencida — oferecer pacote pós-garantia`);
  } else if (diasGarantia != null && diasGarantia <= 90) {
    sugestoes.push(`⏰ Garantia vence em ${diasGarantia}d — oportunidade de lock-in`);
  }
  if (idadeAnos != null && idadeAnos >= 5 && (client.num_revisoes ?? 0) < 3) {
    sugestoes.push(`📉 ${idadeAnos} anos com pouco histórico — risco de abandono real`);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-soft">
      <h2 className="text-lg font-bold text-charcoal mb-5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-ford-blue font-bold">
          Visão 360 · Sinais de retenção
        </span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Próxima revisão */}
        {diasAteProxima != null && (
          <div className={`rounded-xl p-4 border ${
            diasAteProxima <= 0 ? 'bg-rose-50 border-rose-200'
            : diasAteProxima <= 30 ? 'bg-amber-50 border-amber-200'
            : diasAteProxima <= 90 ? 'bg-blue-50 border-blue-200'
            : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className={`w-4 h-4 ${
                diasAteProxima <= 0 ? 'text-rose-600'
                : diasAteProxima <= 30 ? 'text-amber-600'
                : diasAteProxima <= 90 ? 'text-blue-600'
                : 'text-emerald-600'
              }`} />
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Próxima revisão</span>
            </div>
            <div className={`text-3xl font-black tabular ${
              diasAteProxima <= 0 ? 'text-rose-700'
              : diasAteProxima <= 30 ? 'text-amber-700'
              : 'text-charcoal'
            }`}>
              {diasAteProxima <= 0 ? `${Math.abs(diasAteProxima)}d` : `${diasAteProxima}d`}
            </div>
            <div className="text-[11px] text-slate mt-1">
              {diasAteProxima <= 0 ? 'atrasada' : 'até a recomendada'}
              {proxima && <> · {proxima.toLocaleDateString('pt-BR')}</>}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Baseada em {client.ultimo_servico ? 'último serviço' : client.delivery_date ? 'entrega' : 'venda'} +12 meses
            </div>
          </div>
        )}

        {/* Status garantia */}
        {diasGarantia != null && fimGarantia && (
          <div className={`rounded-xl p-4 border ${
            diasGarantia <= 0 ? 'bg-rose-50 border-rose-200'
            : diasGarantia <= 90 ? 'bg-amber-50 border-amber-200'
            : diasGarantia <= 180 ? 'bg-blue-50 border-blue-200'
            : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className={`w-4 h-4 ${
                diasGarantia <= 0 ? 'text-rose-600'
                : diasGarantia <= 90 ? 'text-amber-600'
                : diasGarantia <= 180 ? 'text-blue-600'
                : 'text-emerald-600'
              }`} />
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Garantia (3 anos)</span>
            </div>
            <div className={`text-3xl font-black tabular ${
              diasGarantia <= 0 ? 'text-rose-700'
              : diasGarantia <= 90 ? 'text-amber-700'
              : 'text-charcoal'
            }`}>
              {diasGarantia <= 0 ? 'venc.' : `${diasGarantia}d`}
            </div>
            <div className="text-[11px] text-slate mt-1">
              {diasGarantia <= 0 ? 'vencida' : 'até vencer'} · {fimGarantia.toLocaleDateString('pt-BR')}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Início {inicioGarantia!.toLocaleDateString('pt-BR')}
            </div>
          </div>
        )}

        {/* Idade do veículo */}
        {idadeAnos != null && (
          <div className={`rounded-xl p-4 border ${
            idadeAnos <= 2 ? 'bg-emerald-50 border-emerald-200'
            : idadeAnos <= 5 ? 'bg-blue-50 border-blue-200'
            : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className={`w-4 h-4 ${
                idadeAnos <= 2 ? 'text-emerald-600'
                : idadeAnos <= 5 ? 'text-blue-600'
                : 'text-amber-600'
              }`} />
              <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Idade do veículo</span>
            </div>
            <div className="text-3xl font-black tabular text-charcoal">
              {idadeAnos}<span className="text-base font-normal text-gray-500"> anos</span>
            </div>
            <div className="text-[11px] text-slate mt-1">
              Modelo {client.model_year}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              {idadeAnos <= 2 ? 'Veículo novo' : idadeAnos <= 5 ? 'Em garantia/pós' : 'Veterano — risco mais alto'}
            </div>
          </div>
        )}
      </div>

      {/* Sugestões automáticas baseadas nos sinais */}
      {sugestoes.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="label mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Próximas ações sugeridas
          </div>
          <ul className="space-y-1.5">
            {sugestoes.map((s, i) => (
              <li key={i} className="text-sm text-charcoal flex items-start gap-2">
                <span className="font-bold text-ford-blue">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, accent }: { label: string; value: any; accent?: 'emerald' | 'amber' | 'rose' }) {
  const colorMap: any = {
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    rose: 'text-rose-600 bg-rose-50',
  };
  return (
    <div className={`rounded-xl px-4 py-3 ${accent ? colorMap[accent] : 'bg-gray-50 text-charcoal'}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</div>
      <div className="text-xl font-bold tabular mt-1">{value}</div>
    </div>
  );
}

function DateBox({ label, date }: { label: string; date: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{label}</div>
      <div className="text-sm font-medium text-charcoal">{new Date(date).toLocaleDateString('pt-BR')}</div>
    </div>
  );
}

function SourceTag({ source, concordancia }: { source: string; concordancia: boolean | null | undefined }) {
  if (source === 'ml_only') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
        <Cpu className="w-2.5 h-2.5" /> ML
      </span>
    );
  }
  if (source === 'hybrid') {
    return concordancia ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
        <Zap className="w-2.5 h-2.5" /> ML + IA concordam
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
        <Brain className="w-2.5 h-2.5" /> ML+IA divergem
      </span>
    );
  }
  return null;
}

function PredCard({ title, icon: Icon, perfil, conf, probs, subtitle }: {
  title: string; icon: any; perfil: string; conf: number;
  probs: Record<string, number>; subtitle?: string;
}) {
  const colors: Record<string, string> = {
    fiel: 'bg-emerald-500', esquecido: 'bg-amber-500', economico: 'bg-blue-500', abandono: 'bg-rose-500',
  };
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-ford-blue" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">{title}</span>
      </div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <PerfilBadge perfil={perfil as any} />
        <span className="text-xs text-slate">conf. {Math.round(conf * 100)}%</span>
      </div>
      <div className="space-y-1.5">
        {(['fiel', 'esquecido', 'economico', 'abandono'] as const).map(p => {
          const v = probs[p] ?? 0;
          return (
            <div key={p} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-slate capitalize">{p}</span>
              <div className="flex-1 bg-white h-1.5 rounded-full overflow-hidden">
                <div className={`h-full ${colors[p]}`} style={{ width: `${v * 100}%` }} />
              </div>
              <span className="w-8 text-right tabular text-charcoal font-bold">{Math.round(v * 100)}%</span>
            </div>
          );
        })}
      </div>
      {subtitle && <div className="text-[9px] text-gray-400 mt-2 font-mono truncate">{subtitle}</div>}
    </div>
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
  clientId, clientEmail, perfil, risco, onClose, onSaved,
}: {
  clientId: string; clientEmail?: string | null; perfil?: string; risco?: number;
  onClose: () => void; onSaved: () => void;
}) {
  const [tipo, setTipo] = useState('ligacao');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState('planejada');
  const [desfecho, setDesfecho] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Modo email-real
  const [emailPreview, setEmailPreview] = useState<{ subject: string; body_html: string } | null>(null);
  const [emailTo, setEmailTo] = useState(clientEmail ?? '');
  const [emailResult, setEmailResult] = useState<any>(null);
  const [emailConfig, setEmailConfig] = useState<{ mode: 'real' | 'mock'; message: string } | null>(null);

  const isEmail = tipo === 'email';
  const isMockMode = emailConfig?.mode === 'mock';
  const showDesfecho = status.startsWith('concluida_') && !isEmail;

  // Quando o vendedor escolhe tipo=email, carrega preview + status do provider
  useEffect(() => {
    if (!isEmail) { setEmailPreview(null); setEmailConfig(null); return; }
    api.emailTemplatePreview(clientId)
      .then(t => {
        setEmailPreview({ subject: t.subject, body_html: t.body_html });
        setTitulo(t.subject);
        if (t.destinatario) setEmailTo(t.destinatario);
      })
      .catch(e => setErr(e.message));
    api.emailConfigStatus().then(setEmailConfig).catch(() => {});
  }, [isEmail, clientId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setErr('Título é obrigatório'); return; }
    setLoading(true); setErr(null); setEmailResult(null);
    try {
      if (isEmail) {
        // Modo email-real: envia via Resend (ou mock se chave não configurada)
        if (!emailTo.trim()) { setErr('Destinatário é obrigatório'); setLoading(false); return; }
        const r = await api.sendEmailAcao({
          client_id: clientId,
          subject: emailPreview?.subject ?? titulo,
          body_html: emailPreview?.body_html,
          use_template: !emailPreview, // se já temos preview customizado, não força template
          to_override: emailTo,
        });
        setEmailResult(r);
        if (r.ok) {
          // dá um beat pra o usuário ver o resultado antes de fechar
          setTimeout(() => onSaved(), 1500);
        } else {
          setErr(r.error ?? 'Falha ao enviar e-mail');
        }
      } else {
        // Modo padrão: só registra a ação
        await api.createAcao({
          client_id: clientId, tipo, titulo,
          descricao: descricao || undefined,
          status,
          perfil_alvo: perfil,
          risco_no_disparo: risco,
        });
        onSaved();
      }
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal
      title={isEmail ? 'Enviar e-mail real' : 'Registrar ação'}
      description={isEmail
        ? 'O e-mail será enviado de verdade via provider configurado (Resend) e a ação fica registrada.'
        : 'Toque com esse cliente — ligação, mensagem, oferta, agendamento.'}
      icon={Plus}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit}>
        <ModalBody className="space-y-4">
          <Field label="Tipo" required>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm">
              {Object.entries(TIPO_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </Field>

          {/* === MODO E-MAIL: preview do template + destinatário === */}
          {isEmail && (
            <>
              {/* Banner amarelo se Resend não está configurado */}
              {isMockMode && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-amber-900 text-sm mb-1">
                        Modo simulação ativo — nenhum e-mail será enviado de verdade
                      </div>
                      <div className="text-xs text-amber-800 leading-relaxed">
                        A chave do <b>Resend</b> não está configurada. Quando você clicar
                        &quot;Enviar e-mail&quot;, o sistema vai apenas registrar a ação no histórico,
                        mas o destinatário <b>não vai receber nada</b>.
                      </div>
                      <Link href="/configuracoes"
                        className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-amber-900 underline hover:text-amber-700">
                        Configurar Resend agora →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
              {emailConfig?.mode === 'real' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span><b>Envio real ativo</b> via Resend. O destinatário vai receber o e-mail.</span>
                </div>
              )}

              <Field label="Destinatário" required>
                <input type="email" required value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder={clientEmail ?? 'cliente@email.com'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm font-mono" />
                {!clientEmail && (
                  <div className="text-xs text-amber-700 mt-1">
                    ⚠️ Cliente sem e-mail cadastrado. Edite a ficha pra salvar permanentemente.
                  </div>
                )}
              </Field>

              <Field label="Assunto">
                <input type="text" value={emailPreview?.subject ?? titulo}
                  onChange={e => {
                    setTitulo(e.target.value);
                    if (emailPreview) setEmailPreview({ ...emailPreview, subject: e.target.value });
                  }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
              </Field>

              <Field label="Corpo (HTML)">
                <textarea rows={8}
                  value={emailPreview?.body_html ?? ''}
                  onChange={e => setEmailPreview(p => p ? { ...p, body_html: e.target.value } : { subject: titulo, body_html: e.target.value })}
                  placeholder="Carregando template…"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-xs font-mono" />
                <div className="text-[10px] text-gray-500 mt-1">
                  Template pré-carregado baseado no perfil <b>{perfil ?? '?'}</b>. Edite à vontade antes de enviar.
                </div>
              </Field>

              {emailResult && (
                <div className={`p-4 rounded-xl border-2 text-sm ${
                  emailResult.really_sent
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : emailResult.mock_simulation
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  {emailResult.really_sent && (
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> E-mail ENVIADO via Resend
                      </div>
                      <div className="text-xs">
                        Destinatário: <code>{emailResult.preview?.to}</code>
                        {emailResult.provider_message_id && <> · ID: <code>{emailResult.provider_message_id}</code></>}
                      </div>
                    </div>
                  )}
                  {emailResult.mock_simulation && (
                    <div className="space-y-2">
                      <div className="font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> SIMULAÇÃO — e-mail NÃO foi enviado
                      </div>
                      <div className="text-xs leading-relaxed">
                        O sistema registrou esta ação no histórico, mas <b>nenhum e-mail saiu</b>.
                        Pra enviar de verdade, configure a chave do Resend em
                        {' '}<Link href="/configuracoes" className="underline font-bold">/configuracoes</Link>.
                      </div>
                    </div>
                  )}
                  {!emailResult.really_sent && !emailResult.mock_simulation && (
                    <div className="font-bold flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> Falha: {emailResult.error}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* === MODO PADRÃO === */}
          {!isEmail && (
            <>
              <Field label="Título" required>
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
            </>
          )}

          {err && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">{err}</div>}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button type="submit" loading={loading} icon={isEmail ? Mail : Plus} uppercase
            disabled={isEmail ? !emailTo.trim() : !titulo.trim()}>
            {loading
              ? (isEmail ? 'Processando…' : 'Salvando…')
              : isEmail
                ? (isMockMode ? 'Simular envio (não envia real)' : 'Enviar e-mail real')
                : 'Salvar ação'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
