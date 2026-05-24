'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Loader2, Car, Calendar, Building2, User as UserIcon,
  Sparkles, Hash, Info,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

// Modelos Ford BR (do dataset real vin_share_Desafio_02.xlsx)
const FORD_MODELS = [
  { value: 'RANGER',         label: 'Ranger',          categoria: 'Picape' },
  { value: 'KA',             label: 'Ka',              categoria: 'Compacto' },
  { value: 'ECOSPORT',       label: 'EcoSport',        categoria: 'SUV compacto' },
  { value: 'TERRITORY',      label: 'Territory',       categoria: 'SUV médio' },
  { value: 'BRONCO SPORT',   label: 'Bronco Sport',    categoria: 'SUV' },
  { value: 'MAVERICK',       label: 'Maverick',        categoria: 'Picape compacta' },
  { value: 'TRANSIT',        label: 'Transit',         categoria: 'Comercial' },
  { value: 'F-150',          label: 'F-150',           categoria: 'Picape grande' },
  { value: 'MUSTANG',        label: 'Mustang',         categoria: 'Esportivo' },
  { value: 'MUSTANG MACH-E', label: 'Mustang Mach-E',  categoria: 'Elétrico' },
  { value: 'EDGE',           label: 'Edge',            categoria: 'SUV grande' },
  { value: 'FOCUS',          label: 'Focus',           categoria: 'Sedan/Hatch' },
  { value: 'FIESTA',         label: 'Fiesta',          categoria: 'Hatch' },
  { value: 'FUSION/MONDEO',  label: 'Fusion / Mondeo', categoria: 'Sedan' },
] as const;

