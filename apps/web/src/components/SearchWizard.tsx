'use client';
import { useEffect, useState } from 'react';
import { ChevronRight, Loader2, Sparkles, ArrowLeft, CheckCircle, Globe, Cpu } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Wizard de busca em cascata FIPE:
 *   1. Marca (FIPE - 107 opções)
 *   2. Modelo base (Ranger, Corolla, etc — agrupado da FIPE)
 *   3. Versão (Ranger Raptor 3.0 V6, Ranger XLT 3.2, etc — FIPE specific)
 *   4. Ano (>= 2010)
 *   5. Backend faz aggregação (FIPE + site oficial + IA) e cacheia
 */
export function SearchWizard({ onComplete, onCancel }: {
  onComplete: (vehicle: any) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [marcas, setMarcas] = useState<{ codigo: string; nome: string; tem_scraping: boolean }[]>([]);
  const [marca, setMarca] = useState<{ codigo: string; nome: string; tem_scraping: boolean } | null>(null);
  const [grupos, setGrupos] = useState<{ base: string; versoes: { codigo: number; nome: string }[]; count: number }[]>([]);
  const [base, setBase] = useState<{ base: string; versoes: { codigo: number; nome: string }[] } | null>(null);
  const [versao, setVersao] = useState<{ codigo: number; nome: string } | null>(null);
  const [anos, setAnos] = useState<{ codigo: string; nome: string }[]>([]);
  const [ano, setAno] = useState<{ codigo: string; nome: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [marcaQuery, setMarcaQuery] = useState('');
  const [baseQuery, setBaseQuery] = useState('');

  useEffect(() => {
    api.listMarcas().then(setMarcas).catch(e => setErr(e.message));
  }, []);

  async function pickMarca(m: typeof marca) {
    if (!m) return;
    setMarca(m); setLoading(true); setErr(null);
    try {
      const g = await api.fipeModelosAgrupados(m.codigo);
      setGrupos(g);
      setStep(2);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setLoading(false); }
  }

  function pickBase(b: typeof base) {
    if (!b) return;
    setBase(b);
    setStep(3);
  }

  async function pickVersao(v: typeof versao) {
    if (!v || !marca) return;
    setVersao(v); setLoading(true); setErr(null);
    try {
      const a = await api.fipeAnos(marca.codigo, v.codigo);
      if (a.length === 0) {
        setErr('Esta versão não tem anos disponíveis desde 2010.');
        return;
      }
      setAnos(a);
      setStep(4);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setLoading(false); }
  }

  async function pickAno(a: typeof ano) {
    if (!a || !marca || !versao) return;
    setAno(a); setLoading(true); setErr(null);
    try {
      const r = await api.searchByFipe({
        marca_codigo: marca.codigo,
        modelo_codigo: versao.codigo,
        ano_codigo: a.codigo,
      });
      onComplete(r.vehicle);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setLoading(false); }
  }

  function back() {
    setErr(null);
    if (step === 4) { setAno(null); setStep(3); }
    else if (step === 3) { setVersao(null); setStep(2); }
    else if (step === 2) { setBase(null); setStep(1); }
  }

  // Filtros de busca dentro de cada step
  const marcasFiltradas = marcaQuery
    ? marcas.filter(m => m.nome.toLowerCase().includes(marcaQuery.toLowerCase()))
    : marcas;
  const gruposFiltrados = baseQuery
    ? grupos.filter(g => g.base.toLowerCase().includes(baseQuery.toLowerCase()))
    : grupos;
  // Ordena marcas: scraping first
  const marcasOrdenadas = [...marcasFiltradas].sort((a, b) => {
    if (a.tem_scraping !== b.tem_scraping) return a.tem_scraping ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });

  return (
    <div className="bg-white border-2 border-ford-blue rounded-2xl p-6 mb-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-5 flex-wrap">
        <span className={step >= 1 ? 'font-semibold text-ford-blue' : ''}>1. Marca</span>
        {marca && <><ChevronRight className="w-3 h-3" /><span className="text-gray-900 font-medium">{marca.nome}</span></>}
        {step >= 2 && !marca && <ChevronRight className="w-3 h-3" />}
        {step >= 2 && <><ChevronRight className="w-3 h-3" /><span className={step >= 2 ? 'font-semibold text-ford-blue' : ''}>2. Modelo</span></>}
        {base && <><ChevronRight className="w-3 h-3" /><span className="text-gray-900 font-medium">{base.base}</span></>}
        {step >= 3 && <><ChevronRight className="w-3 h-3" /><span className={step >= 3 ? 'font-semibold text-ford-blue' : ''}>3. Versão</span></>}
        {versao && <><ChevronRight className="w-3 h-3" /><span className="text-gray-900 font-medium truncate max-w-xs">{versao.nome}</span></>}
        {step >= 4 && <><ChevronRight className="w-3 h-3" /><span className={step >= 4 ? 'font-semibold text-ford-blue' : ''}>4. Ano</span></>}
      </div>

      {err && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-xl mb-4 text-sm">{err}</div>}

      {/* STEP 1: Marca */}
      {step === 1 && (
        <div>
          <h3 className="font-bold text-gray-900 mb-2">Selecione a marca</h3>
          <p className="text-sm text-gray-600 mb-4">
            🟢 Globo = marca com scraping do site oficial (alta confiança).
          </p>
          <input autoFocus placeholder="Buscar marca…" value={marcaQuery} onChange={e => setMarcaQuery(e.target.value)}
            className="w-full mb-3 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
          <div className="max-h-96 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {marcasOrdenadas.map(m => (
              <button key={m.codigo + m.nome} onClick={() => pickMarca(m)}
                className="text-left flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 hover:border-ford-blue hover:bg-ford-blue/5 transition">
                {m.tem_scraping ? <Globe className="w-3.5 h-3.5 text-success" /> : <Cpu className="w-3.5 h-3.5 text-gray-400" />}
                <span className="text-sm">{m.nome}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Modelo base */}
      {step === 2 && (
        <div>
          <button onClick={back} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ford-blue mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <h3 className="font-bold text-gray-900 mb-2">Modelos da {marca?.nome} (a partir de 2010)</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando FIPE…</div>
          ) : (
            <>
              <input autoFocus placeholder="Buscar modelo…" value={baseQuery} onChange={e => setBaseQuery(e.target.value)}
                className="w-full mb-3 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
              <div className="max-h-96 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {gruposFiltrados.map(g => (
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

      {/* STEP 3: Versão */}
      {step === 3 && (
        <div>
          <button onClick={back} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ford-blue mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <h3 className="font-bold text-gray-900 mb-2">Versões do {marca?.nome} {base?.base}</h3>
          <p className="text-sm text-gray-600 mb-3">Escolha a versão exata (motor, câmbio, configuração).</p>
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

      {/* STEP 4: Ano */}
      {step === 4 && (
        <div>
          <button onClick={back} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ford-blue mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <h3 className="font-bold text-gray-900 mb-2">Ano modelo</h3>
          <p className="text-sm text-gray-600 mb-3">
            Selecione o ano. Ao confirmar, o sistema busca FIPE + site oficial + IA.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando dados oficiais e enriquecendo com IA…
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {anos.map(a => {
                const anoNum = a.codigo.slice(0, 4);
                return (
                  <button key={a.codigo} onClick={() => pickAno(a)}
                    className="px-4 py-3 rounded-xl border border-gray-300 hover:border-ford-blue hover:bg-ford-blue/5 transition font-bold">
                    {anoNum}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
        <button onClick={onCancel} className="hover:text-gray-900">Cancelar</button>
        <span>Fonte primária: tabela FIPE oficial · maio/2026</span>
      </div>
    </div>
  );
}
