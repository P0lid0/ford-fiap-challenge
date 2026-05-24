'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Save, X, Check, Trash2, RefreshCw, FileText, Sparkles, DollarSign, Loader2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ConfianceBadge } from '@/components/SourceBadge';
import { CanonicoBlock } from '@/components/CanonicoBlock';
import { useConfirm } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';

/**
 * Página de detalhe do veículo (concorrência).
 *
 * IMPORTANTE: por solicitação explícita do usuário, esta página NÃO exibe mais
 * blocos separados pra Motor / Transmissão / Desempenho / Dimensões. Toda a
 * ficha técnica está na seção "Especificações canônicas Ford D1" (262
 * atributos em 14 seções) abaixo. O bloco de equipamentos-legado (tags livres)
 * fica colapsado pra compatibilidade.
 */
export default function VeiculoDetalhe() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [v, setV] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingPrice, setRefreshingPrice] = useState(false);
  const [priceMsg, setPriceMsg] = useState<{ tone: 'ok' | 'err'; text: string; diff?: number | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showEbookInput, setShowEbookInput] = useState(false);
  const [ebookUrl, setEbookUrl] = useState('');

  useEffect(() => {
    if (!params.id) return;
    api.getVehicle(params.id).then(d => { setV(d); setDraft(d); }).catch(e => setErr(e.message));
  }, [params.id]);

  async function refreshPrice() {
    const ok = await confirm({
      title: 'Atualizar preço FIPE?',
      message: (
        <>
          Vou consultar a FIPE pra <b>{v.marca} {v.modelo} {v.versao} · {v.ano}</b>
          {' '}e atualizar só o preço (e o mês de referência). Specs e equipamentos não mudam.
        </>
      ),
      details: <>Sem custo de IA — só a consulta gratuita à API FIPE.</>,
      confirmLabel: 'Sim, consultar FIPE',
      cancelLabel: 'Cancelar',
      variant: 'info',
    });
    if (!ok) return;
    setRefreshingPrice(true); setPriceMsg(null); setErr(null);
    try {
      const r = await api.refreshVehiclePrice(v.id);
      setV((curr: any) => ({ ...curr, ...r.vehicle }));
      setDraft((curr: any) => ({ ...curr, ...r.vehicle }));
      setPriceMsg({
        tone: 'ok',
        text: r.preco_antigo == null
          ? `Preço inicial: R$ ${r.preco_novo.toLocaleString('pt-BR')} (ref ${r.mes_referencia})`
          : r.diff === 0
            ? `Preço mantido (ref ${r.mes_referencia})`
            : `Atualizado de R$ ${r.preco_antigo.toLocaleString('pt-BR')} → R$ ${r.preco_novo.toLocaleString('pt-BR')} (ref ${r.mes_referencia})`,
        diff: r.diff,
      });
      setTimeout(() => setPriceMsg(null), 8000);
    } catch (e: any) {
      const msg = e.message ?? String(e);
      setPriceMsg({ tone: 'err', text: msg.includes('not_in_fipe')
        ? 'FIPE não tem essa combinação cadastrada — preço não disponível'
        : msg.includes('fipe_unavailable')
          ? 'FIPE indisponível no momento. Tente novamente em alguns segundos.'
          : msg.slice(0, 120) });
    } finally { setRefreshingPrice(false); }
  }

  async function refresh(opts?: { ebook_url?: string; skip_ebook?: boolean }) {
    const ok = await confirm({
      title: 'Reanalisar o veículo?',
      message: (
        <>
          Vou consultar FIPE + e-book + site oficial + IA pra atualizar
          {' '}<b>{v.marca} {v.modelo} {v.versao}</b>. Pode levar alguns segundos e
          consome créditos de IA paga.
        </>
      ),
      details: opts?.ebook_url ? <>Vou usar o PDF: <code className="break-all">{opts.ebook_url}</code></> : undefined,
      confirmLabel: 'Sim, reanalisar',
      cancelLabel: 'Cancelar',
      variant: 'ai',
    });
    if (!ok) return;
    setRefreshing(true); setErr(null);
    try {
      const updated = await api.refreshVehicle(v.id, opts);
      setV(updated); setDraft(updated);
      setShowEbookInput(false); setEbookUrl('');
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setRefreshing(false); }
  }

  async function remove() {
    const ok = await confirm({
      title: `Excluir ${v.marca} ${v.modelo} ${v.versao}?`,
      message: (
        <>
          Esta ação é <b>permanente</b> — o veículo, seus {' '}
          <b>262 valores canônicos</b> e todas as comparações que o usam
          serão removidos. Não dá pra desfazer.
        </>
      ),
      confirmLabel: 'Sim, excluir definitivamente',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    setDeleting(true); setErr(null);
    try {
      await api.deleteVehicle(v.id);
      router.push('/veiculos');
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setDeleting(false);
    }
  }

  async function save() {
    const ok = await confirm({
      title: 'Salvar alterações?',
      message: <>Vou gravar as alterações em <b>{v.marca} {v.modelo} {v.versao}</b>.</>,
      confirmLabel: 'Sim, salvar',
      cancelLabel: 'Voltar a editar',
      variant: 'info',
    });
    if (!ok) return;
    setSaving(true); setErr(null);
    try {
      const patch: any = {};
      for (const k of ['marca', 'modelo', 'versao', 'ano', 'categoria', 'preco_brl', 'pais_origem', 'notas']) {
        if (draft[k] !== v[k]) patch[k] = draft[k];
      }
      const updated = await api.updateVehicle(v.id, patch);
      setV(updated); setDraft(updated);
      setEditing(false);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  async function cancelEdit() {
    const hasChanges = ['marca', 'modelo', 'versao', 'ano', 'categoria', 'preco_brl', 'pais_origem', 'notas']
      .some(k => draft[k] !== v[k]);
    if (hasChanges) {
      const ok = await confirm({
        title: 'Descartar alterações?',
        message: 'Você tem mudanças não salvas. Elas vão ser perdidas.',
        confirmLabel: 'Sim, descartar',
        cancelLabel: 'Continuar editando',
        variant: 'warning',
      });
      if (!ok) return;
    }
    setEditing(false);
    setDraft(v);
  }

  if (!v || !draft) return <Shell><div className="p-8 text-gray-500">{err || 'Carregando…'}</div></Shell>;

  return (
    <Shell>
      <div className="p-8 max-w-5xl mx-auto">
        {dialog}

        <Link href="/veiculos" className="inline-flex items-center gap-2 text-gray-600 hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar ao catálogo
        </Link>

        {/* Cabeçalho */}
        <div className="bg-gradient-to-br from-ford-blue to-ford-blue-light text-white rounded-2xl p-8 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-gray-300 mb-2">{v.marca}</div>
              <h1 className="text-4xl font-bold">{v.modelo} {v.versao}</h1>
              <p className="text-gray-200 mt-2 text-lg">{v.ano} · {v.categoria}</p>

              {/* Preço + botão atualizar FIPE */}
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                {v.preco_brl ? (
                  <>
                    <p className="text-3xl font-black">R$ {v.preco_brl.toLocaleString('pt-BR')}</p>
                    <div className="flex flex-col">
                      {v.fipe_codigo && (
                        <span className="text-[10px] uppercase tracking-wider text-gray-300">
                          FIPE oficial · {v.fipe_mes_referencia ?? 'sem ref'}
                        </span>
                      )}
                      <button onClick={refreshPrice} disabled={refreshingPrice || !editing && refreshing}
                        title="Atualizar preço com FIPE atual"
                        className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/30 rounded-lg text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 self-start">
                        {refreshingPrice
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <RefreshCw className="w-3 h-3" />}
                        {refreshingPrice ? 'Consultando FIPE…' : 'Atualizar FIPE'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={refreshPrice} disabled={refreshingPrice}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-ford-blue font-bold rounded-xl hover:bg-gray-100 transition disabled:opacity-50 uppercase tracking-wider text-sm">
                    {refreshingPrice
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <DollarSign className="w-4 h-4" />}
                    {refreshingPrice ? 'Consultando FIPE…' : 'Buscar preço FIPE'}
                  </button>
                )}
              </div>

              {priceMsg && (
                <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                  priceMsg.tone === 'ok'
                    ? (priceMsg.diff != null && priceMsg.diff > 0)
                      ? 'bg-rose-500/20 text-rose-100'
                      : (priceMsg.diff != null && priceMsg.diff < 0)
                        ? 'bg-emerald-500/20 text-emerald-100'
                        : 'bg-white/20 text-white'
                    : 'bg-rose-500/30 text-rose-100'
                }`}>
                  {priceMsg.tone === 'err' && <AlertCircle className="w-3.5 h-3.5" />}
                  {priceMsg.tone === 'ok' && priceMsg.diff != null && priceMsg.diff > 0 && <TrendingUp className="w-3.5 h-3.5" />}
                  {priceMsg.tone === 'ok' && priceMsg.diff != null && priceMsg.diff < 0 && <TrendingDown className="w-3.5 h-3.5" />}
                  <span>
                    {priceMsg.text}
                    {priceMsg.tone === 'ok' && priceMsg.diff != null && priceMsg.diff !== 0 && (
                      <span className="ml-1">
                        ({priceMsg.diff > 0 ? '+' : '−'}R$ {Math.abs(priceMsg.diff).toLocaleString('pt-BR')})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <ConfianceBadge confianca={v.confianca_geral ?? 'baixa'} />
              {v.verificado_manualmente && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-[10px] uppercase tracking-wider font-bold">
                  <Check className="w-3 h-3" /> Verificado humano
                </span>
              )}
              {!editing ? (
                <div className="flex flex-wrap gap-2 justify-end">
                  <button onClick={() => refresh()} disabled={refreshing}
                    title="Re-busca FIPE + e-book oficial + site + IA"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 border border-white/30 rounded-xl text-sm transition disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Reanalisando…' : 'Reanalisar'}
                  </button>
                  <button onClick={() => setShowEbookInput(s => !s)} disabled={refreshing}
                    title="Reanalisar usando URL custom do PDF do e-book oficial"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 border border-white/30 rounded-xl text-sm transition disabled:opacity-50">
                    <FileText className="w-4 h-4" />
                    <span className="hidden md:inline">E-book PDF</span>
                  </button>
                  <button onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 border border-white/30 rounded-xl text-sm transition">
                    <Pencil className="w-4 h-4" /> Editar
                  </button>
                  <button onClick={remove} disabled={deleting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/30 hover:bg-red-500/50 border border-red-300/50 rounded-xl text-sm transition disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> {deleting ? 'Excluindo…' : 'Excluir'}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={cancelEdit}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 border border-white/30 rounded-xl text-sm transition">
                    <X className="w-4 h-4" /> Cancelar
                  </button>
                  <button onClick={save} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-ford-blue font-bold rounded-xl text-sm transition disabled:opacity-50">
                    <Save className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {err && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4">{err}</div>}

        {/* E-book PDF refresh */}
        {showEbookInput && !editing && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-5 mb-4">
            <div className="flex items-start gap-3 mb-3">
              <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">Reanalisar usando e-book oficial (PDF)</h3>
                <p className="text-sm text-gray-700">
                  Cole a URL do PDF do e-book/catálogo do site da fabricante. A IA vai extrair specs e
                  equipamentos completos por trim — fonte mais autoritativa que o HTML. Custo: ~$0.50-1.00 (Anthropic).
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Ex Ford: <code className="bg-white/60 px-1 rounded">https://www.ford.com.br/.../fbr-f-150-e-book.pdf</code>
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input type="url" value={ebookUrl} onChange={e => setEbookUrl(e.target.value)}
                placeholder="https://www.{marca}.com.br/.../catalogo.pdf"
                className="flex-1 min-w-[280px] px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm font-mono" />
              <button onClick={() => refresh({ ebook_url: ebookUrl })} disabled={refreshing || !ebookUrl}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-ford-blue to-ford-blue-light text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 text-sm">
                <Sparkles className="w-4 h-4" /> {refreshing ? 'Analisando…' : 'Reanalisar do PDF'}
              </button>
              <button onClick={() => { setShowEbookInput(false); setEbookUrl(''); }}
                className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm hover:bg-white">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Fontes consultadas */}
        {v.fontes?.length > 0 && (() => {
          const webCitations: string[] = v.fontes.filter((f: string) => f.startsWith('web:')).map((f: string) => f.slice(4));
          const otherFontes: string[] = v.fontes.filter((f: string) => !f.startsWith('web:'));
          return (
            <div className="bg-white rounded-2xl border border-gray-300 p-5 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">Fontes consultadas</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                {otherFontes.map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-success">•</span>
                    <code className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{f}</code>
                  </li>
                ))}
              </ul>
              {webCitations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">
                    ⚡ Páginas consultadas pela IA via web search ({webCitations.length})
                  </h4>
                  <ul className="space-y-1">
                    {webCitations.slice(0, 10).map((url: string, i: number) => (
                      <li key={i} className="text-xs">
                        <a href={url} target="_blank" rel="noreferrer"
                          className="text-blue-600 hover:underline truncate inline-block max-w-full">
                          {url.replace(/^https?:\/\//, '').slice(0, 80)}
                        </a>
                      </li>
                    ))}
                    {webCitations.length > 10 && (
                      <li className="text-xs text-gray-500">+ {webCitations.length - 10} outras</li>
                    )}
                  </ul>
                </div>
              )}
              {v.fipe_codigo && (
                <p className="text-xs text-gray-500 mt-3">FIPE: {v.fipe_codigo} · {v.fipe_mes_referencia}</p>
              )}
            </div>
          );
        })()}

        {/* Edição dos campos identificadores (sem o bloco de specs duplicadas) */}
        {editing && (
          <div className="bg-white rounded-2xl border border-gray-300 p-6 mb-4">
            <h2 className="text-lg font-bold text-ford-blue mb-4">Identificação</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              {[
                ['Marca', 'marca'],
                ['Modelo', 'modelo'],
                ['Versão', 'versao'],
                ['Ano', 'ano'],
                ['Categoria', 'categoria'],
                ['Preço (R$)', 'preco_brl'],
                ['País de origem', 'pais_origem'],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                  <div className="text-sm text-gray-600">{label}</div>
                  <input
                    value={draft[key] ?? ''}
                    onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                    className="w-40 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:border-ford-blue" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === SCHEMA CANÔNICO FORD D1 (262 atributos × 14 seções) ===
            ÚNICA fonte de verdade pra ficha técnica do veículo. */}
        <CanonicoBlock vehicleId={v.id} />

        {/* Notas */}
        {(v.notas || editing) && (
          <div className="bg-white rounded-2xl border border-gray-300 p-6">
            <h2 className="text-lg font-bold text-ford-blue mb-3">Observações</h2>
            {editing ? (
              <textarea rows={3} value={draft.notas ?? ''}
                onChange={e => setDraft({ ...draft, notas: e.target.value })}
                placeholder="Notas sobre este veículo, fonte de verificação, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{v.notas}</p>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
