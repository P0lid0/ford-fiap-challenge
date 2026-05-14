/**
 * Scraper híbrido: HTML do site oficial da fabricante → texto principal → OpenAI extrai specs.
 *
 * Por que híbrido?
 * - Site oficial = informação 100% legítima (não invenção da IA).
 * - IA faz EXTRAÇÃO estruturada (não recall de memória) → muito mais confiável.
 * - `data_sources` registra a URL exata da página. Auditável.
 *
 * Cobertura testada em 14/05/2026:
 *   ✅ Toyota, Volkswagen, RAM, Chevrolet, Renault — HTML acessível
 *   ❌ Ford, Honda — bloqueio Cloudflare WAF (403)
 *   ❌ Hyundai, Fiat, Nissan — URL pattern não encontrada
 *
 * Os bloqueados caem no fallback de IA pura no aggregator.
 */
import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { env } from '../../config.js';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Resolve URL provável do site oficial para (marca, modelo, versao?). */
export function resolveManufacturerUrl(marca: string, modelo: string, versao?: string): string | null {
  const m = marca.toLowerCase().trim();
  const mod = modelo.toLowerCase().trim();
  const v = versao?.toLowerCase().trim() ?? '';

  // Mapas validados em 14/05/2026
  switch (m) {
    case 'toyota':
      // Hilux → hilux-cabine-dupla. Outros: corolla, yaris, etc.
      if (mod.includes('hilux')) return 'https://www.toyota.com.br/modelos/hilux-cabine-dupla';
      return `https://www.toyota.com.br/modelos/${mod}`;
    case 'volkswagen':
    case 'vw':
      return `https://www.vw.com.br/pt/carros/${mod}.html`;
    case 'ram':
      // RAM: 1500, 2500, 3000, Rampage, Dakota
      return `https://www.ram.com.br/picapes/${mod}.html`;
    case 'chevrolet':
    case 'gm':
      // S10, Tracker, Onix, Cruze, Spin
      if (['s10', 'silverado', 'montana'].includes(mod)) return `https://www.chevrolet.com.br/picapes/${mod}`;
      if (['tracker', 'equinox', 'trailblazer'].includes(mod)) return `https://www.chevrolet.com.br/suvs/${mod}`;
      return `https://www.chevrolet.com.br/carros/${mod}`;
    case 'renault':
      return `https://www.renault.com.br/veiculos/${mod}.html`;
    default:
      return null;
  }
}

/**
 * Extrai texto principal de um HTML, removendo nav/footer/scripts.
 * Mantém só o conteúdo provável da ficha técnica.
 */
function extractMainText(html: string): string {
  const $ = cheerio.load(html);
  // Remove o que claramente não é conteúdo
  $('script, style, nav, footer, header, iframe, noscript').remove();
  $('[class*="cookie"], [class*="banner"], [class*="popup"]').remove();

  // Prioridade: blocos que claramente têm specs
  const specBlocks: string[] = [];
  $('[class*="spec"], [class*="ficha"], [class*="technical"], [class*="motor"], [class*="dimens"], table, dl').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 60 && text.length < 5000) specBlocks.push(text);
  });

  if (specBlocks.length > 0) {
    return specBlocks.join('\n\n').slice(0, 18000);
  }

  // Fallback: texto do body inteiro
  return ($('body').text() || $.text())
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18000);
}

const EXTRACTOR_SYSTEM = `Você é um EXTRATOR de specs técnicos. Sua única tarefa é PARSEAR o texto fornecido
e devolver JSON estruturado com os specs que ESTÃO LITERALMENTE no texto.

REGRAS ABSOLUTAS:
- Responda APENAS com JSON válido. Sem markdown.
- Se um spec NÃO aparece no texto, use null. JAMAIS infira.
- NÃO use seu conhecimento prévio do modelo — extraia somente o que está no texto.
- Unidades: cc, cv, Nm, mm, kg, km/h, km/l, L.
- combustivel ∈ [gasolina, etanol, flex, diesel, diesel_s10, eletrico, hibrido, hibrido_plugin, gnv]
- categoria ∈ [hatch, sedan, suv, picape_compacta, picape_media, picape_grande, minivan, cupe, conversivel, comercial]
- equipamentos: lista snake_case dos itens listados no texto (max 15).

Formato:
{
  "categoria": str|null,
  "motor": { "cilindrada_cc": int|null, "potencia_cv": int|null, "torque_nm": int|null,
             "combustivel": str|null, "aspiracao": str|null, "cilindros": int|null },
  "dimensoes": { "comprimento_mm": int|null, "largura_mm": int|null, "altura_mm": int|null,
                 "entre_eixos_mm": int|null, "vao_livre_mm": int|null, "peso_kg": int|null,
                 "capacidade_porta_malas_l": int|null, "capacidade_cacamba_l": int|null,
                 "capacidade_carga_kg": int|null, "capacidade_reboque_kg": int|null },
  "transmissao": { "tipo": str|null, "marchas": int|null, "tracao": str|null },
  "desempenho": { "aceleracao_0_100_s": float|null, "velocidade_max_kmh": int|null,
                  "consumo_cidade_kml": float|null, "consumo_estrada_kml": float|null,
                  "autonomia_km": int|null },
  "equipamentos": [str]
}`;

export type ManufacturerExtraction = {
  data: any;
  source_url: string;
  page_length: number;
  extracted_at: string;
};

/**
 * Faz fetch da página oficial e extrai specs com IA EXTRATORA (não recall).
 * Retorna null se URL não responder ou IA não conseguir extrair.
 */
export async function fetchManufacturerSpecs(
  marca: string,
  modelo: string,
  versao?: string,
): Promise<ManufacturerExtraction | null> {
  const url = resolveManufacturerUrl(marca, modelo, versao);
  if (!url) return null;

  let html: string;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!r.ok) return null;
    html = await r.text();
    if (html.length < 2000) return null; // página vazia/SPA
  } catch {
    return null;
  }

  const mainText = extractMainText(html);
  if (mainText.length < 500) return null;

  if (!openai) return null;

  try {
    const userMsg = `Marca: ${marca}\nModelo: ${modelo}${versao ? ` ${versao}` : ''}\n\nTEXTO DA PÁGINA OFICIAL:\n\n${mainText}`;
    const r = await openai.chat.completions.create({
      model: env.OPENAI_MODEL_FAST,
      response_format: { type: 'json_object' },
      temperature: 0.0,
      messages: [
        { role: 'system', content: EXTRACTOR_SYSTEM },
        { role: 'user', content: userMsg },
      ],
    });
    const text = r.choices[0]?.message?.content?.trim();
    if (!text) return null;
    const data = JSON.parse(text);
    return {
      data,
      source_url: url,
      page_length: html.length,
      extracted_at: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[manufacturer] extraction failed:', err?.message);
    return null;
  }
}
