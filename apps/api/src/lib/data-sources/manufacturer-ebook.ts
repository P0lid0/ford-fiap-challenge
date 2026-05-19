/**
 * Extrai specs e equipamentos de E-BOOKS/CATÁLOGOS oficiais (PDF) das fabricantes.
 *
 * E-books são a fonte mais COMPLETA disponível — geralmente listam todos os trims,
 * equipamentos por versão, e dimensões com mais detalhe que a página HTML do modelo.
 *
 * Estratégia híbrida:
 *  - Registry curado: URLs confirmadas por marca/modelo (auditável)
 *  - URL custom: front pode passar URL manual quando o user encontrar o PDF
 *  - Extração: Anthropic Claude (suporte nativo a PDF via `document`)
 *
 * Bot detection: Ford BR bloqueia User-Agent não-browser (403). Usamos UA real.
 * Custo: ~$0.50–1.00 por extração com Sonnet 4.6 (e-books têm 50–200 páginas).
 * Cache: confiamos no cache de Vehicle no banco — só roda em força/refresh ou 1ª busca.
 */
import { fetchWithTimeout } from './_http.js';
import { extractFromFile } from '../ai-vision.js';
import { filterEquipamentosBySource } from './manufacturer.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// === Registry curado — URLs validadas em 2026-05-14 ===
// Chaves em lowercase. Modelos sem hyphen no slug (ex: f-150 vira "f-150").
// Para adicionar mais marcas, basta inserir aqui após validar a URL com curl.
const EBOOK_REGISTRY: Record<string, Record<string, string>> = {
  ford: {
    'f-150': 'https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2024/f-150/pdf/fbr-f-150-e-book.pdf',
    'maverick': 'https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2024/maverick/pdf/fbr-maverick-ebook.pdf',
  },
  // toyota: { 'hilux': '...', 'corolla-cross': '...' }, // TODO: validar URLs
  // volkswagen: { 'amarok': '...', 't-cross': '...' },
  // chevrolet: { 's10': '...', 'tracker': '...' },
};

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Resolve URL do e-book oficial. Retorna null se não há registry pra (marca, modelo). */
export function resolveEbookUrl(marca: string, modelo: string): string | null {
  const m = slugify(marca === 'vw' ? 'volkswagen' : marca);
  const mod = slugify(modelo);
  const byBrand = EBOOK_REGISTRY[m];
  if (!byBrand) return null;
  // Match exato → fuzzy (modelo contém ou está contido)
  if (byBrand[mod]) return byBrand[mod]!;
  for (const k of Object.keys(byBrand)) {
    if (mod.includes(k) || k.includes(mod)) return byBrand[k]!;
  }
  return null;
}

export type EbookExtraction = {
  data: any;
  source_url: string;
  size_bytes: number;
  extracted_at: string;
  extracted_by: string;
};

const EXTRACT_SYSTEM = `Você é EXTRATOR LITERAL de specs automotivos a partir de e-books/catálogos PDF
oficiais da fabricante. Os dados extraídos vão direto pro cliente final tomar
DECISÃO DE COMPRA — informação errada quebra a confiança.

REGRA DE OURO: **PREFIRA null A CHUTAR.** Se você não vê literalmente no PDF, valor = null.

REGRAS:
- Responda APENAS com JSON válido. Sem markdown.
- E-books de UMA família (ex: F-150) listam VÁRIAS versões (XL, XLT, Lariat, Platinum).
  Retorne UM ITEM POR VERSÃO no array. NÃO MISTURE equipamentos entre versões.
- Para cada versão: equipamentos de SÉRIE apenas. Se o PDF marca "opcional", NÃO inclua.
- Se o PDF mostra um EQUIPAMENTO ASSOCIADO a outra versão, NÃO atribua à versão atual.
- NÃO use conhecimento prévio do modelo — só o que está NO PDF.
- Campos numéricos: só se LITERALMENTE escritos. NÃO converta hp→cv arbitrariamente
  (mas hp→cv com fator ~1.0 é aceito).
- Equipamentos: liste APENAS o que está mencionado por extenso pra essa versão. Quantidade =
  o que tiver. NÃO INFLE pra atingir um número alvo. 10 reais > 30 inventados.
- Unidades: cc, cv, Nm, mm, kg, km/h, km/l, L.
- combustivel ∈ [gasolina, etanol, flex, diesel, diesel_s10, eletrico, hibrido, hibrido_plugin, gnv]
- categoria ∈ [hatch, sedan, suv, picape_compacta, picape_media, picape_grande, minivan, cupe, conversivel, comercial]

EQUIPAMENTOS — formato "categoria:item_snake_case":
Categorias: seguranca, conforto, tecnologia, assistencia, interior, exterior, cargo, offroad

Formato:
{
  "veiculos": [
    {
      "marca": str, "modelo": str, "versao": str, "ano": int|null,
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
      "equipamentos": ["categoria:item_snake_case", ...],
      "preco_brl": int|null,
      "pais_origem": str|null
    }
  ]
}`;

