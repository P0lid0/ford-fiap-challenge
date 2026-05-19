/**
 * Extração estruturada a partir de PDFs e imagens via modelos multimodais.
 *
 * Estratégia:
 *  - PDFs → Anthropic Claude (suporte nativo a `document`, sem precisar converter
 *    para imagens server-side). Usa Sonnet/Haiku do que estiver disponível.
 *  - Imagens (PNG/JPG/WEBP) → OpenAI gpt-4o-mini (vision, barato) com fallback
 *    pra Anthropic se OpenAI falhar.
 *
 * Cada chamada permite limite de páginas (Anthropic processa PDF inteiro mas
 * cobra por imagem-equivalente; 156 páginas custam caro). Por isso defaultamos
 * a `null` (sem limite) — quem chama decide.
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getApiKey, chat as aiChat } from './ai.js';

// pdf-parse v2 expõe classe PDFParse (não export default).
async function pdfToText(buf: Buffer): Promise<string> {
  const mod = (await import('pdf-parse')) as any;
  const parser = new mod.PDFParse({ data: buf });
  const r = await parser.getText() as { text?: string };
  return r.text ?? '';
}

// Heurística pra decidir se vale texto vs vision.
// Catálogos/fichas técnicas textuais: 5k+ chars com palavras-chave técnicas.
// E-books marketing (só imagem): texto vazio ou só metadata.
function hasUsableText(text: string): boolean {
  if (!text || text.length < 3000) return false;
  const t = text.toLowerCase();
  const keywords = ['potência', 'cilindrada', 'torque', 'cv', 'cavalo', 'kw', 'nm',
    'consumo', 'km/l', 'km/h', 'tração', 'motor', 'volume', 'porta-malas',
    'horsepower', 'displacement', 'mpg', 'transmission'];
  const hits = keywords.filter(k => t.includes(k)).length;
  return hits >= 3;
}

export type VisionInput = {
  mediaType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';
  data: Buffer;
  filename?: string;
};

export type VisionResult = {
  output: string;
  model: string;
  provider: 'anthropic' | 'openai' | 'gemini' | 'fallback';
};

const ANTHROPIC_PDF_MODEL = 'claude-sonnet-4-6';            // melhor com docs longos
const ANTHROPIC_IMG_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_VISION_MODEL = 'gpt-4o-mini';

/**
 * Roda extração híbrida com a estratégia mais barata possível:
 *
 *   PDF com texto extraível (catálogos, fichas técnicas)
 *     → pdf-parse + GPT-4o-mini (~$0.01 por extração)
 *   PDF puramente imagem (e-books de marketing tipo F-150)
 *     → Claude Sonnet com PDF nativo (~$0.50-1.00 por extração)
 *   Imagem (PNG/JPG)
 *     → OpenAI gpt-4o-mini vision (barato) com fallback Anthropic
 *
 * Heurística: se pdf-parse retorna 3000+ chars com 3+ palavras-chave técnicas,
 * vai pela rota textual. Caso contrário, cai pra vision.
 */
