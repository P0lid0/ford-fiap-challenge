'use client';
import { useEffect, useState } from 'react';
import { Settings, Save, Sparkles } from 'lucide-react';
import { Shell } from '@/components/Shell';

const MODELS = [
  { id: '', label: 'Padrão do sistema (gpt-4o-mini)', provider: 'openai', tier: 'fast', default: true },
  { id: 'gpt-4o-mini',                label: 'OpenAI · GPT-4o mini (rápido, econômico)', provider: 'openai', tier: 'fast' },
  { id: 'gpt-4o',                     label: 'OpenAI · GPT-4o (smart)',                  provider: 'openai', tier: 'smart' },
  { id: 'gpt-4.1-mini',               label: 'OpenAI · GPT-4.1 mini',                    provider: 'openai', tier: 'fast' },
  { id: 'gpt-4.1',                    label: 'OpenAI · GPT-4.1',                          provider: 'openai', tier: 'smart' },
  { id: 'claude-haiku-4-5-20251001',  label: 'Anthropic · Claude Haiku 4.5',             provider: 'anthropic', tier: 'fast' },
  { id: 'claude-sonnet-4-6',          label: 'Anthropic · Claude Sonnet 4.6',            provider: 'anthropic', tier: 'smart' },
];

export default function Configuracoes() {
  const [selected, setSelected] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setSelected(localStorage.getItem('ai_model') || '');
  }, []);

  function save() {
    if (selected) localStorage.setItem('ai_model', selected);
    else localStorage.removeItem('ai_model');
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  return (
    <Shell>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-7 h-7 text-ford-blue" />
          <h1 className="text-3xl font-bold text-ford-blue">Configurações</h1>
        </div>
        <p className="text-gray-600 mb-8">Personalize qual IA roda cada função.</p>

        <div className="bg-white rounded-2xl border border-gray-300 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-ford-blue" />
            <h2 className="text-lg font-bold text-gray-900">Modelo de IA</h2>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            Define qual modelo será usado em:<br />
            • <strong>Busca de carro</strong> (extração + preenchimento de gaps)<br />
            • <strong>Análise comparativa</strong> de veículos<br />
            • <strong>XAI por cliente</strong> e <strong>briefing de carteira</strong>
          </p>

          <div className="space-y-2">
            {MODELS.map(m => (
              <label key={m.id || 'default'}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 cursor-pointer transition ${selected === m.id ? 'border-ford-blue bg-ford-blue/5' : 'border-gray-300 hover:border-gray-400'}`}>
                <input type="radio" name="ai_model" value={m.id} checked={selected === m.id}
                  onChange={e => setSelected(e.target.value)} className="accent-ford-blue" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{m.label}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                    {m.provider} · {m.tier === 'fast' ? 'rápido/barato' : 'mais inteligente'}
                  </div>
                </div>
                {m.default && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md uppercase tracking-wider font-bold">
                    padrão
                  </span>
                )}
              </label>
            ))}
          </div>

          <button onClick={save}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-ford-blue text-white font-medium rounded-xl hover:bg-ford-blue-dark transition">
            <Save className="w-4 h-4" /> Salvar preferência
          </button>
          {savedFlash && <span className="ml-3 text-success font-medium">✓ Salvo</span>}
        </div>

        <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-600">
          <strong className="text-gray-800">Como funciona:</strong> a preferência é salva no seu navegador
          (localStorage) e enviada no header <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">X-AI-Model</code>
          em cada chamada. O backend usa esse modelo se disponível, ou cai no padrão.
        </div>
      </div>
    </Shell>
  );
}
