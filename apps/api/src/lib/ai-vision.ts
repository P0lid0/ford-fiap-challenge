/**
 * Extração estruturada a partir de PDFs e imagens via modelos multimodais.
 *
 * ESTRATÉGIA (ordem de custo crescente):
 *   1. pdf-parse (grátis, local)        → tenta extrair texto literal do PDF
 *   2. gpt-4o-mini (texto)              → estrutura JSON a partir do texto (~$0.01)
 *   3. gpt-4o-mini (vision)             → quando PDF/imagem não tem texto extraível (~$0.05)
 *   4. claude-haiku (vision fallback)   → quando OpenAI falhou ou não está configurado
 *
 * NUNCA usamos Sonnet/Opus pra extração — vision em e-book inteiro custa $1+
 * e a precisão extra não compensa pra ficha técnica.
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

// Heurística pra decidir se o texto extraído vale a pena.
// Catálogos/fichas técnicas textuais: 1500+ chars com palavras-chave técnicas.
// E-books marketing (só imagem): texto vazio ou só metadata.
// Threshold reduzido (era 3000 chars / 3 keywords) pra cobrir mais PDFs sem cair
// pra vision caro.
function hasUsableText(text: string): boolean {
  if (!text || text.length < 1500) return false;
  const t = text.toLowerCase();
  const keywords = [
    // Português
    'potência', 'cilindrada', 'torque', 'cv', 'cavalo', 'kw', 'nm',
    'consumo', 'km/l', 'km/h', 'tração', 'motor', 'volume', 'porta-malas',
    'transmissão', 'câmbio', 'marchas', 'combustível', 'gasolina', 'diesel',
    'flex', 'aspirado', 'turbo', 'cilindros', 'cilindradas',
    // Inglês
    'horsepower', 'displacement', 'mpg', 'transmission', 'engine', 'torque',
    // Estruturais
    'versão', 'versao', 'modelo', 'ano', 'preço', 'equipamentos',
  ];
  const hits = new Set(keywords.filter(k => t.includes(k))).size;
  return hits >= 2;  // antes era 3 — mais permissivo agora
}

// Verifica se o JSON devolvido pela IA parece um veículo válido.
// Usado pra detectar quando o texto extraído gerou lixo e a gente precisa
// cair pra vision como fallback.
function isLikelyValidVehicleJson(raw: string): boolean {
  if (!raw || raw.length < 30) return false;
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const obj = JSON.parse(cleaned);
    if (!obj) return false;
    // Esperamos { veiculos: [...] } ou um veículo direto com marca/modelo
    const veics = Array.isArray(obj.veiculos) ? obj.veiculos
      : Array.isArray(obj) ? obj
      : (obj.marca || obj.modelo) ? [obj] : [];
    if (veics.length === 0) return false;
    // Pelo menos 1 veículo precisa ter marca + modelo
    return veics.some((v: any) => v && (v.marca || v.modelo));
  } catch {
    return false;
  }
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

// Defaults BARATOS — usamos Haiku pra TUDO em Anthropic (PDF + imagem).
// Sonnet/Opus só quando o usuário escolhe explicitamente via modelOverride.
// Pricing aproximado (jan/2026):
//   gpt-4o-mini text:    $0.15/1M input + $0.60/1M output  → ~$0.01-0.05 por extração
//   gpt-4o-mini vision:  $0.15/1M input + $0.60/1M output  → ~$0.05-0.15 por imagem
//   claude-haiku 4.5:    $0.80/1M input + $4.00/1M output  → ~$0.05-0.20 por extração
//   claude-sonnet 4.6:   $3.00/1M input + $15.00/1M output → ~$0.30-1.50  ← EVITAR
const ANTHROPIC_PDF_MODEL = 'claude-haiku-4-5-20251001';    // barato, vision-capable
const ANTHROPIC_IMG_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_VISION_MODEL = 'gpt-4o-mini';                  // o mais barato com vision

/**
 * Roda extração híbrida priorizando a rota MAIS BARATA possível:
 *
 *   1. PDF → pdf-parse (local, grátis) → se extrai 1500+ chars com keywords técnicas
 *      → gpt-4o-mini text (~$0.01 por extração). Valida o JSON devolvido.
 *      → Se JSON inválido/vazio, cai pra vision.
 *
 *   2. Vision fallback (PDF imagem ou imagem real):
 *      → OpenAI gpt-4o-mini vision (~$0.05-0.15)
 *      → Se OpenAI falhar, Anthropic Claude Haiku (~$0.05-0.20)
 *
 * Nunca usamos Sonnet/Opus por default — Haiku basta pra extrair ficha técnica
 * e custa ~5x menos.
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

  // === ROTA 1: PDF com texto extraível (a MAIS BARATA) ===
  if (isPdf && !opts.forceVision) {
    let extractedText = '';
    try {
      extractedText = await pdfToText(input.data);
      console.log(`[ai-vision] pdf-parse extraiu ${extractedText.length} chars`);
    } catch (err: any) {
      console.warn('[ai-vision] pdf-parse falhou:', err?.message);
    }

    if (extractedText && hasUsableText(extractedText)) {
      console.log(`[ai-vision] ✓ texto extraível bom (${extractedText.length} chars) → rota textual gpt-4o-mini (~$0.01)`);
      try {
        const r = await aiChat(
          `${userPrompt}\n\n=== TEXTO EXTRAÍDO DO PDF ===\n${extractedText.slice(0, 80_000)}`,
          'fast',  // tier fast = gpt-4o-mini / claude-haiku / gemini-flash (todos baratos)
          {
            systemOverride: system,
            modelOverride: opts.modelOverride,
            jsonObjectMode: true,
            maxTokens,
          },
        );
        // VALIDA o resultado — se a IA devolveu JSON vazio/lixo, cai pra vision
        if (r.output && isLikelyValidVehicleJson(r.output)) {
          console.log(`[ai-vision] ✓ JSON válido pela rota textual (${r.provider}:${r.model})`);
          return { output: r.output, model: r.model, provider: r.provider };
        }
        console.warn(`[ai-vision] ⚠ rota textual devolveu JSON inválido/vazio — fallback pra vision`);
      } catch (err: any) {
        console.warn('[ai-vision] rota textual falhou:', err?.message, '— fallback pra vision');
      }
    } else {
      console.log(`[ai-vision] texto insuficiente (${extractedText.length} chars) → rota visual`);
    }
  }

  // === ROTA 2: VISION (PDF imagem ou imagem real) — ainda usando modelos baratos ===
  // OpenAI gpt-4o-mini é o mais barato com vision. Fallback Anthropic Haiku.
  if (openaiKey) {
    try {
      console.log(`[ai-vision] vision via OpenAI gpt-4o-mini (${input.mediaType})`);
      return await runOpenAi(input, system, userPrompt, openaiKey, maxTokens, opts.modelOverride);
    } catch (err: any) {
      console.warn('[ai-vision] OpenAI vision falhou:', err?.message, '— tentando Anthropic Haiku');
    }
  }
  if (anthropicKey) {
    console.log(`[ai-vision] vision via Anthropic Claude Haiku`);
    return await runAnthropic(input, system, userPrompt, anthropicKey, maxTokens, opts.modelOverride);
  }
  throw new Error('Nenhum provider de IA com suporte a vision configurado. ' +
    'Configure OpenAI (recomendado pelo custo) ou Anthropic em /configuracoes.');
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
