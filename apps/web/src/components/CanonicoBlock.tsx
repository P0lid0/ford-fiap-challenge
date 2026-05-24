'use client';
/**
 * Renderiza os 262 atributos canônicos Ford D1 (14 seções) pra UM veículo:
 *  - Modo leitura: ✓/✗ pra flags, valor pra numeric/text, "não disponível" pra null.
 *  - Modo edição inline: switch pra flags, input pra numeric/text.
 *  - Botão "Preencher com IA" — POST .../catalog-values/auto-fill (overwrite=false por padrão).
 *
 * Pedido explícito da Ford no slide "Desafio - Direcional do Projeto":
 *   • Formato sempre o mesmo, independente do veículo
 *   • Campos claros, organizados e comparáveis
 *   • Quando info não existe, ficar explícito (vazio / não disponível)
 */
import { useEffect, useState, useRef } from 'react';
import {
  ChevronDown, ChevronRight, Check, X as XIcon, Sparkles, Loader2,
  Pencil, Save, Database, AlertCircle, RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useConfirm } from './ConfirmDialog';

type Item = {
  item_id: string;
  nome: string;
  ordem: number;
  ordem_global: number;
  tipo: 'flag' | 'numeric' | 'text' | 'choice';
  unidade: string | null;
  valor: string | null;
  confianca: string | null;
  fonte: string | null;
};

type Section = {
  secao: string;
  count: number;
  filled: number;
  items: Item[];
};

type Catalog = {
  vehicle: any;
  total_items: number;
  filled: number;
  sections: Section[];
};

