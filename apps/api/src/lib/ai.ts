/**
 * Camada de IA multi-provedor (OpenAI, Anthropic, Google Gemini).
 *
 * Chave por provedor: env var > tabela ai_keys do Supabase > não-disponível.
 * Modelo: vem em formato "provider:model" (ex: "openai:gpt-4o-mini").
 */
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config.js';
import { adminClient } from './supabase.js';

export type Provider = 'openai' | 'anthropic' | 'gemini';
export type AiTier = 'fast' | 'smart';

export type AiResult = {
  output: string;
  model: string;
  provider: Provider | 'fallback';
};

export const AVAILABLE_MODELS: Record<Provider, { id: string; label: string; tier: AiTier }[]> = {
  openai: [
    { id: 'gpt-4o-mini',  label: 'GPT-4o mini',  tier: 'fast' },
    { id: 'gpt-4o',       label: 'GPT-4o',       tier: 'smart' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', tier: 'fast' },
    { id: 'gpt-4.1',      label: 'GPT-4.1',      tier: 'smart' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  tier: 'fast' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', tier: 'smart' },
    { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7',   tier: 'smart' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash',          label: 'Gemini 2.0 Flash',      tier: 'fast' },
    { id: 'gemini-2.0-flash-lite',     label: 'Gemini 2.0 Flash Lite', tier: 'fast' },
    { id: 'gemini-1.5-pro',            label: 'Gemini 1.5 Pro',        tier: 'smart' },
  ],
};

const DEFAULT_MODEL_FAST: Record<Provider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-2.0-flash',
};
const DEFAULT_MODEL_SMART: Record<Provider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-6',
  gemini: 'gemini-1.5-pro',
};

// === Resolve API key: env > Supabase ai_keys ===
const _keyCache = new Map<Provider, { key: string; expires: number }>();
const KEY_CACHE_TTL = 30_000;

export async function getApiKey(provider: Provider): Promise<string> {
  const envKey = provider === 'openai' ? env.OPENAI_API_KEY
               : provider === 'anthropic' ? env.ANTHROPIC_API_KEY
               : (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '');
  if (envKey) return envKey;
  const cached = _keyCache.get(provider);
  if (cached && cached.expires > Date.now()) return cached.key;
  try {
    const { data } = await adminClient().from('ai_keys').select('api_key').eq('provider', provider).maybeSingle();
    const dbKey = data?.api_key ?? '';
    _keyCache.set(provider, { key: dbKey, expires: Date.now() + KEY_CACHE_TTL });
    return dbKey;
  } catch {
    return '';
  }
}

export function clearKeyCache() { _keyCache.clear(); }

export function parseModelId(id: string | undefined): { provider: Provider; model: string } | null {
  if (!id) return null;
  if (id.includes(':')) {
    const [provider, ...rest] = id.split(':');
    if (provider === 'openai' || provider === 'anthropic' || provider === 'gemini') {
      return { provider: provider as Provider, model: rest.join(':') };
    }
    return null;
  }
  if (id.startsWith('gpt-') || id.startsWith('o1-') || id.startsWith('chatgpt')) return { provider: 'openai', model: id };
  if (id.startsWith('claude-')) return { provider: 'anthropic', model: id };
  if (id.startsWith('gemini-')) return { provider: 'gemini', model: id };
  return null;
}

export async function aiAvailable(): Promise<boolean> {
  for (const p of ['openai', 'anthropic', 'gemini'] as Provider[]) {
    if (await getApiKey(p)) return true;
  }
  return false;
}

export type ChatOpts = {
  systemOverride?: string;
  modelOverride?: string;       // "provider:model" ou "model"
  jsonObjectMode?: boolean;     // força JSON output
};

async function chatOpenAi(prompt: string, system: string, model: string, opts: ChatOpts, tier: AiTier): Promise<string> {
  const key = await getApiKey('openai');
  if (!key) throw new Error('OPENAI key not configured');
  const client = new OpenAI({ apiKey: key });
  const r = await client.chat.completions.create({
    model,
    response_format: opts.jsonObjectMode ? { type: 'json_object' } : undefined,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: tier === 'fast' ? 600 : 1200,
    temperature: opts.jsonObjectMode ? 0.1 : 0.4,
  });
  return r.choices[0]?.message?.content?.trim() ?? '';
}

async function chatAnthropic(prompt: string, system: string, model: string, tier: AiTier): Promise<string> {
  const key = await getApiKey('anthropic');
  if (!key) throw new Error('ANTHROPIC key not configured');
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model, system,
    max_tokens: tier === 'fast' ? 600 : 1200,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0]?.type === 'text' ? msg.content[0].text : '';
}

async function chatGemini(prompt: string, system: string, model: string, opts: ChatOpts): Promise<string> {
  const key = await getApiKey('gemini');
  if (!key) throw new Error('GEMINI key not configured');
  const genAI = new GoogleGenerativeAI(key);
  const m = genAI.getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: opts.jsonObjectMode ? { responseMimeType: 'application/json' } : undefined,
  });
  const r = await m.generateContent(prompt);
  return r.response.text().trim();
}

export async function chat(prompt: string, tier: AiTier = 'fast', opts: ChatOpts = {}): Promise<AiResult> {
  const system = opts.systemOverride ?? 'Você é um analista sênior brasileiro. Responda em PT-BR, objetivo, sem floreio.';
  const parsed = parseModelId(opts.modelOverride);

  const tryOrder: Array<{ provider: Provider; model: string }> = parsed ? [parsed] : [];
  for (const p of ['openai', 'anthropic', 'gemini'] as Provider[]) {
    if (parsed?.provider === p) continue;
    const model = tier === 'fast' ? DEFAULT_MODEL_FAST[p] : DEFAULT_MODEL_SMART[p];
    tryOrder.push({ provider: p, model });
  }

  for (const { provider, model } of tryOrder) {
    try {
      let output = '';
      if (provider === 'openai') output = await chatOpenAi(prompt, system, model, opts, tier);
      else if (provider === 'anthropic') output = await chatAnthropic(prompt, system, model, tier);
      else if (provider === 'gemini') output = await chatGemini(prompt, system, model, opts);
      if (output) return { output, model, provider };
    } catch (err: any) {
      console.warn(`[ai] ${provider}:${model} failed:`, err?.message);
    }
  }
  return { output: '', model: 'none', provider: 'fallback' };
}

export function modelFromHeader(req: { headers: Record<string, any> }): string | undefined {
  const m = req.headers['x-ai-model'];
  return typeof m === 'string' ? m : undefined;
}
