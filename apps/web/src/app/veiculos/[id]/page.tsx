'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Save, X, Check, Trash2, RefreshCw, FileText, Sparkles } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ConfianceBadge, SourceBadge } from '@/components/SourceBadge';
import { api } from '@/lib/api';

const SPEC_GROUPS: Array<[string, string, Array<[string, string, string?]>]> = [
  ['Motor', 'motor', [
    ['Cilindrada (cc)', 'cilindrada_cc', 'number'],
    ['Potência (cv)', 'potencia_cv', 'number'],
    ['Torque (Nm)', 'torque_nm', 'number'],
    ['Combustível', 'combustivel'],
    ['Aspiração', 'aspiracao'],
    ['Cilindros', 'cilindros', 'number'],
  ]],
  ['Transmissão', 'transmissao', [
    ['Tipo', 'tipo'],
    ['Marchas', 'marchas', 'number'],
    ['Tração', 'tracao'],
  ]],
  ['Desempenho', 'desempenho', [
    ['0-100 km/h (s)', 'aceleracao_0_100_s', 'number'],
    ['Vel. máxima (km/h)', 'velocidade_max_kmh', 'number'],
    ['Consumo cidade (km/l)', 'consumo_cidade_kml', 'number'],
    ['Consumo estrada (km/l)', 'consumo_estrada_kml', 'number'],
    ['Autonomia (km)', 'autonomia_km', 'number'],
  ]],
  ['Dimensões', 'dimensoes', [
    ['Comprimento (mm)', 'comprimento_mm', 'number'],
    ['Largura (mm)', 'largura_mm', 'number'],
    ['Altura (mm)', 'altura_mm', 'number'],
    ['Entre-eixos (mm)', 'entre_eixos_mm', 'number'],
    ['Vão livre (mm)', 'vao_livre_mm', 'number'],
    ['Peso (kg)', 'peso_kg', 'number'],
    ['Porta-malas (L)', 'capacidade_porta_malas_l', 'number'],
    ['Caçamba (L)', 'capacidade_cacamba_l', 'number'],
    ['Carga (kg)', 'capacidade_carga_kg', 'number'],
    ['Reboque (kg)', 'capacidade_reboque_kg', 'number'],
  ]],
];

