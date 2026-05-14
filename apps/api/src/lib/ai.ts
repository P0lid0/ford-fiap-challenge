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

export function aiAvailable(): boolean {
  return !!openai || !!anthropic;
}

export async function chat(prompt: string, tier: AiTier = 'fast'): Promise<AiResult> {
  if (openai) {
    const model = tier === 'fast' ? env.OPENAI_MODEL_FAST : env.OPENAI_MODEL_SMART;
    try {
      const r = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'Você é um analista sênior de retenção da rede Ford. Responda sempre em português brasileiro, claro e objetivo. Sem floreio.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: tier === 'fast' ? 400 : 600,
        temperature: 0.4,
      });
      const output = r.choices[0]?.message?.content?.trim() ?? '';
      return { output, model, provider: 'openai' };
    } catch (err: any) {
      console.error('[ai] openai failed', err?.message);
    }
  }
  if (anthropic) {
    const model = tier === 'fast' ? env.CLAUDE_MODEL_FAST : env.CLAUDE_MODEL_SMART;
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
