'use client';
import { useEffect, useState } from 'react';
import {
  Settings, Save, Sparkles, Key, Check, X, Eye, EyeOff,
  Trash2, Brain, Bot, Loader2, ExternalLink,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api, type AiFunction } from '@/lib/api';

const PROVIDERS: { id: 'openai' | 'anthropic' | 'gemini' | 'fipe'; name: string; url: string; desc?: string }[] = [
  { id: 'openai',    name: 'OpenAI',        url: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic',     url: 'https://console.anthropic.com/settings/keys' },
  { id: 'gemini',    name: 'Google Gemini', url: 'https://aistudio.google.com/apikey' },
  { id: 'fipe',      name: 'FIPE.online',   url: 'https://fipe.online/sign-up',
    desc: 'Token aumenta o rate limit de 500 → 1000 req/dia. Cobre carros, motos e caminhões.' },
];

const FUNCTIONS: { id: AiFunction; label: string; desc: string; tier: 'fast' | 'smart' }[] = [
  { id: 'vehicle_search',       label: 'Busca de veículo',
    desc: 'Preenche specs técnicos quando FIPE/site oficial não traz tudo. Estima preço se FIPE não tiver.',
    tier: 'fast' },
  { id: 'manufacturer_extract', label: 'Extração do site oficial',
    desc: 'Lê HTML da página da fabricante e extrai specs estruturados.',
    tier: 'fast' },
  { id: 'compare_analysis',     label: 'Análise comparativa',
    desc: 'Briefing executivo com vencedor por dimensão + ranking de vendas BR + recomendação Ford.',
    tier: 'smart' },
  { id: 'client_insight',       label: 'XAI por cliente',
    desc: 'Explica em PT-BR por que o cliente foi classificado naquele perfil + ação concreta.',
    tier: 'fast' },
  { id: 'portfolio_insight',    label: 'Briefing de portfolio',
    desc: 'Análise estratégica da carteira da concessionária — risco, upsell, recomendação.',
    tier: 'smart' },
];

export default function Configuracoes() {
  const [tab, setTab] = useState<'keys' | 'functions'>('keys');
  const [keysStatus, setKeysStatus] = useState<Record<string, { configured: boolean; source: string; preview?: string }>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [keyErr, setKeyErr] = useState<string | null>(null);

  const [models, setModels] = useState<Record<string, { id: string; label: string; tier: string }[]>>({});
  const [functionModels, setFunctionModels] = useState<Record<string, string>>({});
  const [savingFn, setSavingFn] = useState<string | null>(null);

  async function reloadKeys() {
    try { setKeysStatus(await api.getAiKeys()); } catch (e: any) { setKeyErr(e.message); }
  }
  async function reloadModels() {
    try {
      setModels(await api.getAiModels());
      const fns = await api.getFunctionModels();
      const map: Record<string, string> = {};
      for (const f of fns) map[f.function_name] = f.model_id;
      setFunctionModels(map);
    } catch (e: any) { console.error(e); }
  }

  useEffect(() => { reloadKeys(); reloadModels(); }, []);

  async function saveKey(provider: 'openai' | 'anthropic' | 'gemini' | 'fipe') {
    const key = keyInputs[provider]?.trim();
    if (!key) return;
    setSavingKey(provider); setKeyErr(null);
    try {
      await api.setAiKey(provider, key);
      setKeyInputs(s => ({ ...s, [provider]: '' }));
      await reloadKeys();
    } catch (e: any) {
      setKeyErr(`${provider}: ${e.message}`);
    } finally { setSavingKey(null); }
  }

  async function deleteKey(provider: string) {
    if (!confirm(`Remover chave ${provider}?`)) return;
    setSavingKey(provider); setKeyErr(null);
    try {
      await api.deleteAiKey(provider);
      await reloadKeys();
    } catch (e: any) {
      setKeyErr(`${provider}: ${e.message}`);
    } finally { setSavingKey(null); }
  }

  async function setFunctionModel(fn: AiFunction, model_id: string) {
    setSavingFn(fn);
    try {
      if (!model_id) await api.clearFunctionModel(fn);
      else await api.setFunctionModel(fn, model_id);
      if (typeof window !== 'undefined') {
        if (model_id) localStorage.setItem(`ai_model_${fn}`, model_id);
        else localStorage.removeItem(`ai_model_${fn}`);
      }
      setFunctionModels(s => ({ ...s, [fn]: model_id }));
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally { setSavingFn(null); }
  }

  return (
    <Shell>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-7 h-7 text-ford-blue" />
          <h1 className="text-3xl font-bold text-ford-blue">Configurações de IA</h1>
        </div>
        <p className="text-gray-600 mb-8">Gerencie chaves de API e escolha qual modelo roda cada função.</p>

        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button onClick={() => setTab('keys')}
            className={`px-5 py-3 font-medium transition border-b-2 inline-flex items-center gap-2 ${tab === 'keys' ? 'border-ford-blue text-ford-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Key className="w-4 h-4" /> Chaves de API
          </button>
          <button onClick={() => setTab('functions')}
            className={`px-5 py-3 font-medium transition border-b-2 inline-flex items-center gap-2 ${tab === 'functions' ? 'border-ford-blue text-ford-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Brain className="w-4 h-4" /> Modelo por função
          </button>
        </div>

        {keyErr && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4">{keyErr}</div>}

        {tab === 'keys' && (
          <div className="space-y-4">
            {PROVIDERS.map(p => {
              const status = keysStatus[p.id];
              const configured = status?.configured;
              const fromEnv = status?.source === 'env';
              return (
                <div key={p.id} className={`bg-white rounded-2xl border-2 p-6 transition ${configured ? 'border-emerald-300' : 'border-gray-300'}`}>
                  <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-ford-blue/10">
                        <Bot className="w-5 h-5 text-ford-blue" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{p.name}</h2>
                        <a href={p.url} target="_blank" rel="noopener"
                          className="text-xs text-ford-blue hover:underline inline-flex items-center gap-1">
                          Obter chave <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    {configured ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                          <Check className="w-3 h-3" /> {fromEnv ? 'env var' : 'banco'}
                        </span>
                        {status?.preview && (
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{status.preview}</code>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider">
                        <X className="w-3 h-3" /> não configurado
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-[300px] relative">
                      <input
                        type={keyVisible[p.id] ? 'text' : 'password'}
                        placeholder={configured ? '••• Sobrescrever chave atual' : `Cole sua chave ${p.name}`}
                        value={keyInputs[p.id] ?? ''}
                        onChange={e => setKeyInputs(s => ({ ...s, [p.id]: e.target.value }))}
                        className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-ford-blue font-mono text-sm"
                      />
                      <button type="button" onClick={() => setKeyVisible(s => ({ ...s, [p.id]: !s[p.id] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {keyVisible[p.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button onClick={() => saveKey(p.id)} disabled={savingKey === p.id || !keyInputs[p.id]}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-ford-blue text-white font-medium rounded-xl hover:bg-ford-blue-dark transition disabled:opacity-50">
                      {savingKey === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Salvar
                    </button>
                    {configured && !fromEnv && (
                      <button onClick={() => deleteKey(p.id)} disabled={savingKey === p.id}
                        className="inline-flex items-center gap-2 px-3 py-2.5 border border-red-300 text-red-700 hover:bg-red-50 rounded-xl transition disabled:opacity-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {fromEnv && (
                    <p className="text-xs text-gray-500 mt-3">
                      ⚠ Chave vem de variável de ambiente. Salvar aqui sobrescreve no banco.
                    </p>
                  )}
                </div>
              );
            })}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
              <strong>Como funciona:</strong> backend tenta env var primeiro, depois chave salva aqui no banco.
              Cada chamada de IA escolhe o provedor baseado no modelo configurado em "Modelo por função".
              Sem chave para o provedor selecionado, o sistema tenta os outros disponíveis automaticamente.
            </div>
          </div>
        )}

        {tab === 'functions' && (
          <div className="space-y-4">
            {FUNCTIONS.map(f => {
              const current = functionModels[f.id] ?? '';
              const allOptions = [
                { id: '', label: '— Padrão do sistema —', provider: '' },
                ...(['openai', 'anthropic', 'gemini'] as const).flatMap(p =>
                  (models[p] ?? []).map(m => ({
                    id: `${p}:${m.id}`,
                    label: `${m.label} (${m.tier === 'fast' ? 'rápido' : 'smart'})`,
                    provider: p,
                  }))
                ),
              ];
              return (
                <div key={f.id} className="bg-white rounded-2xl border-2 border-gray-300 p-6">
                  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-ford-blue" />
                        <h3 className="text-base font-bold text-gray-900">{f.label}</h3>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${f.tier === 'fast' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {f.tier}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{f.desc}</p>
                    </div>
                  </div>
                  <select value={current} onChange={e => setFunctionModel(f.id, e.target.value)}
                    disabled={savingFn === f.id}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:border-ford-blue">
                    {allOptions.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.provider && `[${o.provider}] `}{o.label}
                      </option>
                    ))}
                  </select>
                  {savingFn === f.id && <p className="text-xs text-gray-500 mt-2"><Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Salvando…</p>}
                </div>
              );
            })}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              <strong>Dica:</strong> use <strong>modelos "fast"</strong> (gpt-4o-mini, Haiku, Gemini Flash) para extração e XAI —
              são baratos e rápidos. <strong>"Smart"</strong> (gpt-4o, Sonnet, Pro) para análises estratégicas.
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
