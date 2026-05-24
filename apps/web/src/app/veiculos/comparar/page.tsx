'use client';
/**
 * Página de comparação de veículos — APENAS o schema canônico Ford D1.
 *
 * Removidos por solicitação explícita:
 *   - Tabela "Atributo quantitativo" (data.fields) — duplicava o canônico
 *   - Bloco "Equipamentos — o que diferencia" (data.equipamentos_comparativo) — formato livre legado
 *
 * Sinalização visual de vencedor por linha:
 *   - flag (X / 0):
 *       X → célula verde com ✓ "tem"
 *       0 → célula cinza clara com ✗ "não tem"
 *   - numeric:
 *       maior valor (ou menor, pra "peso", "0-100", "consumo l/100km") → célula verde + 🏆
 *       empate → todos vencedores ganham o destaque
 *   - text:
 *       sem ranking, só mostra o valor
 *   - null / vazio: cinza claro, texto "não disponível"
 */
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Trophy, Sparkles, Loader2, BookOpen, ChevronDown, ChevronRight,
  Check, X as XIcon,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ConfianceBadge } from '@/components/SourceBadge';
import { api } from '@/lib/api';

// ----------------------------------------------------------------
// Heurística de critério: pra quais atributos o MENOR é melhor?
// ----------------------------------------------------------------
function isLowerBetter(nome: string): boolean {
  const n = nome.toLowerCase();
  return (
    n.includes('peso') ||
    n.includes('0-100') ||
    n.includes('0 a 100') ||
    n.includes('aceleração') ||
    n.includes('consumo (l/100') ||
    n.includes('emissão') ||
    n.includes('co2')
  );
}

// Parsing tolerante de número (aceita "9,55" e "9.55")
function parseNum(s: string | null): number | null {
  if (s == null) return null;
  const trimmed = String(s).trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'X' || trimmed === '0') return null;
  const num = Number(trimmed.replace(',', '.'));
  return isNaN(num) ? null : num;
}

// Calcula índices vencedores pra UMA linha (item canônico).
// Para flag: todos os "X" são "vencedores".
// Para numeric: o(s) maior(es) ou menor(es) conforme isLowerBetter.
// Para text/null: nada destacado.
function computeWinnerIndices(item: any): Set<number> {
  const out = new Set<number>();
  if (!item.valores?.length) return out;

  if (item.tipo === 'flag') {
    item.valores.forEach((v: any, i: number) => {
      if (String(v.valor ?? '').trim().toUpperCase() === 'X') out.add(i);
    });
    return out;
  }

  if (item.tipo === 'numeric') {
    const nums = item.valores.map((v: any) => parseNum(v.valor));
    const valid = nums.filter((n: any): n is number => typeof n === 'number');
    if (valid.length < 2) return out;
    const target = isLowerBetter(item.nome) ? Math.min(...valid) : Math.max(...valid);
    nums.forEach((n: number | null, i: number) => {
      if (n === target) out.add(i);
    });
    return out;
  }

  // text / choice → sem ranking
  return out;
}