export default function VeiculoDetalhe() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [v, setV] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showEbookInput, setShowEbookInput] = useState(false);
  const [ebookUrl, setEbookUrl] = useState('');

  useEffect(() => {
    if (!params.id) return;
    api.getVehicle(params.id).then(d => { setV(d); setDraft(d); }).catch(e => setErr(e.message));
  }, [params.id]);

  function setSpec(group: string, key: string, value: any) {
    setDraft({
      ...draft,
      [group]: { ...(draft[group] ?? {}), [key]: value === '' ? null : (isNaN(Number(value)) ? value : Number(value)) },
    });
  }

  async function refresh(opts?: { ebook_url?: string; skip_ebook?: boolean }) {
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
    setSaving(true); setErr(null);
    try {
      // Envia só os grupos modificados
      const patch: any = {};
      for (const [, group] of SPEC_GROUPS) if (draft[group]) patch[group] = draft[group];
      for (const k of ['marca', 'modelo', 'versao', 'ano', 'categoria', 'preco_brl', 'pais_origem', 'notas']) {
        if (draft[k] !== v[k]) patch[k] = draft[k];
      }
      if (JSON.stringify(draft.equipamentos) !== JSON.stringify(v.equipamentos)) patch.equipamentos = draft.equipamentos;
      const updated = await api.updateVehicle(v.id, patch);
      setV(updated); setDraft(updated);
      setEditing(false);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  if (!v || !draft) return <Shell><div className="p-8 text-gray-500">{err || 'Carregando…'}</div></Shell>;

  const src = (path: string) => v.data_sources?.[path];

  return (
    <Shell>
      <div className="p-8 max-w-5xl mx-auto">
        <Link href="/veiculos" className="inline-flex items-center gap-2 text-gray-600 hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar ao catálogo
        </Link>

        <div className="bg-gradient-to-br from-ford-blue to-ford-blue-light text-white rounded-2xl p-8 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-300 mb-2">{v.marca}</div>
              <h1 className="text-4xl font-bold">{v.modelo} {v.versao}</h1>
              <p className="text-gray-200 mt-2 text-lg">{v.ano} · {v.categoria}</p>
              {v.preco_brl && (
                <p className="text-3xl font-black mt-3">R$ {v.preco_brl.toLocaleString('pt-BR')}</p>
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
                  <button onClick={() => setConfirmDel(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/30 hover:bg-red-500/50 border border-red-300/50 rounded-xl text-sm transition">
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(false); setDraft(v); }}
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

        {confirmDel && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 mb-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-bold text-red-800">Excluir este veículo?</h3>
              <p className="text-sm text-red-700">Esta ação é permanente. Comparações futuras não vão mais incluí-lo.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(false)} disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={remove} disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 transition disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> {deleting ? 'Excluindo…' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        )}

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

        {SPEC_GROUPS.map(([title, group, fields]) => (
          <div key={group} className="bg-white rounded-2xl border border-gray-300 p-6 mb-4">
            <h2 className="text-lg font-bold text-ford-blue mb-4">{title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
              {fields.map(([label, key, type]) => {
                const path = `${group}.${key}`;
                const val = editing ? draft[group]?.[key] : v[group]?.[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-600">{label}</div>
                      <SourceBadge source={src(path)} />
                    </div>
                    {editing ? (
                      <input type={type ?? 'text'}
                        value={val ?? ''}
                        onChange={e => setSpec(group, key, e.target.value)}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:border-ford-blue" />
                    ) : (
                      <div className="font-semibold text-gray-900 text-right">{val ?? '—'}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-2xl border border-gray-300 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-ford-blue">Equipamentos de série</h2>
            <SourceBadge source={src('equipamentos')} />
          </div>
          {editing ? (
            <textarea rows={4} value={(draft.equipamentos ?? []).join('\n')}
              onChange={e => setDraft({ ...draft, equipamentos: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
              placeholder="Um equipamento por linha (snake_case)"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue font-mono text-sm" />
          ) : (
            (() => {
              const grouped: Record<string, string[]> = {};
              for (const raw of (v.equipamentos ?? [])) {
                const m = String(raw).match(/^([a-z_]+):(.+)$/);
                if (m) (grouped[m[1]!] ??= []).push(m[2]!);
                else (grouped['geral'] ??= []).push(raw);
              }
              const catStyle: Record<string, string> = {
                seguranca: 'bg-red-100 text-red-700',
                conforto: 'bg-blue-100 text-blue-700',
                tecnologia: 'bg-purple-100 text-purple-700',
                assistencia: 'bg-cyan-100 text-cyan-700',
                interior: 'bg-amber-100 text-amber-700',
                exterior: 'bg-emerald-100 text-emerald-700',
                cargo: 'bg-orange-100 text-orange-700',
                offroad: 'bg-stone-200 text-stone-700',
                geral: 'bg-gray-100 text-gray-700',
              };
              const keys = Object.keys(grouped).sort();
              if (keys.length === 0) return <span className="text-gray-500 text-sm">Nenhum equipamento cadastrado.</span>;
              return (
                <div className="space-y-4">
                  {keys.map(cat => (
                    <div key={cat}>
                      <div className={`inline-block text-xs font-bold uppercase tracking-wider px-2 py-1 rounded mb-2 ${catStyle[cat] ?? catStyle.geral}`}>
                        {cat.replace(/_/g, ' ')} · {grouped[cat]!.length}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {grouped[cat]!.map((item, i) => (
                          <span key={i} className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-800">
                            {item.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>

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