export function CanonicoBlock({ vehicleId }: { vehicleId: string }) {
  const { confirm, dialog } = useConfirm();
  const [data, setData] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [showEmpty, setShowEmpty] = useState(true);
  const [autoFillResult, setAutoFillResult] = useState<string | null>(null);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  // fecha menu ao clicar fora
  useEffect(() => {
    if (!showAiMenu) return;
    function handle(e: MouseEvent) {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setShowAiMenu(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showAiMenu]);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const d = await api.getVehicleCatalogValues(vehicleId);
      setData(d);
      // sincroniza draft
      const map: Record<string, string | null> = {};
      for (const s of d.sections) for (const it of s.items) map[it.item_id] = it.valor;
      setDraft(map);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [vehicleId]);

  function setValor(itemId: string, valor: string | null) {
    setDraft(d => ({ ...d, [itemId]: valor }));
  }

  async function save() {
    if (!data) return;
    // só envia o que mudou
    const changes: Array<{ item_id: string; valor: string | null }> = [];
    for (const s of data.sections) {
      for (const it of s.items) {
        const novo = draft[it.item_id] ?? null;
        const atual = it.valor ?? null;
        if ((novo ?? '') !== (atual ?? '')) {
          changes.push({ item_id: it.item_id, valor: novo });
        }
      }
    }
    if (changes.length === 0) {
      setEditing(false);
      return;
    }
    const ok = await confirm({
      title: `Salvar ${changes.length} alteração${changes.length === 1 ? '' : 'ões'} nos atributos canônicos?`,
      message: <>Vou gravar as mudanças no schema canônico desse veículo (X / 0 / valor / não disponível).</>,
      confirmLabel: `Sim, salvar ${changes.length}`,
      cancelLabel: 'Voltar a editar',
      variant: 'info',
    });
    if (!ok) return;
    setSaving(true); setErr(null);
    try {
      await api.updateVehicleCatalogValues(vehicleId, changes);
      setEditing(false);
      await load();
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  async function cancelEdit() {
    if (!data) { setEditing(false); return; }
    // detecta se houve mudanças
    let hasChanges = false;
    for (const s of data.sections) {
      for (const it of s.items) {
        const novo = draft[it.item_id] ?? null;
        const atual = it.valor ?? null;
        if ((novo ?? '') !== (atual ?? '')) { hasChanges = true; break; }
      }
      if (hasChanges) break;
    }
    if (hasChanges) {
      const ok = await confirm({
        title: 'Descartar alterações?',
        message: 'Você editou atributos canônicos. Se cancelar agora, as mudanças vão ser perdidas.',
        confirmLabel: 'Sim, descartar',
        cancelLabel: 'Continuar editando',
        variant: 'warning',
      });
      if (!ok) return;
    }
    setEditing(false);
    await load();
  }

  async function autoFill(mode: 'fill-empty' | 'refresh-all') {
    setShowAiMenu(false);
    if (!data) return;
    const vazios = data.total_items - data.filled;
    const isRefresh = mode === 'refresh-all';

    const ok = await confirm({
      title: isRefresh
        ? `Refazer TODOS os ${data.total_items} atributos com IA?`
        : `Preencher os ${vazios} atributos vazios com IA?`,
      message: isRefresh ? (
        <>
          A IA vai propor valores pros <b>262 atributos</b>, <b>sobrescrevendo</b>
          {' '}inclusive o que você já preencheu manualmente. Use só quando quiser
          {' '}um draft completamente novo (ex: depois de mudar a versão do veículo).
        </>
      ) : (
        <>
          A IA vai propor valores apenas pros <b>{vazios} atributos vazios</b>
          {' '}(&quot;não disponível&quot;). <b>Não sobrescreve</b> o que você já preencheu manualmente
          {' '}— os {data.filled} atributos atuais ficam intactos.
        </>
      ),
      details: (
        <>
          Custo estimado: <b>$0.02–0.05</b> por execução (Anthropic/OpenAI/Gemini).
          {' '}Valores propostos pela IA ficam marcados com confiança <b>baixa</b> e fonte
          <code className="mx-1">ai:auto-fill</code>— revise antes de comparar.
          {isRefresh && (
            <div className="mt-2 text-rose-700 font-bold">
              ⚠ Ação destrutiva: valores manuais existentes serão perdidos.
            </div>
          )}
        </>
      ),
      confirmLabel: isRefresh ? 'Sim, refazer tudo' : `Sim, preencher ${vazios}`,
      cancelLabel: 'Cancelar',
      variant: isRefresh ? 'danger' : 'ai',
    });
    if (!ok) return;
    setAutoFilling(true); setErr(null); setAutoFillResult(null);
    try {
      const r = await api.autoFillVehicleCatalog(vehicleId, isRefresh);
      setAutoFillResult(isRefresh
        ? `IA refez ${r.filled} atributos (modo refresh, sobrescreveu manuais). Total: ${r.total_items}.`
        : `IA preencheu ${r.filled} atributos vazios (manteve ${r.skipped_existing} já preenchidos). Total: ${r.total_items}.`);
      await load();
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setAutoFilling(false); }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-300 p-6 flex items-center gap-3 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando schema canônico Ford D1 (262 atributos)…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
        <AlertCircle className="w-4 h-4 inline mr-2" /> Schema canônico não disponível: {err}
      </div>
    );
  }

  const pctFilled = data.total_items > 0 ? (data.filled / data.total_items) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border-2 border-ford-blue/30 ring-1 ring-ford-blue/10 p-6 mb-4">
      {dialog}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-ford-blue/10 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-ford-blue" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ford-blue">
              Especificações canônicas Ford D1
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.total_items} atributos · {data.sections.length} seções ·
              {' '}<b className={data.filled === data.total_items ? 'text-emerald-600' : 'text-amber-600'}>
                {data.filled}/{data.total_items} preenchidos ({pctFilled.toFixed(0)}%)
              </b>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer mr-2">
            <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)}
              className="w-3.5 h-3.5 accent-ford-blue" />
            Mostrar &quot;não disponível&quot;
          </label>
          {!editing && (
            <>
              {/* Split-button dropdown: clica no botão principal → menu; menu tem 2 opções */}
              <div className="relative" ref={aiMenuRef}>
                <button onClick={() => setShowAiMenu(o => !o)} disabled={autoFilling}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50">
                  {autoFilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {autoFilling ? 'Preenchendo…' : 'Preencher com IA'}
                  {!autoFilling && <ChevronDown className="w-3 h-3" />}
                </button>
                {showAiMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-elevated z-30 overflow-hidden">
                    <button
                      onClick={() => autoFill('fill-empty')}
                      className="w-full text-left px-4 py-3 hover:bg-purple-50 transition flex items-start gap-3 border-b border-gray-100">
                      <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-charcoal text-sm flex items-center gap-1.5">
                          Preencher só os vazios
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase tracking-wider font-bold">recomendado</span>
                        </div>
                        <div className="text-xs text-slate mt-0.5 leading-relaxed">
                          IA propõe valores só pros <b>{data.total_items - data.filled}</b> atributos
                          {' '}sem dado. Os <b>{data.filled}</b> já preenchidos ficam intactos.
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => autoFill('refresh-all')}
                      className="w-full text-left px-4 py-3 hover:bg-rose-50 transition flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-charcoal text-sm flex items-center gap-1.5">
                          Refazer tudo
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 uppercase tracking-wider font-bold">destrutivo</span>
                        </div>
                        <div className="text-xs text-slate mt-0.5 leading-relaxed">
                          IA refaz os <b>{data.total_items}</b> atributos do zero,
                          {' '}<b>sobrescrevendo</b> também o que você editou manualmente.
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-ford-blue text-white text-xs font-bold rounded-lg hover:bg-ford-blue-dark transition">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            </>
          )}
          {editing && (
            <>
              <button onClick={cancelEdit}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* progress bar */}
      <div className="mb-4">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-ford-blue to-emerald-500 transition-all"
            style={{ width: `${pctFilled}%` }} />
        </div>
      </div>

      {autoFillResult && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2 text-xs flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" /> {autoFillResult}
        </div>
      )}
      {err && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" /> {err}
        </div>
      )}

      <div className="space-y-3">
        {data.sections.map(s => (
          <SectionBlock
            key={s.secao}
            section={s}
            draft={draft}
            editing={editing}
            showEmpty={showEmpty}
            onChange={setValor}
          />
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500 leading-relaxed">
        <b>Schema fixo Ford 26MY:</b> os mesmos {data.total_items} atributos pra qualquer veículo,
        independente da marca/modelo. Atributos sem valor aparecem como <b>&quot;não disponível&quot;</b> —
        explicitando lacunas em vez de escondê-las (requisito do D1).
      </div>
    </div>
  );
}

function SectionBlock({ section, draft, editing, showEmpty, onChange }: {
  section: Section;
  draft: Record<string, string | null>;
  editing: boolean;
  showEmpty: boolean;
  onChange: (itemId: string, valor: string | null) => void;
}) {
  const [open, setOpen] = useState(section.filled > 0);

  const visibleItems = showEmpty
    ? section.items
    : section.items.filter(it => {
        const v = editing ? draft[it.item_id] : it.valor;
        return v != null && String(v).trim() !== '';
      });

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className="font-bold text-gray-900">
            {section.secao === '(sem secao)' ? 'Motorização & Tração' : section.secao}
          </span>
          <span className={`text-xs ml-2 ${section.filled === section.count ? 'text-emerald-600' : 'text-amber-600'}`}>
            {section.filled}/{section.count}
          </span>
        </div>
      </button>
      {open && visibleItems.length > 0 && (
        <div className="divide-y divide-gray-100">
          {visibleItems.map(it => (
            <ItemRow key={it.item_id} item={it}
              value={draft[it.item_id] ?? null}
              editing={editing}
              onChange={(v: string | null) => onChange(it.item_id, v)} />
          ))}
        </div>
      )}
      {open && visibleItems.length === 0 && (
        <div className="px-4 py-3 text-xs text-gray-400 italic text-center">
          Nenhum atributo preenchido nesta seção.
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, value, editing, onChange }: {
  item: Item;
  value: string | null;
  editing: boolean;
  onChange: (v: string | null) => void;
}) {
  const isEmpty = value == null || String(value).trim() === '';

  return (
    <div className="px-4 py-2 flex items-center justify-between gap-4 hover:bg-gray-50/50">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800">
          {item.nome}
          {item.unidade && <span className="text-xs text-gray-400 ml-1">({item.unidade})</span>}
        </div>
        {item.fonte && !editing && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            {item.fonte}
            {item.confianca && <span className="ml-1">· confiança {item.confianca}</span>}
          </div>
        )}
      </div>
      <div className="flex-shrink-0">
        {editing ? (
          <EditCell item={item} value={value} onChange={onChange} />
        ) : (
          <ViewCell tipo={item.tipo} valor={value} />
        )}
      </div>
      {!editing && isEmpty && (
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold flex-shrink-0">
          não disponível
        </span>
      )}
    </div>
  );
}

function ViewCell({ tipo, valor }: { tipo: string; valor: string | null }) {
  if (valor == null || String(valor).trim() === '') {
    return <span className="text-gray-300 text-sm">—</span>;
  }
  const s = String(valor).trim();
  if (tipo === 'flag') {
    if (s.toUpperCase() === 'X') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-sm">
          <Check className="w-4 h-4" /> tem
        </span>
      );
    }
    if (s === '0') {
      return (
        <span className="inline-flex items-center gap-1 text-gray-400 text-sm">
          <XIcon className="w-4 h-4" /> não tem
        </span>
      );
    }
  }
  return <span className="text-sm font-mono text-gray-900">{s}</span>;
}

function EditCell({ item, value, onChange }: {
  item: Item;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  if (item.tipo === 'flag') {
    const v = (value ?? '').toUpperCase();
    return (
      <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
        <button onClick={() => onChange('X')}
          className={`px-2 py-1 text-xs font-bold ${v === 'X' ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
          ✓ tem
        </button>
        <button onClick={() => onChange('0')}
          className={`px-2 py-1 text-xs font-bold ${v === '0' ? 'bg-gray-700 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
          ✗ não tem
        </button>
        <button onClick={() => onChange(null)}
          className={`px-2 py-1 text-[10px] uppercase ${value == null ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-50'}`}>
          n/d
        </button>
      </div>
    );
  }
  return (
    <input type={item.tipo === 'numeric' ? 'number' : 'text'} step="any"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
      placeholder="—"
      className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm font-mono focus:outline-none focus:border-ford-blue" />
  );
}
