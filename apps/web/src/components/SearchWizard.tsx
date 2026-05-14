'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Loader2, Sparkles, ArrowLeft, Globe, Cpu, Edit3 } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Wizard de busca de veículo.
 *
 * Dois caminhos:
 *  1. Fluxo FIPE (recomendado): marca FIPE → modelo agrupado → versão → ano.
 *     Confiabilidade máxima — preço FIPE oficial + scraping site + IA.
 *  2. Texto livre (fallback): para marcas que não aparecem na FIPE.
 *     Usuário digita marca/modelo/versão/ano à mão. Sistema usa pipeline
 *     /search (fuzzy FIPE + manufacturer + IA) com o que conseguir.
 */
type Marca = { codigo: string; nome: string; tem_scraping: boolean };

export function SearchWizard({ onComplete, onCancel }: {
  onComplete: (vehicle: any) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'select_marca' | 'fipe_drill' | 'free_text'>('select_marca');
  const [marcaInput, setMarcaInput] = useState('');
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [marcaSelected, setMarcaSelected] = useState<Marca | null>(null);
  const [freeMarca, setFreeMarca] = useState('');
  const [loadingMarcas, setLoadingMarcas] = useState(true);

  const [step, setStep] = useState<2 | 3 | 4>(2);
  const [grupos, setGrupos] = useState<{ base: string; versoes: { codigo: number; nome: string }[]; count: number }[]>([]);
  const [base, setBase] = useState<{ base: string; versoes: { codigo: number; nome: string }[] } | null>(null);
  const [versao, setVersao] = useState<{ codigo: number; nome: string } | null>(null);
  const [anos, setAnos] = useState<{ codigo: string; nome: string }[]>([]);
  const [baseQuery, setBaseQuery] = useState('');

  const [freeModelo, setFreeModelo] = useState('');
  const [freeVersao, setFreeVersao] = useState('');
  const [freeAno, setFreeAno] = useState(new Date().getFullYear());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listMarcas().then(d => { setMarcas(d); setLoadingMarcas(false); }).catch(e => setErr(e.message));
  }, []);

  const suggestions = useMemo(() => {
    const q = marcaInput.toLowerCase().trim();
    if (!q) return marcas.slice(0, 30);
    return marcas.filter(m => m.nome.toLowerCase().includes(q)).slice(0, 30);
  }, [marcaInput, marcas]);

  const exactMatch = useMemo(() =>
    marcas.find(m => m.nome.toLowerCase() === marcaInput.toLowerCase().trim()),
    [marcaInput, marcas]);

  async function pickMarcaFipe(m: Marca) {
    setMarcaSelected(m); setLoading(true); setErr(null);
    try {
      const g = await api.fipeModelosAgrupados(m.codigo);
      setGrupos(g);
      setMode('fipe_drill'); setStep(2);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setLoading(false); }
  }

  function startFreeText() {
    setFreeMarca(marcaInput.trim());
    setMode('free_text'); setErr(null);
  }

  function pickBase(b: typeof base) { setBase(b); setStep(3); }

  async function pickVersao(v: typeof versao) {
    if (!v || !marcaSelected) return;
    setVersao(v); setLoading(true); setErr(null);
    try {
      const a = await api.fipeAnos(marcaSelected.codigo, v.codigo);
      if (a.length === 0) { setErr('Sem anos >= 2010 para esta versão.'); return; }
      setAnos(a); setStep(4);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setLoading(false); }
  }

  async function pickAno(a: { codigo: string; nome: string }) {
    if (!marcaSelected || !versao) return;
    setLoading(true); setErr(null);
    try {
      const r = await api.searchByFipe({
        marca_codigo: marcaSelected.codigo,
        modelo_codigo: versao.codigo,
        ano_codigo: a.codigo,
      });
      onComplete(r.vehicle);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setLoading(false); }
  }

  async function submitFreeText() {
    if (!freeMarca || !freeModelo) { setErr('Informe marca e modelo no mínimo.'); return; }
    setLoading(true); setErr(null);
    try {
      const r = await api.searchVehicle({
        marca: freeMarca, modelo: freeModelo,
        versao: freeVersao || undefined, ano: freeAno,
        force_refresh: true,
      });
      onComplete(r.vehicle);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setLoading(false); }
  }

  function backToStart() {
    setMode('select_marca'); setMarcaSelected(null); setGrupos([]);
    setBase(null); setVersao(null); setAnos([]); setStep(2); setErr(null);
  }
  function backInDrill() {
    setErr(null);
    if (step === 4) { setVersao(null); setStep(3); }
    else if (step === 3) { setBase(null); setStep(2); }
    else if (step === 2) backToStart();
  }

  return (
    <div className="bg-white border-2 border-ford-blue rounded-2xl p-6 mb-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-5 flex-wrap">
        {mode === 'select_marca' && <span className="font-semibold text-ford-blue">1. Marca</span>}
        {(mode === 'fipe_drill' || mode === 'free_text') && (
          <>
            <button onClick={backToStart} className="hover:text-ford-blue">1. Marca</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 font-medium">{mode === 'free_text' ? freeMarca : marcaSelected?.nome}</span>
            {mode === 'free_text' && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded text-[10px] font-bold uppercase tracking-wider">
                <Edit3 className="w-3 h-3" /> texto livre
              </span>
            )}
          </>
        )}
        {mode === 'fipe_drill' && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span className={step >= 2 ? 'font-semibold text-ford-blue' : ''}>2. Modelo</span>
            {base && <><ChevronRight className="w-3 h-3" /><span className="text-gray-900 font-medium">{base.base}</span></>}
            {step >= 3 && <><ChevronRight className="w-3 h-3" /><span className={step >= 3 ? 'font-semibold text-ford-blue' : ''}>3. Versão</span></>}
            {versao && <><ChevronRight className="w-3 h-3" /><span className="text-gray-900 font-medium truncate max-w-xs">{versao.nome}</span></>}
            {step >= 4 && <><ChevronRight className="w-3 h-3" /><span className={step >= 4 ? 'font-semibold text-ford-blue' : ''}>4. Ano</span></>}
          </>
        )}
      </div>

      {err && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-xl mb-4 text-sm">{err}</div>}

      {/* MODE 1: Marca */}
      {mode === 'select_marca' && (
        <div>
          <h3 className="font-bold text-gray-900 mb-2">Marca do veículo</h3>
          <p className="text-sm text-gray-600 mb-4">
            Selecione na lista (🟢 = site oficial) <strong>ou</strong> digite qualquer marca e prossiga em modo livre.
          </p>
          <input ref={inputRef} autoFocus placeholder="Ex: BYD, Lamborghini, Caoa Chery…"
            value={marcaInput} onChange={e => setMarcaInput(e.target.value)}
            className="w-full mb-3 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-base" />

          {loadingMarcas ? (
            <div className="flex items-center gap-2 text-gray-500 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando lista FIPE…</div>
          ) : (
            <>
              {suggestions.length > 0 && (
                <div className="max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                  {suggestions.map(m => (
                    <button key={m.codigo + m.nome} onClick={() => pickMarcaFipe(m)} disabled={loading}
                      className="text-left flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 hover:border-ford-blue hover:bg-ford-blue/5 transition disabled:opacity-50">
                      {m.tem_scraping ? <Globe className="w-3.5 h-3.5 text-success" /> : <Cpu className="w-3.5 h-3.5 text-gray-400" />}
                      <span className="text-sm">{m.nome}</span>
                    </button>
                  ))}
                </div>
              )}

              {marcaInput.trim() && !exactMatch && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Edit3 className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-bold text-amber-900">"{marcaInput.trim()}" sem match exato na FIPE</div>
                      <div className="text-amber-800">Prossiga em modo livre — sistema tenta FIPE fuzzy + IA + scraping de fabricante.</div>
                    </div>
                  </div>
                  <button onClick={startFreeText} disabled={loading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl text-sm transition disabled:opacity-50 whitespace-nowrap">
                    Buscar mesmo assim →
                  </button>
                </div>
              )}

              {marcaInput.trim() && suggestions.length === 0 && !exactMatch && (
                <p className="text-sm text-gray-500 text-center py-2">Nenhuma marca FIPE bate. Use modo livre acima ↑</p>
              )}
            </>
          )}
        </div>
      )}

      {/* MODE 2: FIPE drill */}
      {mode === 'fipe_drill' && step === 2 && (
        <div>
          <button onClick={backInDrill} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ford-blue mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <h3 className="font-bold text-gray-900 mb-2">Modelos da {marcaSelected?.nome}</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando FIPE…</div>
          ) : (
            <>
              <input autoFocus placeholder="Buscar modelo…" value={baseQuery} onChange={e => setBaseQuery(e.target.value)}
                className="w-full mb-3 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
              <div className="max-h-96 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {grupos.filter(g => !baseQuery || g.base.toLowerCase().includes(baseQuery.toLowerCase())).map(g => (
                  <button key={g.base} onClick={() => pickBase(g)}
                    className="text-left px-4 py-2.5 rounded-xl border border-gray-300 hover:border-ford-blue hover:bg-ford-blue/5 transition">
                    <div className="font-medium text-sm">{g.base}</div>
                    <div className="text-xs text-gray-500">{g.count} versões</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'fipe_drill' && step === 3 && (
        <div>
          <button onClick={backInDrill} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ford-blue mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <h3 className="font-bold text-gray-900 mb-2">Versões do {marcaSelected?.nome} {base?.base}</h3>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {base?.versoes.map(v => (
              <button key={v.codigo} onClick={() => pickVersao(v)}
                className="w-full text-left px-4 py-2.5 rounded-xl border border-gray-300 hover:border-ford-blue hover:bg-ford-blue/5 transition text-sm">
                {v.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'fipe_drill' && step === 4 && (
        <div>
          <button onClick={backInDrill} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ford-blue mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <h3 className="font-bold text-gray-900 mb-2">Ano modelo</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando FIPE + site oficial + IA…
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {anos.map(a => (
                <button key={a.codigo} onClick={() => pickAno(a)}
                  className="px-4 py-3 rounded-xl border border-gray-300 hover:border-ford-blue hover:bg-ford-blue/5 transition font-bold">
                  {a.codigo.slice(0, 4)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODE 3: Texto livre */}
      {mode === 'free_text' && (
        <div>
          <button onClick={backToStart} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ford-blue mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <h3 className="font-bold text-gray-900 mb-1">Busca livre para "{freeMarca}"</h3>
          <p className="text-sm text-gray-600 mb-4">
            Sistema vai usar FIPE fuzzy + scraping de site oficial (se houver) + IA para preencher gaps.
            Cada campo retornado é marcado com sua fonte.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1">Marca</label>
              <input value={freeMarca} onChange={e => setFreeMarca(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1">Modelo *</label>
              <input autoFocus required placeholder="Ex: Dolphin, Tiggo 5, X90 Plus…"
                value={freeModelo} onChange={e => setFreeModelo(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1">Versão</label>
              <input placeholder="Plus, Premium, GT… (opcional)"
                value={freeVersao} onChange={e => setFreeVersao(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-600 mb-1">Ano</label>
              <input type="number" min={2000} max={2030} value={freeAno}
                onChange={e => setFreeAno(Number(e.target.value))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
            </div>
          </div>

          <button onClick={submitFreeText} disabled={loading || !freeModelo}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl transition disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Consultando FIPE + IA…' : 'Buscar e adicionar ao catálogo'}
          </button>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
        <button onClick={onCancel} className="hover:text-gray-900">Cancelar</button>
        <span>FIPE oficial · maio/2026 · IA preenche gaps</span>
      </div>
    </div>
  );
}
