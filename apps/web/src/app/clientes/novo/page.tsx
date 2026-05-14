'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

const REGIOES = ['sul', 'sudeste', 'centro_oeste', 'nordeste', 'norte'];
const FINANC = ['a_vista', 'financiado', 'leasing', 'consorcio'];
const CANAIS = ['concessionaria', 'online', 'frota', 'indicacao'];
const ESTADOS = ['solteiro', 'casado', 'divorciado', 'viuvo'];

export default function NovoCliente() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_cliente: '', idade: 35, genero: 'M', regiao: 'sudeste',
    renda_mensal_brl: 8500, estado_civil: 'solteiro', score_credito: 680,
    modelo_comprado: 'Ranger', versao_comprada: 'XLT', preco_pago_brl: 230000,
    financiamento: 'financiado', parcelas: 60,
    canal_aquisicao: 'concessionaria', primeiro_carro: false,
    test_drive_realizado: true,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm({ ...form, [k]: v });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const r = await api.createClient(form);
      router.replace(`/clientes/${r.client.id}`);
    } catch (e: any) {
      setError(e.message ?? String(e));
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/clientes" className="inline-flex items-center gap-2 text-gray-600 hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-3xl font-bold text-ford-blue mb-2">Cadastrar venda</h1>
        <p className="text-gray-600 mb-8">
          Apenas dados do <strong>momento da compra</strong> (Base 2). Sistema classifica automaticamente.
        </p>

        <form onSubmit={submit} className="space-y-6">
          <Section title="Cliente">
            <Grid>
              <Field label="Nome (opcional)" value={form.nome_cliente} onChange={v => set('nome_cliente', v)} />
              <Field label="Idade" type="number" value={form.idade} onChange={v => set('idade', Number(v))} />
              <Field label="Score crédito" type="number" value={form.score_credito} onChange={v => set('score_credito', Number(v))} />
              <Field label="Renda mensal (R$)" type="number" value={form.renda_mensal_brl} onChange={v => set('renda_mensal_brl', Number(v))} />
              <Select label="Gênero" value={form.genero} options={['M', 'F', 'outro']} onChange={v => set('genero', v)} />
              <Select label="Estado civil" value={form.estado_civil} options={ESTADOS} onChange={v => set('estado_civil', v)} />
              <Select label="Região" value={form.regiao} options={REGIOES} onChange={v => set('regiao', v as any)} />
            </Grid>
          </Section>

          <Section title="Veículo & Aquisição">
            <Grid>
              <Field label="Modelo" value={form.modelo_comprado} onChange={v => set('modelo_comprado', v)} />
              <Field label="Versão" value={form.versao_comprada} onChange={v => set('versao_comprada', v)} />
              <Field label="Preço pago (R$)" type="number" value={form.preco_pago_brl} onChange={v => set('preco_pago_brl', Number(v))} />
              <Select label="Financiamento" value={form.financiamento} options={FINANC} onChange={v => set('financiamento', v as any)} />
              <Field label="Parcelas" type="number" value={form.parcelas} onChange={v => set('parcelas', Number(v))} />
              <Select label="Canal" value={form.canal_aquisicao} options={CANAIS} onChange={v => set('canal_aquisicao', v as any)} />
              <Toggle label="Primeiro carro" value={form.primeiro_carro} onChange={v => set('primeiro_carro', v)} />
              <Toggle label="Test drive realizado" value={form.test_drive_realizado} onChange={v => set('test_drive_realizado', v)} />
            </Grid>
          </Section>

          {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-ford-blue text-white font-bold rounded-2xl hover:bg-ford-blue-dark transition disabled:opacity-50 uppercase tracking-wider text-sm">
            {loading ? 'Classificando com ML…' : 'Cadastrar e classificar'}
          </button>
        </form>
      </div>
    </Shell>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-300 p-6">
      <h2 className="text-lg font-bold text-ford-blue mb-5">{title}</h2>
      {children}
    </div>
  );
}
function Grid({ children }: any) { return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>; }
function Field({ label, value, onChange, type = 'text' }: any) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-gray-600 mb-2">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue transition" />
    </label>
  );
}
function Select({ label, value, options, onChange }: any) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-gray-600 mb-2">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue transition bg-white">
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function Toggle({ label, value, onChange }: any) {
  return (
    <label className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-xl cursor-pointer border border-gray-300 hover:bg-gray-100 transition">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)}
        className="w-5 h-5 accent-ford-blue cursor-pointer" />
    </label>
  );
}
