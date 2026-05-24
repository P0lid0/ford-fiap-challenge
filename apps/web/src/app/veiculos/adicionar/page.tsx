'use client';
/**
 * Adicionar veículo — três fluxos, todos terminam com o schema canônico Ford D1
 * (262 atributos × 14 seções) disponível pra preenchimento via CanonicoBlock.
 *
 *   1. Manual  → só identificação (marca/modelo/versão/ano/categoria/preço)
 *                Quando salva, redireciona pra detalhe, onde o usuário
 *                preenche os 262 valores (manual ou "Preencher com IA").
 *
 *   2. Buscar  → consulta FIPE + e-book + site oficial + IA, devolve preview,
 *                e ao confirmar grava o veículo + dispara auto-fill canônico.
 *
 *   3. PDF/IA  → extração de e-book/foto via Anthropic Vision. Após salvar
 *                cada veículo selecionado, dispara auto-fill canônico em lote.
 *
 * Notas:
 *   - Campos quantitativos antigos (motor/dimensoes/transmissao/desempenho)
 *     foram REMOVIDOS do formulário manual — tudo isso agora vive no schema
 *     canônico (CanonicoBlock no detalhe).
 *   - JSON/CSV manteve, mas avisa que o canônico precisa ser preenchido depois.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Upload, FileJson, FileSpreadsheet, FileText, Sparkles,
  Loader2, X, Check, Search, Database, AlertCircle, ChevronRight,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { BrandCombo } from '@/components/BrandCombo';
import { useConfirm } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';

const CATEGORIAS = ['hatch', 'sedan', 'suv', 'picape_compacta', 'picape_media', 'picape_grande', 'minivan', 'cupe', 'conversivel', 'comercial'];

type Tab = 'manual' | 'buscar' | 'arquivo';
type ArquivoFormat = 'pdf_ia' | 'json' | 'csv';

export default function AdicionarVeiculo() {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<Tab>('manual');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ====== MANUAL ======
  const [m, setM] = useState({
    marca: '', modelo: '', versao: '',
    ano: new Date().getFullYear(),
    categoria: 'sedan',
    preco_brl: '',
    pais_origem: '',
    notas: '',
  });
  const [postCreateAi, setPostCreateAi] = useState(true);

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    if (!m.marca || !m.modelo || !m.versao) return;
    const ok = await confirm({
      title: `Criar ${m.marca} ${m.modelo} ${m.versao}?`,
      message: (
        <>
          Vou criar a entrada com identificação. {postCreateAi
            ? <>Em seguida, chamo a <b>IA</b> pra propor os 262 atributos canônicos (revise depois).</>
            : <>Você preenche os 262 atributos canônicos manualmente no detalhe.</>}
        </>
      ),
      details: postCreateAi
        ? <>Custo IA estimado: <b>$0.02–0.05</b> por veículo.</>
        : undefined,
      confirmLabel: 'Sim, criar',
      cancelLabel: 'Cancelar',
      variant: postCreateAi ? 'ai' : 'info',
    });
    if (!ok) return;
    setSaving(true); setErr(null);
    try {
      const payload: any = {
        marca: m.marca, modelo: m.modelo, versao: m.versao || 'Padrão',
        ano: m.ano, categoria: m.categoria,
        preco_brl: m.preco_brl === '' ? null : Number(m.preco_brl),
        pais_origem: m.pais_origem || null,
        notas: m.notas || null,
      };
      const r = await api.createVehicle(payload);
      if (postCreateAi) {
        try { await api.autoFillVehicleCatalog(r.id, false); }
        catch (e: any) { console.warn('[auto-fill]', e.message); }
      }
      router.push(`/veiculos/${r.id}`);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  // ====== BUSCAR (FIPE + site + IA) ======
  const [b, setB] = useState({ marca: '', modelo: '', versao: '', ano: '' });
  const [bSearching, setBSearching] = useState(false);
  const [bPreview, setBPreview] = useState<any>(null);
  const [bAutoFill, setBAutoFill] = useState(true);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!b.marca || !b.modelo) return;
    const ok = await confirm({
      title: 'Buscar especificações com FIPE + IA?',
      message: (
        <>
          Consulto FIPE, e-book oficial (se houver), site da fabricante e LLM em fallback
          pra <b>{b.marca} {b.modelo}</b>{b.versao && <> {b.versao}</>}{b.ano && <> · {b.ano}</>}.
        </>
      ),
      details: <>Custo IA estimado: <b>$0.05–0.50</b> (depende se precisar PDF/site).</>,
      confirmLabel: 'Sim, buscar',
      cancelLabel: 'Cancelar',
      variant: 'ai',
    });
    if (!ok) return;
    setBSearching(true); setErr(null); setBPreview(null);
    try {
      const r = await api.searchVehicle({
        marca: b.marca, modelo: b.modelo,
        versao: b.versao || undefined,
        ano: b.ano ? Number(b.ano) : undefined,
        force_refresh: false,
      });
      setBPreview(r);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setBSearching(false); }
  }

  async function confirmarBusca() {
    if (!bPreview?.vehicle) return;
    const ok = await confirm({
      title: 'Salvar este veículo no catálogo?',
      message: (
        <>
          Vou persistir <b>{bPreview.vehicle.marca} {bPreview.vehicle.modelo} {bPreview.vehicle.versao}</b>.
          {bAutoFill && <> Em seguida, chamo a IA pra propor os 262 atributos canônicos.</>}
        </>
      ),
      confirmLabel: 'Sim, salvar',
      cancelLabel: 'Cancelar',
      variant: bAutoFill ? 'ai' : 'info',
    });
    if (!ok) return;
    setSaving(true); setErr(null);
    try {
      // /competitive/search já fez upsert; só precisa garantir auto-fill canônico
      if (bAutoFill) {
        try { await api.autoFillVehicleCatalog(bPreview.vehicle.id, false); }
        catch (e: any) { console.warn('[auto-fill]', e.message); }
      }
      router.push(`/veiculos/${bPreview.vehicle.id}`);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  // ====== ARQUIVO (PDF/IA + JSON/CSV) ======
  const [arquivoFormat, setArquivoFormat] = useState<ArquivoFormat>('pdf_ia');
  const [content, setContent] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiPreview, setAiPreview] = useState<any>(null);
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set());
  const [aiAutoFill, setAiAutoFill] = useState(true);
  const [aiAutoFillProgress, setAiAutoFillProgress] = useState<{ done: number; total: number } | null>(null);

  async function saveImportBulk(e: React.FormEvent) {
    e.preventDefault();
    if (arquivoFormat === 'pdf_ia') return;
    const ok = await confirm({
      title: 'Importar veículos em lote?',
      message: (
        <>
          Vou criar os veículos do <b>{arquivoFormat.toUpperCase()}</b> colado.
          O <b>schema canônico (262 atributos)</b> vai ficar vazio — abra cada veículo
          e use &quot;Preencher com IA&quot; ou edite manualmente.
        </>
      ),
      confirmLabel: 'Sim, importar',
      cancelLabel: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;
    setSaving(true); setErr(null); setImportResult(null);
    try {
      const r = await api.importVehicles(arquivoFormat, content);
      setImportResult(r);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  async function extractFromFileAi() {
    if (!aiFile) return;
    const isPdf = aiFile.type === 'application/pdf' || aiFile.name.toLowerCase().endsWith('.pdf');
    const ok = await confirm({
      title: 'Extrair veículos com IA?',
      message: (
        <>
          A IA vai ler <b>{aiFile.name}</b> ({(aiFile.size / 1024 / 1024).toFixed(1)} MB)
          e identificar todas as versões/trims com specs e equipamentos.
        </>
      ),
      details: (
        <>
          {isPdf ? (
            <>
              <b>Estratégia híbrida (escolhe automaticamente a mais barata):</b>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>PDF com texto extraível → <b>gpt-4o-mini texto</b> · ~<b>$0.01–0.05</b></li>
                <li>PDF só com imagens → <b>gpt-4o-mini vision</b> · ~<b>$0.05–0.20</b></li>
                <li>Fallback se OpenAI falhar → <b>Claude Haiku</b> · ~<b>$0.05–0.20</b></li>
              </ul>
            </>
          ) : (
            <>
              <b>Imagem:</b> roda <b>gpt-4o-mini vision</b> (~<b>$0.05–0.15</b>) com
              fallback <b>Claude Haiku</b> (~$0.05–0.20).
            </>
          )}
        </>
      ),
      confirmLabel: 'Sim, extrair',
      cancelLabel: 'Cancelar',
      variant: 'ai',
    });
    if (!ok) return;
    setAiExtracting(true); setErr(null); setAiPreview(null); setAiSelected(new Set());
    try {
      const r = await api.importVehiclesFromFile(aiFile);
      setAiPreview(r);
      setAiSelected(new Set(r.veiculos.map((_: any, i: number) => i)));
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setAiExtracting(false); }
  }

  async function saveAiSelected() {
    if (!aiPreview || aiSelected.size === 0) return;
    const n = aiSelected.size;
    const ok = await confirm({
      title: `Salvar ${n} veículo${n === 1 ? '' : 's'}?`,
      message: (
        <>
          Vou persistir os {n} veículos selecionados no catálogo.
          {aiAutoFill && <> Em seguida, chamo o auto-fill canônico (IA) pra cada um.</>}
        </>
      ),
      details: aiAutoFill
        ? <>Custo IA estimado pro auto-fill: <b>${(0.03 * n).toFixed(2)}–${(0.05 * n).toFixed(2)}</b>.</>
        : undefined,
      confirmLabel: `Sim, salvar ${n}`,
      cancelLabel: 'Cancelar',
      variant: aiAutoFill ? 'ai' : 'info',
    });
    if (!ok) return;
    setSaving(true); setErr(null);
    try {
      const picked = aiPreview.veiculos.filter((_: any, i: number) => aiSelected.has(i));
      const r = await api.importVehicles('json', JSON.stringify(picked));
      setImportResult(r);
      // Auto-fill canônico em série pros recém-criados
      if (aiAutoFill && Array.isArray(r.vehicles)) {
        setAiAutoFillProgress({ done: 0, total: r.vehicles.length });
        for (let i = 0; i < r.vehicles.length; i++) {
          const veh = r.vehicles[i];
          try { await api.autoFillVehicleCatalog(veh.id, false); }
          catch (e: any) { console.warn('[auto-fill]', veh.id, e.message); }
          setAiAutoFillProgress({ done: i + 1, total: r.vehicles.length });
        }
        setAiAutoFillProgress(null);
      }
      setAiPreview(null); setAiSelected(new Set()); setAiFile(null);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  function toggleSelected(i: number) {
    const s = new Set(aiSelected);
    if (s.has(i)) s.delete(i); else s.add(i);
    setAiSelected(s);
  }

  return (
    <Shell>
      {dialog}
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/veiculos" className="inline-flex items-center gap-2 text-gray-600 hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-3xl font-bold text-ford-blue mb-2">Adicionar veículo</h1>
        <p className="text-gray-600 mb-2">
          Toda ficha técnica usa o <b>schema canônico Ford D1</b> (262 atributos × 14 seções).
          Os fluxos abaixo só pedem identificação — o canônico é preenchido depois (manual ou IA).
        </p>
        <div className="mb-6 bg-ford-blue-soft/30 border border-ford-blue/15 rounded-xl px-4 py-3 flex items-start gap-2 text-xs text-charcoal">
          <Database className="w-4 h-4 text-ford-blue flex-shrink-0 mt-0.5" />
          <div>
            <b>Como funciona:</b> qualquer veículo recém-criado herda os 262 atributos vazios.
            Você pode (a) deixar a IA propor um draft via &quot;Preencher com IA&quot;,
            (b) preencher manualmente atributo por atributo, ou (c) combinar os dois.
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 mb-6 flex-wrap">
          <TabButton active={tab === 'manual'}    onClick={() => setTab('manual')}    icon={Save}>
            Manual
          </TabButton>
          <TabButton active={tab === 'buscar'}    onClick={() => setTab('buscar')}    icon={Search}>
            Buscar (FIPE + IA)
          </TabButton>
          <TabButton active={tab === 'arquivo'}   onClick={() => setTab('arquivo')}   icon={Upload}>
            Importar arquivo
          </TabButton>
        </div>

        {err && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {err}
          </div>
        )}

        {/* ============== TAB MANUAL ============== */}
        {tab === 'manual' && (
          <form onSubmit={saveManual} className="space-y-6">
            <Section title="Identificação do veículo">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Marca" required>
                  <BrandCombo value={m.marca} onChange={v => setM({ ...m, marca: v })} />
                </Field>
                <Field label="Modelo" required>
                  <input required value={m.modelo} onChange={e => setM({ ...m, modelo: e.target.value })}
                    placeholder="Ex: Ranger, Hilux, Amarok…"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                </Field>
                <Field label="Versão" required>
                  <input required value={m.versao} onChange={e => setM({ ...m, versao: e.target.value })}
                    placeholder="Ex: Raptor 3.0L V6, SR 2.7 Diesel…"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                </Field>
                <Field label="Ano">
                  <input type="number" min={1990} max={2030} value={m.ano}
                    onChange={e => setM({ ...m, ano: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                </Field>
                <Field label="Categoria">
                  <select value={m.categoria} onChange={e => setM({ ...m, categoria: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue bg-white">
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Preço (R$)">
                  <input type="number" value={m.preco_brl} onChange={e => setM({ ...m, preco_brl: e.target.value })}
                    placeholder="490000"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                </Field>
                <Field label="País de origem">
                  <input value={m.pais_origem} onChange={e => setM({ ...m, pais_origem: e.target.value })}
                    placeholder="Brasil, Argentina, EUA…"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                </Field>
                <Field label="Observações">
                  <input value={m.notas} onChange={e => setM({ ...m, notas: e.target.value })}
                    placeholder="Fonte da informação, links, etc."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                </Field>
              </div>
            </Section>

            <Section title="Schema canônico (262 atributos)">
              <label className="flex items-start gap-3 cursor-pointer p-3 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100/50 transition">
                <input type="checkbox" checked={postCreateAi}
                  onChange={e => setPostCreateAi(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-purple-600" />
                <div className="flex-1">
                  <div className="font-bold text-purple-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Preencher canônico via IA logo após criar
                  </div>
                  <div className="text-xs text-purple-800 mt-1">
                    A IA propõe valores pros 262 atributos (X / 0 / numérico) usando a identificação
                    como prompt. Custo: <b>$0.02–0.05</b>. Você revisa antes de salvar mudanças.
                    {' '}<i>Desmarque pra preencher manualmente no detalhe.</i>
                  </div>
                </div>
              </label>
            </Section>

            <button type="submit" disabled={saving || !m.marca || !m.modelo || !m.versao}
              className="w-full py-4 bg-ford-blue text-white font-bold rounded-2xl hover:bg-ford-blue-dark transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Criando…' : 'Criar veículo verificado'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ============== TAB BUSCAR (FIPE + site + IA) ============== */}
        {tab === 'buscar' && (
          <div className="space-y-6">
            <form onSubmit={buscar}>
              <Section title="Buscar especificações em fontes oficiais">
                <p className="text-sm text-gray-600 mb-4">
                  Pipeline: <b>FIPE</b> → <b>e-book oficial PDF</b> → <b>site da fabricante</b> →
                  {' '}<b>NHTSA</b> → <b>IA com web search</b>. Cada campo trazido ganha um badge da fonte.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Marca" required>
                    <BrandCombo value={b.marca} onChange={v => setB({ ...b, marca: v })} />
                  </Field>
                  <Field label="Modelo" required>
                    <input required value={b.modelo} onChange={e => setB({ ...b, modelo: e.target.value })}
                      placeholder="Ranger, Hilux, Amarok…"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                  </Field>
                  <Field label="Versão (opcional)">
                    <input value={b.versao} onChange={e => setB({ ...b, versao: e.target.value })}
                      placeholder="Raptor, SRX, Bi-turbo…"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                  </Field>
                  <Field label="Ano (opcional)">
                    <input type="number" min={1990} max={2030} value={b.ano}
                      onChange={e => setB({ ...b, ano: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                  </Field>
                </div>
              </Section>

              <button type="submit" disabled={bSearching || !b.marca || !b.modelo}
                className="mt-4 w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-2xl hover:opacity-90 transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                {bSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {bSearching ? 'Consultando fontes (até 1 min)…' : 'Buscar com IA'}
              </button>
            </form>

            {bPreview && (
              <div className="bg-white border-2 border-emerald-400 rounded-2xl p-6 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs text-emerald-700 font-bold uppercase tracking-wider mb-1">
                      ✓ Encontrado · fonte {bPreview.source}
                    </div>
                    <div className="font-bold text-lg text-gray-900">
                      {bPreview.vehicle.marca} {bPreview.vehicle.modelo} {bPreview.vehicle.versao}
                    </div>
                    <div className="text-sm text-gray-600">{bPreview.vehicle.ano} · {bPreview.vehicle.categoria}</div>
                    {bPreview.vehicle.preco_brl && (
                      <div className="text-2xl font-black text-ford-blue mt-1">
                        R$ {bPreview.vehicle.preco_brl.toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>Fontes consultadas:</div>
                    {(bPreview.vehicle.fontes ?? []).slice(0, 4).map((f: string, i: number) => (
                      <div key={i}><code className="bg-gray-100 px-1.5 py-0.5 rounded">{f.slice(0, 30)}</code></div>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <input type="checkbox" checked={bAutoFill}
                    onChange={e => setBAutoFill(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-purple-600" />
                  <div className="text-sm">
                    <span className="font-bold text-purple-900">Preencher canônico via IA ao salvar</span>
                    <div className="text-xs text-purple-800 mt-0.5">
                      A IA usa as specs encontradas + identificação pra propor os 262 atributos.
                    </div>
                  </div>
                </label>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setBPreview(null)}
                    className="px-5 py-3 border border-gray-300 rounded-2xl text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <X className="w-4 h-4" /> Descartar
                  </button>
                  <button onClick={confirmarBusca} disabled={saving}
                    className="flex-1 py-3 bg-ford-blue text-white font-bold rounded-2xl hover:bg-ford-blue-dark transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? 'Salvando…' : 'Salvar e abrir detalhe'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============== TAB ARQUIVO ============== */}
        {tab === 'arquivo' && (
          <div className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              <FormatButton active={arquivoFormat === 'pdf_ia'} onClick={() => setArquivoFormat('pdf_ia')}
                icon={Sparkles} accent="purple">PDF / Imagem (IA)</FormatButton>
              <FormatButton active={arquivoFormat === 'json'} onClick={() => setArquivoFormat('json')}
                icon={FileJson} accent="blue">JSON</FormatButton>
              <FormatButton active={arquivoFormat === 'csv'} onClick={() => setArquivoFormat('csv')}
                icon={FileSpreadsheet} accent="blue">CSV</FormatButton>
            </div>

            {arquivoFormat === 'pdf_ia' ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Extração inteligente — escolhe a rota mais barata</h3>
                      <p className="text-sm text-gray-700">
                        Solte um <strong>PDF</strong> (e-book do carro), <strong>PNG/JPG</strong> (foto de ficha técnica)
                        ou screenshot. A IA identifica todas as versões/trims, extrai identificação básica e equipamentos.
                        Você revisa antes de salvar.
                      </p>
                      <div className="mt-2 bg-white/60 rounded-lg p-2.5 text-xs text-gray-700 space-y-1">
                        <div className="font-bold text-gray-800">Pipeline híbrido (escolhe automaticamente):</div>
                        <div>1. <code className="bg-gray-100 px-1 rounded">pdf-parse</code> extrai texto local (grátis)</div>
                        <div>2. Se &gt;1500 chars com keywords técnicas → <b>gpt-4o-mini texto</b> (~$0.01)</div>
                        <div>3. Senão → <b>gpt-4o-mini vision</b> (~$0.05–0.20)</div>
                        <div>4. Fallback → <b>Claude Haiku</b> (~$0.05–0.20)</div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Configure OpenAI (recomendado) ou Anthropic em <Link href="/configuracoes" className="underline">/configuracoes</Link>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-ford-blue transition cursor-pointer">
                  <input id="ai-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                    onChange={e => { setAiFile(e.target.files?.[0] ?? null); setAiPreview(null); }}
                    className="hidden" />
                  <label htmlFor="ai-file" className="cursor-pointer block">
                    <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                    {aiFile ? (
                      <div>
                        <div className="text-gray-900 font-bold">{aiFile.name}</div>
                        <div className="text-sm text-gray-500">{(aiFile.size / 1024 / 1024).toFixed(2)} MB · {aiFile.type}</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-gray-700 font-medium">Clique pra escolher um arquivo</div>
                        <div className="text-xs text-gray-500 mt-1">PDF, PNG, JPG, WEBP — máx 30 MB</div>
                      </div>
                    )}
                  </label>
                </div>

                {aiFile && !aiPreview && (
                  <button onClick={extractFromFileAi} disabled={aiExtracting}
                    className="w-full py-4 bg-gradient-to-r from-ford-blue to-ford-blue-light text-white font-bold rounded-2xl hover:opacity-90 transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                    {aiExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiExtracting ? 'IA analisando o arquivo (pode demorar 1–2 min)…' : 'Extrair veículos com IA'}
                  </button>
                )}

                {aiPreview && (
                  <div className="bg-white border border-gray-300 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{aiPreview.count} veículo(s) detectado(s)</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap mt-1">
                          <span>Extraído por</span>
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{aiPreview.extracted_by}</code>
                          {aiPreview.extracted_by?.includes('mini') && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                              💸 rota barata
                            </span>
                          )}
                          <span className="text-gray-400">·</span>
                          <span>{aiPreview.filename}</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAiSelected(new Set(aiPreview.veiculos.map((_: any, i: number) => i)))}
                          className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50">Selecionar todos</button>
                        <button type="button" onClick={() => setAiSelected(new Set())}
                          className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-50">Limpar</button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {aiPreview.veiculos.map((v: any, i: number) => {
                        const checked = aiSelected.has(i);
                        return (
                          <label key={i} className={`block border-2 rounded-xl p-4 cursor-pointer transition ${checked ? 'border-ford-blue bg-ford-blue/5' : 'border-gray-200 hover:border-gray-300'}`}>
                            <div className="flex items-start gap-3">
                              <input type="checkbox" checked={checked} onChange={() => toggleSelected(i)} className="mt-1.5 w-4 h-4 accent-ford-blue" />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-gray-900">
                                  {v.marca} {v.modelo} {v.versao} {v.ano ? `· ${v.ano}` : ''}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {v.categoria ?? '?'} ·
                                  {' '}{v.motor?.potencia_cv ? `${v.motor.potencia_cv}cv` : '?cv'} /
                                  {' '}{v.motor?.torque_nm ? `${v.motor.torque_nm}Nm` : '?Nm'} ·
                                  {' '}{v.transmissao?.tipo ?? '?'} {v.transmissao?.marchas ? `${v.transmissao.marchas}m` : ''} ·
                                  {' '}{v.preco_brl ? `R$ ${v.preco_brl.toLocaleString('pt-BR')}` : 'sem preço'}
                                </div>
                                {v.equipamentos?.length > 0 && (
                                  <div className="text-xs text-gray-600 mt-2 line-clamp-2">
                                    <span className="font-semibold">{v.equipamentos.length} equipamentos:</span>{' '}
                                    {v.equipamentos.slice(0, 8).map((e: string) => e.replace(/^[a-z_]+:/, '')).join(', ')}
                                    {v.equipamentos.length > 8 ? '…' : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer p-3 bg-purple-50 border border-purple-200 rounded-xl">
                      <input type="checkbox" checked={aiAutoFill}
                        onChange={e => setAiAutoFill(e.target.checked)}
                        className="mt-1 w-4 h-4 accent-purple-600" />
                      <div className="text-sm">
                        <span className="font-bold text-purple-900">Auto-fill canônico para cada um</span>
                        <div className="text-xs text-purple-800 mt-0.5">
                          Após salvar, chamo a IA pra propor os 262 atributos canônicos pra cada veículo.
                          {' '}Custo: <b>~${(0.04 * aiSelected.size).toFixed(2)}</b> total.
                        </div>
                      </div>
                    </label>

                    {aiAutoFillProgress && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-900 flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preenchendo canônico via IA: {aiAutoFillProgress.done}/{aiAutoFillProgress.total}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => { setAiPreview(null); setAiFile(null); }}
                        className="px-5 py-3 border border-gray-300 rounded-2xl text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <X className="w-4 h-4" /> Descartar
                      </button>
                      <button type="button" onClick={saveAiSelected} disabled={saving || aiSelected.size === 0}
                        className="flex-1 py-3 bg-ford-blue text-white font-bold rounded-2xl hover:bg-ford-blue-dark transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {saving ? 'Salvando…' : `Salvar ${aiSelected.size} veículo(s) selecionado(s)`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={saveImportBulk} className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <b>Aviso:</b> a importação em {arquivoFormat.toUpperCase()} cria a entrada do veículo mas
                    <b> não preenche o schema canônico</b> (262 atributos). Abra cada veículo depois e
                    {' '}use <b>&quot;Preencher com IA&quot;</b> ou edite manualmente.
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 text-sm">
                  <strong className="text-gray-800">Formato esperado:</strong>
                  {arquivoFormat === 'json' ? (
                    <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
{`[
  {
    "marca": "Ford", "modelo": "Ranger", "versao": "Raptor", "ano": 2025,
    "categoria": "picape_media",
    "preco_brl": 489900
  }
]`}</pre>
                  ) : (
                    <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
{`marca,modelo,versao,ano,categoria,preco_brl
Ford,Ranger,Raptor,2025,picape_media,489900`}</pre>
                  )}
                </div>

                <textarea value={content} onChange={e => setContent(e.target.value)} required rows={12}
                  placeholder={arquivoFormat === 'json' ? 'Cole o JSON aqui ou abra um arquivo...' : 'Cole o CSV aqui ou abra um arquivo...'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue font-mono text-xs" />

                <input type="file" accept={arquivoFormat === 'json' ? '.json' : '.csv'}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    f.text().then(setContent);
                  }}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-gray-300 file:bg-white file:text-ford-blue file:font-medium hover:file:bg-gray-50 cursor-pointer" />

                <button type="submit" disabled={saving || !content}
                  className="w-full py-4 bg-ford-blue text-white font-bold rounded-2xl hover:bg-ford-blue-dark transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {saving ? 'Importando…' : 'Importar lote'}
                </button>
              </form>
            )}

            {importResult && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl p-4">
                <p className="font-bold">✓ {importResult.inserted} veículo(s) importado(s).</p>
                <Link href="/veiculos" className="text-sm underline">Ver catálogo →</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

// ===========================================================
// Helpers de UI
// ===========================================================

function TabButton({ active, onClick, icon: Icon, children }: any) {
  return (
    <button onClick={onClick}
      className={`px-5 py-3 font-bold text-sm uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
        active ? 'border-ford-blue text-ford-blue' : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}>
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function FormatButton({ active, onClick, icon: Icon, accent, children }: any) {
  const accents: Record<string, string> = {
    purple: active ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-300',
    blue: active ? 'border-ford-blue bg-ford-blue/5 text-ford-blue' : 'border-gray-300',
  };
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition ${accents[accent] ?? accents.blue}`}>
      <Icon className="w-4 h-4" /> {children}
    </button>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-300 p-6">
      <h2 className="text-lg font-bold text-ford-blue mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, required, children }: any) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-gray-600 mb-2">{label}{required && ' *'}</span>
      {children}
    </label>
  );
}
