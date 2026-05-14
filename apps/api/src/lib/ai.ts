// Abstração mínima de LLM. Estratégia:
//   1. Se OPENAI_API_KEY estiver setado → usa OpenAI (preferência atual).
//   2. Senão, se ANTHROPIC_API_KEY estiver setado → usa Anthropic.
//   3. Senão, devolve fallback rule-based.
//
// Os endpoints de insights chamam `chat()` sem se preocupar com qual provedor está ativo.

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config.js';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

export type AiTier = 'fast' | 'smart';

export type AiResult = {
  output: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'fallback';
};

/** Modelos disponíveis — UI usa pra dropdown. */
export const AVAILABLE_MODELS = {
  openai: [
    { id: 'gpt-4o-mini',         label: 'GPT-4o mini (rápido, barato)', tier: 'fast' },
    { id: 'gpt-4o',              label: 'GPT-4o (smart)', tier: 'smart' },
    { id: 'gpt-4.1-mini',        label: 'GPT-4.1 mini (novo)', tier: 'fast' },
    { id: 'gpt-4.1',             label: 'GPT-4.1', tier: 'smart' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'fast' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', tier: 'smart' },
  ],
} as const;

export function aiAvailable(): boolean {
  return !!openai || !!anthropic;
}

export type ChatOpts = {
  systemOverride?: string;
  /** Sobrescreve o modelo padrão (vindo do header X-AI-Model). */
  modelOverride?: string;
};

export async function chat(prompt: string, tier: AiTier = 'fast', opts: ChatOpts = {}): Promise<AiResult> {
  const system = opts.systemOverride ?? 'Você é um analista sênior de retenção da rede Ford. Responda sempre em português brasileiro, claro e objetivo. Sem floreio.';
  const override = opts.modelOverride?.trim();

  // Roteia para o provider baseado no prefixo do modelOverride.
  // Aceita: "gpt-*" ou "openai:..." → OpenAI ; "claude-*" ou "anthropic:..." → Anthropic
  const isClaude = override && (override.startsWith('claude-') || override.startsWith('anthropic:'));
  const isOpenAi = override && (override.startsWith('gpt-') || override.startsWith('openai:'));
  const forceClaude = isClaude && anthropic;
  const forceOpenAi = isOpenAi && openai;

  if (openai && !forceClaude) {
    const model = override
      ? override.replace(/^openai:/, '')
      : (tier === 'fast' ? env.OPENAI_MODEL_FAST : env.OPENAI_MODEL_SMART);
    try {
      const r = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_tokens: tier === 'fast' ? 400 : 900,
        temperature: 0.4,
      });
      const output = r.choices[0]?.message?.content?.trim() ?? '';
      return { output, model, provider: 'openai' };
    } catch (err: any) {
      console.error('[ai] openai failed', err?.message);
    }
  }
  if (anthropic && !forceOpenAi) {
    const model = override
      ? override.replace(/^anthropic:/, '')
      : (tier === 'fast' ? env.CLAUDE_MODEL_FAST : env.CLAUDE_MODEL_SMART);
    try {
      const msg = await anthropic.messages.create({
        model,
        max_tokens: tier === 'fast' ? 400 : 600,
        messages: [{ role: 'user', content: prompt }],
      });
      const output = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
      return { output, model, provider: 'anthropic' };
    } catch (err: any) {
      console.error('[ai] anthropic failed', err?.message);
    }
  }
  return { output: '', model: 'fallback', provider: 'fallback' };
}