export default function NovoCliente() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [m, setM] = useState({
    vin_hash: '',
    model_name: 'RANGER' as (typeof FORD_MODELS)[number]['value'],
    model_year: 2026,
    dealer_code_venda: '',
    sales_date: new Date().toISOString().slice(0, 10),
    delivery_date: '',
    warranty_start_date: '',
    registration_date: '',
    nome_cliente: '',
    cpf: '',
    notas: '',
    // Legado opcional (pra IA classificar com mais contexto)
    idade: '',
    genero: '',
    regiao: '',
    renda_mensal_brl: '',
    estado_civil: '',
    score_credito: '',
    versao_comprada: '',
    preco_pago_brl: '',
    financiamento: '',
    parcelas: '',
    canal_aquisicao: '',
    primeiro_carro: false,
    test_drive_realizado: false,
  });

  const [showLegacy, setShowLegacy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const payload: any = {
        model_name: m.model_name,
        model_year: Number(m.model_year),
        sales_date: m.sales_date,
      };
      if (m.vin_hash.trim()) payload.vin_hash = m.vin_hash.trim();
      if (m.dealer_code_venda) payload.dealer_code_venda = Number(m.dealer_code_venda);
      if (m.delivery_date) payload.delivery_date = m.delivery_date;
      if (m.warranty_start_date) payload.warranty_start_date = m.warranty_start_date;
      if (m.registration_date) payload.registration_date = m.registration_date;
      if (m.nome_cliente.trim()) payload.nome_cliente = m.nome_cliente.trim();
      if (m.cpf.replace(/\D/g, '')) payload.cpf = m.cpf.replace(/\D/g, '');
      if (m.notas.trim()) payload.notas = m.notas.trim();

      if (showLegacy) {
        if (m.idade) payload.idade = Number(m.idade);
        if (m.genero) payload.genero = m.genero;
        if (m.regiao) payload.regiao = m.regiao;
        if (m.renda_mensal_brl) payload.renda_mensal_brl = Number(m.renda_mensal_brl);
        if (m.estado_civil) payload.estado_civil = m.estado_civil;
        if (m.score_credito) payload.score_credito = Number(m.score_credito);
        if (m.versao_comprada) payload.versao_comprada = m.versao_comprada;
        if (m.preco_pago_brl) payload.preco_pago_brl = Number(m.preco_pago_brl);
        if (m.financiamento) payload.financiamento = m.financiamento;
        if (m.parcelas !== '') payload.parcelas = Number(m.parcelas);
        if (m.canal_aquisicao) payload.canal_aquisicao = m.canal_aquisicao;
        payload.primeiro_carro = m.primeiro_carro;
        payload.test_drive_realizado = m.test_drive_realizado;
      }

      const r = await api.createClient(payload);
      router.push(`/clientes/${r.client.id}`);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally { setSaving(false); }
  }

  const modeloAtual = FORD_MODELS.find(x => x.value === m.model_name);

  return (
    <Shell>
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/clientes" className="inline-flex items-center gap-2 text-slate hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ford-blue font-bold mb-2">
            <Car className="w-3 h-3" /> Cadastro Ford BR
          </div>
          <h1 className="text-3xl font-bold text-charcoal">Novo cliente</h1>
          <p className="text-slate mt-1">
            Mesmo schema do banco real Ford. Cadastros manuais ficam com
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-ford-blue mx-1">data_source = manual</code>
            e convivem com os 175k VINs do dataset vin_share.
          </p>
        </div>

        {err && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl mb-6 flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{err}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-6">
          <Section icon={Car} title="Identificação do veículo" desc="Campos vindos diretamente do dataset Ford BR">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Modelo *" desc="Modelo Ford BR">
                <select required value={m.model_name} onChange={e => setM({ ...m, model_name: e.target.value as any })}
                  className="ford-input">
                  {FORD_MODELS.map(mo => (
                    <option key={mo.value} value={mo.value}>{mo.label} — {mo.categoria}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ano modelo *">
                <input type="number" required min={2010} max={2030}
                  value={m.model_year} onChange={e => setM({ ...m, model_year: Number(e.target.value) })}
                  className="ford-input" />
              </Field>
              <Field label="Versão / Trim" desc="Ex: XLT, Limited, Raptor">
                <input value={m.versao_comprada} onChange={e => setM({ ...m, versao_comprada: e.target.value })}
                  placeholder={modeloAtual?.value === 'RANGER' ? 'XLT / Limited / Raptor' : 'Versão / trim'}
                  className="ford-input" />
              </Field>
              <Field label="VIN Hash" desc="Opcional — deixe em branco pra gerar automático">
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={m.vin_hash} onChange={e => setM({ ...m, vin_hash: e.target.value })}
                    placeholder="ex: f8e2bb4c5d6789..."
                    className="ford-input pl-9 font-mono text-xs" />
                </div>
              </Field>
              <Field label="DealerCode" desc="Código Ford da concessionária da venda">
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="number" value={m.dealer_code_venda} onChange={e => setM({ ...m, dealer_code_venda: e.target.value })}
                    placeholder="ex: 5094, 4005, 6137"
                    className="ford-input pl-9" />
                </div>
              </Field>
            </div>
          </Section>

          <Section icon={Calendar} title="Datas da venda" desc="Conforme dataset Ford BR (SalesDate, DeliveryDate, WarrantyStartDate)">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Data da venda *">
                <input type="date" required value={m.sales_date} onChange={e => setM({ ...m, sales_date: e.target.value })}
                  className="ford-input" />
              </Field>
              <Field label="Data de entrega">
                <input type="date" value={m.delivery_date} onChange={e => setM({ ...m, delivery_date: e.target.value })}
                  className="ford-input" />
              </Field>
              <Field label="Início garantia">
                <input type="date" value={m.warranty_start_date} onChange={e => setM({ ...m, warranty_start_date: e.target.value })}
                  className="ford-input" />
              </Field>
              <Field label="Registro DETRAN">
                <input type="date" value={m.registration_date} onChange={e => setM({ ...m, registration_date: e.target.value })}
                  className="ford-input" />
              </Field>
            </div>
          </Section>

          <Section icon={UserIcon} title="Identidade do cliente" desc="Opcional · CPF é hasheado SHA-256 antes de gravar (LGPD)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome completo">
                <input value={m.nome_cliente} onChange={e => setM({ ...m, nome_cliente: e.target.value })}
                  className="ford-input" />
              </Field>
              <Field label="CPF" desc="11 dígitos — armazenado como hash">
                <input value={m.cpf} onChange={e => setM({ ...m, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="ford-input" />
              </Field>
            </div>
            <Field label="Notas do consultor" desc="Texto livre que alimenta a IA híbrida ao reclassificar">
              <textarea rows={3} value={m.notas} onChange={e => setM({ ...m, notas: e.target.value })}
                placeholder='Ex: "Cliente cogitou troca em 18 meses. Família com 2 filhos pequenos."'
                className="ford-input" />
            </Field>
          </Section>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-soft">
            <button type="button" onClick={() => setShowLegacy(!showLegacy)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <div>
                  <div className="font-bold text-charcoal">Dados sócio-demográficos</div>
                  <div className="text-xs text-slate">Opcional — habilita classificação ML clássica (renda/score/etc.)</div>
                </div>
              </div>
              <div className="text-xs uppercase tracking-wider text-ford-blue font-bold">
                {showLegacy ? 'Ocultar' : 'Mostrar'}
              </div>
            </button>
            {showLegacy && (
              <div className="px-5 pb-5 border-t border-gray-100 space-y-4 pt-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Idade">
                    <input type="number" min={18} max={95} value={m.idade}
                      onChange={e => setM({ ...m, idade: e.target.value })} className="ford-input" />
                  </Field>
                  <Field label="Gênero">
                    <select value={m.genero} onChange={e => setM({ ...m, genero: e.target.value })} className="ford-input">
                      <option value="">—</option>
                      <option value="M">Masculino</option><option value="F">Feminino</option><option value="outro">Outro</option>
                    </select>
                  </Field>
                  <Field label="Região">
                    <select value={m.regiao} onChange={e => setM({ ...m, regiao: e.target.value })} className="ford-input">
                      <option value="">—</option>
                      <option value="sul">Sul</option><option value="sudeste">Sudeste</option>
                      <option value="centro_oeste">Centro-Oeste</option><option value="nordeste">Nordeste</option>
                      <option value="norte">Norte</option>
                    </select>
                  </Field>
                  <Field label="Estado civil">
                    <select value={m.estado_civil} onChange={e => setM({ ...m, estado_civil: e.target.value })} className="ford-input">
                      <option value="">—</option>
                      <option value="solteiro">Solteiro</option><option value="casado">Casado</option>
                      <option value="divorciado">Divorciado</option><option value="viuvo">Viúvo</option>
                    </select>
                  </Field>
                  <Field label="Renda mensal (R$)">
                    <input type="number" min={0} value={m.renda_mensal_brl}
                      onChange={e => setM({ ...m, renda_mensal_brl: e.target.value })} className="ford-input" />
                  </Field>
                  <Field label="Score crédito">
                    <input type="number" min={0} max={1000} value={m.score_credito}
                      onChange={e => setM({ ...m, score_credito: e.target.value })} className="ford-input" />
                  </Field>
                  <Field label="Preço pago (R$)">
                    <input type="number" min={0} value={m.preco_pago_brl}
                      onChange={e => setM({ ...m, preco_pago_brl: e.target.value })} className="ford-input" />
                  </Field>
                  <Field label="Financiamento">
                    <select value={m.financiamento} onChange={e => setM({ ...m, financiamento: e.target.value })} className="ford-input">
                      <option value="">—</option>
                      <option value="a_vista">À vista</option><option value="financiado">Financiado</option>
                      <option value="leasing">Leasing</option><option value="consorcio">Consórcio</option>
                    </select>
                  </Field>
                  <Field label="Parcelas">
                    <input type="number" min={0} max={84} value={m.parcelas}
                      onChange={e => setM({ ...m, parcelas: e.target.value })} className="ford-input" />
                  </Field>
                  <Field label="Canal aquisição">
                    <select value={m.canal_aquisicao} onChange={e => setM({ ...m, canal_aquisicao: e.target.value })} className="ford-input">
                      <option value="">—</option>
                      <option value="concessionaria">Concessionária</option>
                      <option value="online">Online</option>
                      <option value="frota">Frota</option>
                      <option value="indicacao">Indicação</option>
                    </select>
                  </Field>
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={m.primeiro_carro} onChange={e => setM({ ...m, primeiro_carro: e.target.checked })}
                      className="w-4 h-4 accent-ford-blue" />
                    Primeiro carro
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={m.test_drive_realizado} onChange={e => setM({ ...m, test_drive_realizado: e.target.checked })}
                      className="w-4 h-4 accent-ford-blue" />
                    Test drive realizado
                  </label>
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={saving || !m.model_name || !m.sales_date}
            className="w-full py-4 bg-ford-blue text-white font-bold rounded-2xl uppercase tracking-wider text-sm hover:bg-ford-blue-dark disabled:opacity-50 flex items-center justify-center gap-2 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando…' : 'Salvar cliente'}
          </button>
        </form>

        <style jsx>{`
          .ford-input {
            width: 100%;
            padding: 0.625rem 0.875rem;
            border: 1px solid #d1d5db;
            border-radius: 0.75rem;
            font-size: 0.875rem;
            outline: none;
            transition: border-color 0.15s;
            background: white;
          }
          .ford-input:focus { border-color: #003478; }
        `}</style>
      </div>
    </Shell>
  );
}

function Section({ icon: Icon, title, desc, children }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-soft">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-ford-blue-soft flex items-center justify-center">
          <Icon className="w-4 h-4 text-ford-blue" />
        </div>
        <div>
          <h2 className="text-base font-bold text-charcoal">{title}</h2>
          {desc && <p className="text-xs text-slate">{desc}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, desc, children }: any) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-gray-600 font-bold mb-1">{label}</span>
      {desc && <span className="block text-[11px] text-slate mb-1.5">{desc}</span>}
      {children}
    </label>
  );
}