/**
 * Faz download do PDF + extração via IA multimodal.
 * Retorna null se URL não responde, PDF muito grande (>30MB) ou IA falha.
 */
export async function fetchEbookSpecs(
  url: string,
  hintMarca?: string,
  hintModelo?: string,
  hintVersao?: string,
): Promise<EbookExtraction | null> {
  let buf: Buffer;
  try {
    const r = await fetchWithTimeout(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/pdf,*/*' },
    }, 30_000);
    if (!r.ok) {
      console.warn(`[ebook] ${r.status} ao baixar ${url}`);
      return null;
    }
    const ab = await r.arrayBuffer();
    buf = Buffer.from(ab);
    if (buf.length < 5000) {
      console.warn(`[ebook] PDF muito pequeno (${buf.length}B), provavelmente erro page`);
      return null;
    }
    if (buf.length > 30 * 1024 * 1024) {
      console.warn(`[ebook] PDF muito grande (${(buf.length / 1024 / 1024).toFixed(1)}MB), pulando`);
      return null;
    }
  } catch (err: any) {
    console.warn(`[ebook] erro ao baixar ${url}:`, err?.message);
    return null;
  }

  // Detect content type by magic bytes
  const isPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // "%PDF"
  if (!isPdf) {
    console.warn(`[ebook] arquivo em ${url} não é PDF`);
    return null;
  }

  const userPrompt = `Este é o e-book oficial${hintMarca ? ` da ${hintMarca}` : ''}${hintModelo ? ` para o ${hintModelo}` : ''}.
${hintVersao ? `O usuário pediu específicamente a versão "${hintVersao}" — priorize-a no extrato.` : ''}

LEMBRE: Cada dado errado quebra a confiança do cliente.
- Extraia TODAS as versões presentes (1 item por versão no array).
- Para CADA versão: SÓ equipamentos que aparecem listados como SÉRIE pra ELA.
- Itens marcados "opcional" → fora.
- Itens listados pra OUTRAS versões → fora desta.
- Em dúvida = null ou lista vazia.`;

  try {
    const r = await extractFromFile(
      { mediaType: 'application/pdf', data: buf },
      EXTRACT_SYSTEM,
      userPrompt,
      { maxTokens: 8000 },
    );
    const cleaned = r.output.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      data: parsed,
      source_url: url,
      size_bytes: buf.length,
      extracted_at: new Date().toISOString(),
      extracted_by: `${r.provider}:${r.model}`,
    };
  } catch (err: any) {
    console.error(`[ebook] falha na extração de ${url}:`, err?.message);
    return null;
  }
}

/**
 * Best-match: dado um array de veículos extraídos do e-book + (modelo, versao, ano) alvo,
 * retorna o que mais se aproxima da versão pedida. Critério: tokenized match no nome da versão.
 */
export function pickBestEbookMatch(
  veiculos: any[],
  modelo: string,
  versao?: string,
  ano?: number,
): any | null {
  if (!veiculos?.length) return null;
  const target = (versao ?? modelo).toLowerCase();
  const tokens = target.split(/\s+/).filter(t => t.length >= 2);

  const scored = veiculos.map((v: any) => {
    const candidate = `${v.versao ?? ''} ${v.modelo ?? ''}`.toLowerCase();
    const score = tokens.filter(t => candidate.includes(t)).length;
    const anoMatch = ano && v.ano ? (Math.abs(v.ano - ano) <= 1 ? 2 : 0) : 0;
    return { v, score: score + anoMatch };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score && scored[0].score > 0 ? scored[0].v : veiculos[0];
}
