'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, FileJson, FileSpreadsheet } from 'lucide-react';
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

  // Upload
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [content, setContent] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

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
    setSaving(true); setErr(null); setImportResult(null);
    try {
      const r = await api.importVehicles(format, content);
      setImportResult(r);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
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
          <form onSubmit={saveImport} className="space-y-6">
            <div className="flex gap-2">
              <button type="button" onClick={() => setFormat('json')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition ${format === 'json' ? 'border-ford-blue bg-ford-blue/5 text-ford-blue' : 'border-gray-300'}`}>
                <FileJson className="w-4 h-4" /> JSON
              </button>
              <button type="button" onClick={() => setFormat('csv')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition ${format === 'csv' ? 'border-ford-blue bg-ford-blue/5 text-ford-blue' : 'border-gray-300'}`}>
                <FileSpreadsheet className="w-4 h-4" /> CSV
              </button>
            </div>

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
    "equipamentos": ["bloqueio_diferencial_dianteiro", "fox_live_valve"]
  }
]`}</pre>
              ) : (
                <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
{`marca,modelo,versao,ano,categoria,motor.potencia_cv,motor.torque_nm,preco_brl,equipamentos
Ford,Ranger,Raptor,2025,picape_media,397,583,489900,bloqueio_dianteiro;fox_valve`}</pre>
              )}
              <p className="text-xs text-gray-500 mt-2">Equipamentos em CSV: separados por ponto-e-vírgula. Use dot-notation para nested fields.</p>
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

            {importResult && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl p-4">
                <p className="font-bold">✓ {importResult.inserted} veículo(s) importado(s).</p>
                <Link href="/veiculos" className="text-sm underline">Ver catálogo →</Link>
              </div>
            )}
          </form>
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