export async function extractFromFile(
  input: VisionInput,
  system: string,
  userPrompt: string,
  opts: { maxTokens?: number; modelOverride?: string; forceVision?: boolean } = {},
): Promise<VisionResult> {
  const maxTokens = opts.maxTokens ?? 4000;
  const isPdf = input.mediaType === 'application/pdf';

  const anthropicKey = await getApiKey('anthropic');
  const openaiKey = await getApiKey('openai');

  // === ROTA TEXTO (PDFs com texto extraível) ===
  if (isPdf && !opts.forceVision) {
    try {
      const text = await pdfToText(input.data);
      if (hasUsableText(text)) {
        console.log(`[ai-vision] PDF tem ${text.length} chars de texto extraível — usando rota textual (barata)`);
        const r = await aiChat(
          `${userPrompt}\n\n=== TEXTO EXTRAÍDO DO PDF ===\n${text.slice(0, 80_000)}`, // 80k chars ~ 20k tokens
          'fast',
          {
            systemOverride: system,
            modelOverride: opts.modelOverride,
            jsonObjectMode: true,
            maxTokens,
          },
        );
        if (r.output) {
          return { output: r.output, model: r.model, provider: r.provider };
        }
      } else {
        console.log(`[ai-vision] PDF tem só ${text.length} chars (sem palavras-chave) — usando vision`);
      }
    } catch (err: any) {
      console.warn('[ai-vision] pdf-parse falhou:', err?.message, '— caindo pro vision');
    }
  }

  // === ROTA VISION ===
  // PDFs e imagens: OpenAI suporta ambos (PDF via type:file, imagem via image_url).
  // Fallback Anthropic se OpenAI falhar ou não estiver configurado.
  if (openaiKey) {
    try {
      console.log(`[ai-vision] tentando OpenAI vision (${input.mediaType})`);
      return await runOpenAi(input, system, userPrompt, openaiKey, maxTokens, opts.modelOverride);
    } catch (err: any) {
      console.warn('[ai-vision] OpenAI vision falhou:', err?.message, '— tentando Anthropic');
    }
  }
  if (anthropicKey) {
    return await runAnthropic(input, system, userPrompt, anthropicKey, maxTokens, opts.modelOverride);
  }
  throw new Error('Nenhum provider de IA com suporte a vision configurado. ' +
    'Configure OpenAI ou Anthropic em /configuracoes.');
}

async function runAnthropic(
  input: VisionInput,
  system: string,
  userPrompt: string,
  apiKey: string,
  maxTokens: number,
  modelOverride?: string,
): Promise<VisionResult> {
  const client = new Anthropic({ apiKey });
  const model = modelOverride?.replace(/^anthropic:/, '')
    ?? (input.mediaType === 'application/pdf' ? ANTHROPIC_PDF_MODEL : ANTHROPIC_IMG_MODEL);

  const base64 = input.data.toString('base64');
  const content: any[] = [];
  if (input.mediaType === 'application/pdf') {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    });
  } else {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: input.mediaType, data: base64 },
    });
  }
  content.push({ type: 'text', text: userPrompt });

  const msg = await client.messages.create({
    model,
    system,
    max_tokens: maxTokens,
    temperature: 0, // extração literal — sem criatividade
    messages: [{ role: 'user', content }],
  });

  if (msg.stop_reason === 'max_tokens') {
    console.warn(`[ai-vision] anthropic:${model} truncated at ${maxTokens} tokens`);
  }

  const text = msg.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');

  return { output: text, model, provider: 'anthropic' };
}

async function runOpenAi(
  input: VisionInput,
  system: string,
  userPrompt: string,
  apiKey: string,
  maxTokens: number,
  modelOverride?: string,
): Promise<VisionResult> {
  const client = new OpenAI({ apiKey });
  const model = modelOverride?.replace(/^openai:/, '') ?? OPENAI_VISION_MODEL;
  const base64 = input.data.toString('base64');

  // OpenAI chat.completions aceita PDF direto via `type: 'file'` (Q4 2024+).
  // Imagens vão por `type: 'image_url'` com data URL.
  const filePart = input.mediaType === 'application/pdf'
    ? {
        type: 'file',
        file: {
          filename: input.filename ?? 'document.pdf',
          file_data: `data:application/pdf;base64,${base64}`,
        },
      }
    : {
        type: 'image_url',
        image_url: { url: `data:${input.mediaType};base64,${base64}` },
      };

  const r = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature: 0, // extração literal — sem criatividade
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [filePart as any, { type: 'text', text: userPrompt }] as any,
      },
    ],
  });

  if (r.choices[0]?.finish_reason === 'length') {
    console.warn(`[ai-vision] openai:${model} truncated at ${maxTokens} tokens`);
  }

  return {
    output: r.choices[0]?.message?.content?.trim() ?? '',
    model,
    provider: 'openai',
  };
}