function ComparePage() {
  const search = useSearchParams();
  const ids = search.get('ids')?.split(',') ?? [];
  const [data, setData] = useState<any>(null);
  const [canonico, setCanonico] = useState<any>(null);
  const [analise, setAnalise] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingCanonico, setLoadingCanonico] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [hideEmpty, setHideEmpty] = useState(false);

  useEffect(() => {
    if (ids.length < 2) return;
    api.compareVehicles(ids).then(setData).catch(console.error);
    setLoadingCanonico(true);
    api.compareVehiclesCanonico(ids).then(setCanonico).finally(() => setLoadingCanonico(false));
  }, [ids.length]);

  async function loadAi() {
    setLoadingAi(true); setAiErr(null);
    try { setAnalise(await api.analyzeComparison(ids)); }
    catch (e: any) { setAiErr(e.message ?? String(e)); }
    finally { setLoadingAi(false); }
  }

  if (!data && !canonico) return <Shell><div className="p-8 text-gray-500">Carregando…</div></Shell>;
  const vehicles = canonico?.vehicles ?? data?.vehicles ?? [];

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
              {vehicles.length} veículos
              {canonico && <> · {canonico.total_items} atributos canônicos Ford D1</>}
            </p>
          </div>
          <button onClick={loadAi} disabled={loadingAi}
            title="Busca dados de venda no Brasil (FENABRAVE/Anfavea) + cruza com equipamentos pra explicar quem vende mais e por quê"
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-ford-blue to-ford-blue-light text-white font-bold rounded-2xl hover:opacity-90 transition disabled:opacity-50">
            {loadingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loadingAi ? 'Buscando vendas BR + analisando (até 45s)…' : 'Análise IA + dados de venda BR'}
          </button>
        </div>

        {/* Confiança por veículo */}
        <div className="mb-6 flex flex-wrap gap-3">
          {vehicles.map((v: any) => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-300 p-3 flex items-center gap-3 text-sm">
              <span className="font-semibold text-gray-900">{v.marca} {v.modelo} {v.versao}</span>
              <ConfianceBadge confianca={v.confianca_geral ?? 'baixa'} />
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-6 flex-wrap text-xs">
            <span className="font-bold text-gray-700 uppercase tracking-wider">Legenda:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100">
                <Check className="w-3 h-3 text-emerald-700" />
              </span>
              <span className="text-gray-700">tem o item</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gray-100">
                <XIcon className="w-3 h-3 text-gray-400" />
              </span>
              <span className="text-gray-700">não tem</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-amber-100">
                <Trophy className="w-3 h-3 text-amber-700" />
              </span>
              <span className="text-gray-700">melhor valor da linha</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-gray-400">
              <span>—</span>
              <span>não disponível</span>
            </span>
          </div>
        </div>

        {/* ANÁLISE IA */}
        {aiErr && (
          <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded-2xl mb-6">{aiErr}</div>
        )}
        {analise && (
          <div className="bg-gradient-to-br from-ford-blue-dark to-ford-blue text-white rounded-2xl p-8 mb-8 shadow-xl">
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold">Análise IA do comparativo</h2>
                <p className="text-xs text-gray-300">
                  {analise.model}
                  {analise.citations && analise.citations.length > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                      ⚡ {analise.citations.length} fontes web consultadas
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="prose prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
              {analise.analise}
            </div>

            {/* Fontes consultadas pela busca web (FENABRAVE, Anfavea, etc) */}
            {analise.citations && analise.citations.length > 0 && (
              <div className="mt-6 pt-5 border-t border-white/20">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 mb-2">
                  ⚡ Fontes consultadas via web search ({analise.citations.length})
                </h3>
                <ul className="space-y-1 text-xs">
                  {analise.citations.slice(0, 12).map((c: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-300 font-bold">{i + 1}.</span>
                      <a href={c.url} target="_blank" rel="noreferrer"
                        className="text-emerald-100 hover:text-white hover:underline truncate inline-block max-w-full">
                        {c.title ?? c.url.replace(/^https?:\/\//, '').slice(0, 80)}
                      </a>
                    </li>
                  ))}
                  {analise.citations.length > 12 && (
                    <li className="text-gray-400 text-[11px]">+ {analise.citations.length - 12} outras</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ===== Schema CANÔNICO Ford D1 — ÚNICA fonte de comparação ===== */}
        {canonico && (
          <div className="bg-white rounded-2xl border border-ford-blue/30 ring-1 ring-ford-blue/10 p-6 mb-8">
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ford-blue/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-ford-blue" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Comparativo Ford 26MY (schema canônico)</h2>
                  <p className="text-xs text-gray-500">
                    {canonico.total_items} atributos · {canonico.sections.length} seções · template oficial Ford D1
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={hideEmpty}
                  onChange={e => setHideEmpty(e.target.checked)}
                  className="w-4 h-4 accent-ford-blue" />
                Ocultar atributos vazios em todos os veículos
              </label>
            </div>

            <div className="space-y-3">
              {canonico.sections.map((s: any) => (
                <CanonicoSection
                  key={s.secao}
                  section={s}
                  vehicles={canonico.vehicles}
                  hideEmpty={hideEmpty}
                />
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500 leading-relaxed">
              <b>Schema canônico:</b> 262 atributos pré-definidos pela Ford no template de Vehicle Data,
              {' '}distribuídos em {canonico.sections.length} seções. Comparação 1:1 padronizada — o
              {' '}<Trophy className="inline w-3 h-3 text-amber-600" /> destaca o melhor valor de cada
              linha (maior por padrão; menor pra peso e 0-100).
            </div>
          </div>
        )}
        {loadingCanonico && !canonico && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8 flex items-center gap-3 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando schema canônico Ford D1 (262 itens)…
          </div>
        )}
      </div>
    </Shell>
  );
}

// ====================================================================
// Seção da tabela canônica (1 das 14 seções, colapsável)
// ====================================================================
function CanonicoSection({ section, vehicles, hideEmpty }: {
  section: any; vehicles: any[]; hideEmpty: boolean;
}) {
  const [open, setOpen] = useState(true);

  const items = hideEmpty
    ? section.items.filter((it: any) =>
        it.valores.some((v: any) => v.valor != null && String(v.valor).trim() !== ''))
    : section.items;

  const filledCount = section.items.filter((it: any) =>
    it.valores.some((v: any) => v.valor != null && String(v.valor).trim() !== '')).length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 flex items-center justify-between text-left transition"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          <span className="font-bold text-gray-900">
            {section.secao === '(sem secao)' ? 'Motorização & Tração' : section.secao}
          </span>
          <span className={`text-xs ml-2 font-bold ${filledCount === section.count ? 'text-emerald-600' : 'text-amber-600'}`}>
            {filledCount}/{section.count} preenchidos
          </span>
        </div>
      </button>
      {open && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-white border-b-2 border-gray-200">
                <th className="text-left px-4 py-3 font-bold text-gray-600 text-xs uppercase tracking-wider w-72 sticky left-0 bg-white z-10">
                  Atributo
                </th>
                {vehicles.map((v: any) => (
                  <th key={v.id} className="px-3 py-3 text-center text-xs font-bold text-gray-900 min-w-[180px] border-l border-gray-100">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide font-normal">{v.marca}</div>
                    <div>{v.modelo} {v.versao}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, i: number) => {
                const winners = computeWinnerIndices(it);
                return (
                  <tr key={it.item_id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-ford-blue-soft/15 transition`}>
                    <td className="px-4 py-2.5 text-gray-800 text-sm sticky left-0 bg-inherit z-10 border-r border-gray-100">
                      <div className="flex items-center gap-2">
                        <span>{it.nome}</span>
                        {it.unidade && <span className="text-[10px] text-gray-400">({it.unidade})</span>}
                      </div>
                    </td>
                    {it.valores.map((v: any, idx: number) => (
                      <CanonicoCell
                        key={idx}
                        valor={v.valor}
                        tipo={it.tipo}
                        unidade={it.unidade}
                        isWinner={winners.has(idx)}
                        winnerCount={winners.size}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && items.length === 0 && (
        <div className="px-4 py-6 text-center text-xs text-gray-400 italic">
          Nenhum atributo preenchido nesta seção.
        </div>
      )}
    </div>
  );
}

// ====================================================================
// Célula individual da tabela canônica — toda a sinalização visual mora aqui
// ====================================================================
function CanonicoCell({ valor, tipo, unidade, isWinner, winnerCount }: {
  valor: string | null;
  tipo: string;
  unidade: string | null;
  isWinner: boolean;
  winnerCount: number;
}) {
  // === vazio ===
  if (valor == null || String(valor).trim() === '') {
    return (
      <td className="px-3 py-2.5 text-center border-l border-gray-100">
        <span className="text-[10px] uppercase tracking-wider text-gray-300 font-bold">
          não disp.
        </span>
      </td>
    );
  }

  const s = String(valor).trim();

  // === flag ===
  if (tipo === 'flag') {
    if (s.toUpperCase() === 'X') {
      return (
        <td className="px-3 py-2.5 text-center bg-emerald-50/70 border-l border-emerald-100">
          <div className="inline-flex items-center justify-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500">
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </span>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">tem</span>
          </div>
        </td>
      );
    }
    if (s === '0') {
      return (
        <td className="px-3 py-2.5 text-center bg-gray-50/50 border-l border-gray-100">
          <div className="inline-flex items-center justify-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-200">
              <XIcon className="w-3.5 h-3.5 text-gray-400" strokeWidth={3} />
            </span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">não</span>
          </div>
        </td>
      );
    }
    // valor inesperado pra flag → trata como text
  }

  // === numeric: destaque ao vencedor com troféu ===
  if (tipo === 'numeric') {
    const isUniqueWinner = isWinner && winnerCount === 1;
    return (
      <td className={`px-3 py-2.5 text-center border-l ${
        isUniqueWinner
          ? 'bg-amber-50 border-amber-100'
          : isWinner
            ? 'bg-emerald-50/60 border-emerald-100'
            : 'border-gray-100'
      }`}>
        <div className="inline-flex items-center justify-center gap-1.5">
          {isWinner && (
            <Trophy className={`w-3.5 h-3.5 flex-shrink-0 ${isUniqueWinner ? 'text-amber-600' : 'text-emerald-600'}`} />
          )}
          <span className={`font-mono text-sm ${
            isUniqueWinner ? 'font-black text-amber-800' :
            isWinner ? 'font-bold text-emerald-800' :
            'text-gray-700'
          }`}>
            {s}
          </span>
          {unidade && (
            <span className={`text-[9px] uppercase ${isWinner ? 'text-gray-500' : 'text-gray-400'}`}>
              {unidade}
            </span>
          )}
        </div>
      </td>
    );
  }

  // === text / choice ===
  return (
    <td className="px-3 py-2.5 text-center border-l border-gray-100 text-sm text-gray-700">
      {s}
    </td>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Shell><div className="p-8 text-gray-500">Carregando…</div></Shell>}>
      <ComparePage />
    </Suspense>
  );
}
