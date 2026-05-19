'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, FileJson, FileSpreadsheet, FileText, Sparkles, Loader2, X, Check } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { BrandCombo } from '@/components/BrandCombo';
import { api } from '@/lib/api';

const CATEGORIAS = ['hatch', 'sedan', 'suv', 'picape_compacta', 'picape_media', 'picape_grande', 'minivan', 'cupe', 'conversivel', 'comercial'];

export default function AdicionarVeiculo() {
  const router = useRouter();
  const [tab, setTab] = useState<'manual' | 'arquivo'>('manual');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Manual
  const [m, setM] = useState({
    marca: '', modelo: '', versao: '', ano: 2024, categoria: 'sedan',
    preco_brl: '', pais_origem: '',
    motor: { cilindrada_cc: '', potencia_cv: '', torque_nm: '', combustivel: '', aspiracao: '', cilindros: '' },
    dimensoes: { comprimento_mm: '', largura_mm: '', altura_mm: '', entre_eixos_mm: '', vao_livre_mm: '', peso_kg: '' },
    transmissao: { tipo: '', marchas: '', tracao: '' },
    desempenho: { aceleracao_0_100_s: '', velocidade_max_kmh: '', consumo_cidade_kml: '', consumo_estrada_kml: '' },
    equipamentos: '',
    notas: '',
  });

  // Upload texto (JSON/CSV)
  const [format, setFormat] = useState<'json' | 'csv' | 'arquivo_ia'>('json');
  const [content, setContent] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

  // Upload PDF/imagem com extração IA
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiPreview, setAiPreview] = useState<any>(null);
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set());

  function num(v: string): number | null { return v === '' ? null : Number(v); }
  function clean(g: any): any {
    const out: any = {};
    for (const k of Object.keys(g)) {
      const v = g[k];
      if (v === '' || v == null) continue;
      out[k] = isNaN(Number(v)) ? v : Number(v);
    }
    return out;
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const payload = {
        marca: m.marca, modelo: m.modelo, versao: m.versao || 'Padrão',
        ano: m.ano, categoria: m.categoria,
        motor: clean(m.motor),
        dimensoes: clean(m.dimensoes),
        transmissao: clean(m.transmissao),
        desempenho: clean(m.desempenho),
        equipamentos: m.equipamentos.split('\n').map(s => s.trim()).filter(Boolean),
        preco_brl: num(m.preco_brl),
        pais_origem: m.pais_origem || null,
        notas: m.notas || null,
      };
      const r = await api.createVehicle(payload);
      router.push(`/veiculos/${r.id}`);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  async function saveImport(e: React.FormEvent) {
    e.preventDefault();
    if (format === 'arquivo_ia') return; // tratado em separado
    setSaving(true); setErr(null); setImportResult(null);
    try {
      const r = await api.importVehicles(format, content);
      setImportResult(r);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  async function extractFromFileAi() {
    if (!aiFile) return;
    setAiExtracting(true); setErr(null); setAiPreview(null); setAiSelected(new Set());
    try {
      const r = await api.importVehiclesFromFile(aiFile);
      setAiPreview(r);
      setAiSelected(new Set(r.veiculos.map((_: any, i: number) => i))); // todos selecionados por padrão
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setAiExtracting(false); }
  }

  async function saveAiSelected() {
    if (!aiPreview || aiSelected.size === 0) return;
    setSaving(true); setErr(null);
    try {
      const picked = aiPreview.veiculos.filter((_: any, i: number) => aiSelected.has(i));
      const r = await api.importVehicles('json', JSON.stringify(picked));
      setImportResult(r);
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
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/veiculos" className="inline-flex items-center gap-2 text-gray-600 hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-3xl font-bold text-ford-blue mb-2">Adicionar veículo</h1>
        <p className="text-gray-600 mb-6">
          Adições manuais são marcadas como <strong>verificado por humano</strong> (confiança alta).
        </p>

        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button onClick={() => setTab('manual')}
            className={`px-5 py-3 font-medium transition border-b-2 ${tab === 'manual' ? 'border-ford-blue text-ford-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            Preenchimento manual
          </button>
          <button onClick={() => setTab('arquivo')}
            className={`px-5 py-3 font-medium transition border-b-2 ${tab === 'arquivo' ? 'border-ford-blue text-ford-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            Importar arquivo (lote)
          </button>
        </div>

        {err && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4">{err}</div>}

        {tab === 'manual' && (
          <form onSubmit={saveManual} className="space-y-6">
            <Section title="Identificação">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Marca *" required>
                  <BrandCombo value={m.marca} onChange={v => setM({ ...m, marca: v })} />
                </Field>
                <Field label="Modelo *" required>
                  <input required value={m.modelo} onChange={e => setM({ ...m, modelo: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                </Field>
                <Field label="Versão *" required>
                  <input required value={m.versao} onChange={e => setM({ ...m, versao: e.target.value })}
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                </Field>
                <Field label="País de origem">
                  <input value={m.pais_origem} onChange={e => setM({ ...m, pais_origem: e.target.value })}
                    placeholder="Brasil, Argentina, EUA…"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue" />
                </Field>
              </div>
            </Section>

            <Section title="Motor">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <SmallField label="Cilindrada (cc)" type="number" value={m.motor.cilindrada_cc} onChange={v => setM({ ...m, motor: { ...m.motor, cilindrada_cc: v } })} />
                <SmallField label="Potência (cv)" type="number" value={m.motor.potencia_cv} onChange={v => setM({ ...m, motor: { ...m.motor, potencia_cv: v } })} />
                <SmallField label="Torque (Nm)" type="number" value={m.motor.torque_nm} onChange={v => setM({ ...m, motor: { ...m.motor, torque_nm: v } })} />
                <SmallField label="Cilindros" type="number" value={m.motor.cilindros} onChange={v => setM({ ...m, motor: { ...m.motor, cilindros: v } })} />
                <SmallField label="Combustível" value={m.motor.combustivel} onChange={v => setM({ ...m, motor: { ...m.motor, combustivel: v } })} />
                <SmallField label="Aspiração" value={m.motor.aspiracao} onChange={v => setM({ ...m, motor: { ...m.motor, aspiracao: v } })} />
              </div>
            </Section>

            <Section title="Transmissão">
              <div className="grid grid-cols-3 gap-4">
                <SmallField label="Tipo" value={m.transmissao.tipo} onChange={v => setM({ ...m, transmissao: { ...m.transmissao, tipo: v } })} />
                <SmallField label="Marchas" type="number" value={m.transmissao.marchas} onChange={v => setM({ ...m, transmissao: { ...m.transmissao, marchas: v } })} />
                <SmallField label="Tração" value={m.transmissao.tracao} onChange={v => setM({ ...m, transmissao: { ...m.transmissao, tracao: v } })} />
              </div>
            </Section>

            <Section title="Desempenho">
              <div className="grid grid-cols-2 gap-4">
                <SmallField label="0-100 km/h (s)" type="number" value={m.desempenho.aceleracao_0_100_s} onChange={v => setM({ ...m, desempenho: { ...m.desempenho, aceleracao_0_100_s: v } })} />
                <SmallField label="Vel. máx (km/h)" type="number" value={m.desempenho.velocidade_max_kmh} onChange={v => setM({ ...m, desempenho: { ...m.desempenho, velocidade_max_kmh: v } })} />
                <SmallField label="Consumo cidade (km/l)" type="number" value={m.desempenho.consumo_cidade_kml} onChange={v => setM({ ...m, desempenho: { ...m.desempenho, consumo_cidade_kml: v } })} />
                <SmallField label="Consumo estrada (km/l)" type="number" value={m.desempenho.consumo_estrada_kml} onChange={v => setM({ ...m, desempenho: { ...m.desempenho, consumo_estrada_kml: v } })} />
              </div>
            </Section>

            <Section title="Dimensões">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(['comprimento_mm','largura_mm','altura_mm','entre_eixos_mm','vao_livre_mm','peso_kg'] as const).map(k => (
                  <SmallField key={k} label={k.replace(/_/g,' ')} type="number" value={(m.dimensoes as any)[k]}
                    onChange={v => setM({ ...m, dimensoes: { ...m.dimensoes, [k]: v } })} />
                ))}
              </div>
            </Section>

            <Section title="Equipamentos e notas">
              <Field label="Equipamentos (um por linha, snake_case)">
                <textarea rows={4} value={m.equipamentos} onChange={e => setM({ ...m, equipamentos: e.target.value })}
                  placeholder="bloqueio_diferencial_traseiro&#10;teto_solar_panoramico&#10;..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue font-mono text-sm" />
              </Field>
              <Field label="Observações">
                <textarea rows={2} value={m.notas} onChange={e => setM({ ...m, notas: e.target.value })}
                  placeholder="Fonte de verificação, links, etc."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue text-sm" />
              </Field>
            </Section>

            <button type="submit" disabled={saving || !m.marca || !m.modelo || !m.versao}
              className="w-full py-4 bg-ford-blue text-white font-bold rounded-2xl hover:bg-ford-blue-dark transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar veículo verificado'}
            </button>
          </form>
        )}

        {tab === 'arquivo' && (
          <div className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setFormat('json')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition ${format === 'json' ? 'border-ford-blue bg-ford-blue/5 text-ford-blue' : 'border-gray-300'}`}>
                <FileJson className="w-4 h-4" /> JSON
              </button>
              <button type="button" onClick={() => setFormat('csv')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition ${format === 'csv' ? 'border-ford-blue bg-ford-blue/5 text-ford-blue' : 'border-gray-300'}`}>
                <FileSpreadsheet className="w-4 h-4" /> CSV
              </button>
              <button type="button" onClick={() => setFormat('arquivo_ia')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition ${format === 'arquivo_ia' ? 'border-ford-blue bg-ford-blue/5 text-ford-blue' : 'border-gray-300'}`}>
                <Sparkles className="w-4 h-4" /> PDF / Imagem (IA)
              </button>
            </div>

            {format === 'arquivo_ia' ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">Extração inteligente de e-books, brochuras e fichas</h3>
                      <p className="text-sm text-gray-700">
                        Solte um <strong>PDF</strong> (e-book do carro), <strong>PNG/JPG</strong> (foto de ficha técnica)
                        ou screenshot. A IA identifica todas as versões/trims, extrai specs e equipamentos categorizados.
                        Você revisa antes de salvar.
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        ⚠ PDFs exigem chave Anthropic em <Link href="/configuracoes" className="underline">/configuracoes</Link>.
                        Imagens funcionam com OpenAI ou Anthropic.
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
                  <button type="button" onClick={extractFromFileAi} disabled={aiExtracting}
                    className="w-full py-4 bg-gradient-to-r from-ford-blue to-ford-blue-light text-white font-bold rounded-2xl hover:opacity-90 transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                    {aiExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiExtracting ? 'IA analisando o arquivo (pode demorar 1–2 min em PDFs longos)…' : 'Extrair veículos com IA'}
                  </button>
                )}

                {aiPreview && (
                  <div className="bg-white border border-gray-300 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{aiPreview.count} veículo(s) detectado(s)</h3>
                        <p className="text-xs text-gray-500">Extraído por {aiPreview.extracted_by} · {aiPreview.filename}</p>
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
                                  {' '}{v.transmissao?.tracao ?? '?'} ·
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

                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => { setAiPreview(null); setAiFile(null); }}
                        className="px-5 py-3 border border-gray-300 rounded-2xl text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <X className="w-4 h-4" /> Descartar
                      </button>
                      <button type="button" onClick={saveAiSelected} disabled={saving || aiSelected.size === 0}
                        className="flex-1 py-3 bg-ford-blue text-white font-bold rounded-2xl hover:bg-ford-blue-dark transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        {saving ? 'Salvando…' : `Salvar ${aiSelected.size} veículo(s) selecionado(s)`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={saveImport} className="space-y-6">
                <div className="bg-gray-50 rounded-xl p-4 text-sm">
                  <strong className="text-gray-800">Formato esperado:</strong>
                  {format === 'json' ? (
                    <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
{`[
  {
    "marca": "Ford", "modelo": "Ranger", "versao": "Raptor", "ano": 2025,
    "categoria": "picape_media",
    "motor": { "potencia_cv": 397, "torque_nm": 583, "combustivel": "gasolina" },
    "preco_brl": 489900,
    "equipamentos": ["offroad:bloqueio_diferencial_dianteiro", "offroad:fox_live_valve"]
  }
]`}</pre>
                  ) : (
                    <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
{`marca,modelo,versao,ano,categoria,motor.potencia_cv,motor.torque_nm,preco_brl,equipamentos
Ford,Ranger,Raptor,2025,picape_media,397,583,489900,offroad:bloqueio_dianteiro;offroad:fox_valve`}</pre>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Equipamentos em CSV: separados por ponto-e-vírgula. Use prefixo categoria:item.</p>
                </div>

                <textarea value={content} onChange={e => setContent(e.target.value)} required rows={12}
                  placeholder={format === 'json' ? 'Cole o JSON aqui ou abra um arquivo...' : 'Cole o CSV aqui ou abra um arquivo...'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue font-mono text-xs" />

                <input type="file" accept={format === 'json' ? '.json' : '.csv'}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    f.text().then(setContent);
                  }}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-gray-300 file:bg-white file:text-ford-blue file:font-medium hover:file:bg-gray-50 cursor-pointer" />

                <button type="submit" disabled={saving || !content}
                  className="w-full py-4 bg-ford-blue text-white font-bold rounded-2xl hover:bg-ford-blue-dark transition disabled:opacity-50 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" /> {saving ? 'Importando…' : 'Importar lote'}
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
function SmallField({ label, type = 'text', value, onChange }: any) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-gray-600 mb-1.5">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-ford-blue text-sm" />
    </label>
  );
}
