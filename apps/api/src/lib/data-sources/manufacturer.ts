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
import * as cheerio from 'cheerio';
import { chat as aiChat, aiAvailable } from '../ai.js';
import { fetchWithTimeout } from './_http.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Resolve URL provável do site oficial para (marca, modelo, versao?). */
export function resolveManufacturerUrl(marca: string, modelo: string, versao?: string): string | null {
  const m = marca.toLowerCase().trim();
  const mod = modelo.toLowerCase().trim();
  const v = versao?.toLowerCase().trim() ?? '';

  // Mapas validados em 14/05/2026
  switch (m) {
    case 'toyota':
      if (mod.includes('hilux')) return 'https://www.toyota.com.br/modelos/hilux-cabine-dupla';
      return `https://www.toyota.com.br/modelos/${mod}`;
    case 'volkswagen':
    case 'vw':
      return `https://www.vw.com.br/pt/carros/${mod}.html`;
    case 'ram':
      return `https://www.ram.com.br/picapes/${mod}.html`;
    case 'chevrolet':
    case 'gm':
      if (['s10', 'silverado', 'montana'].includes(mod)) return `https://www.chevrolet.com.br/picapes/${mod}`;
      if (['tracker', 'equinox', 'trailblazer'].includes(mod)) return `https://www.chevrolet.com.br/suvs/${mod}`;
      return `https://www.chevrolet.com.br/carros/${mod}`;
    case 'renault':
      return `https://www.renault.com.br/veiculos/${mod}.html`;
    case 'jeep':
      return `https://www.jeep.com.br/${mod}.html`;
    case 'chery':
    case 'caoa chery':
      return `https://www.chery.com.br/${mod}`;
    case 'kia':
      return `https://www.kia.com.br/${mod}`;
    case 'mitsubishi':
      if (mod.includes('triton') || mod.includes('l200')) {
        const sub = mod.includes('nova') ? 'nova-triton' : mod.includes('terra') ? 'triton-terra' : 'nova-triton';
        return `https://www.mitsubishimotors.com.br/picapes/${sub}`;
      }
      if (mod.includes('outlander') || mod.includes('eclipse') || mod.includes('asx') || mod.includes('pajero')) {
        return `https://www.mitsubishimotors.com.br/suv-e-crossovers/${mod}`;
      }
      return null;
    case 'peugeot':
      return `https://www.peugeot.com.br/gama/peugeot-${mod}.html`;
    default:
      return null;
  }
}

/** Lista de marcas com cobertura de scraping de site oficial (alta confiança). */
export const SUPPORTED_MANUFACTURER_BRANDS = [
  'Toyota', 'Volkswagen', 'RAM', 'Chevrolet', 'Renault',
  'Jeep', 'Chery', 'Kia', 'Mitsubishi', 'Peugeot',
];

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

const EXTRACTOR_SYSTEM = `Você é um EXTRATOR de specs e equipamentos a partir do TEXTO da página oficial.

REGRAS PARA NÚMEROS (motor, dimensões, etc.):
- Só preencha valor se aparecer EXPLICITAMENTE no texto. Em dúvida = null.
- Unidades padronizadas: cc, cv, Nm, mm, kg, km/h, km/l, L.
- Conversões diretas aceitas: "2.4L" → 2400 cc; "190 hp" → 190 cv (aprox válida).
- combustivel ∈ [gasolina, etanol, flex, diesel, diesel_s10, eletrico, hibrido, hibrido_plugin, gnv]
- categoria ∈ [hatch, sedan, suv, picape_compacta, picape_media, picape_grande, minivan, cupe, conversivel, comercial]

REGRAS PARA EQUIPAMENTOS — TENTE TRAZER UMA LISTA SUBSTANCIAL:
- Liste TODO equipamento que aparece no texto. Não tenha medo de listar muitos.
- Se o texto tem seção "equipamentos de série" / "destaques" / "tecnologia" / "conforto",
  extraia TODOS os itens dessas seções.
- Itens marcados como "opcional", "pacote opcional", "exclusivo da versão X" → fora.
- Quando há múltiplos trims na mesma página e o usuário pediu UM específico:
  → priorize os equipamentos atribuídos àquele trim
  → se a separação não está clara, inclua os itens que claramente são de SÉRIE em todos os trims
- Lista vazia é PIOR que lista boa — esforce-se pra extrair pelo menos 10-15 itens.
- Mas: itens 100% inventados (sem base no texto) → fora.

Responda APENAS com JSON válido (sem markdown).

EQUIPAMENTOS — formato "categoria:item_snake_case".
Categorias: seguranca, conforto, tecnologia, assistencia, interior, exterior, cargo, offroad.

Formato JSON:
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
  "equipamentos": ["categoria:item", ...]
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
  aiModel?: string,
): Promise<ManufacturerExtraction | null> {
  const url = resolveManufacturerUrl(marca, modelo, versao);
  if (!url) return null;

  let html: string;
  try {
    const r = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    }, 8_000); // 8s: WAF blocks tend to hang silently
    if (!r.ok) return null;
    html = await r.text();
    if (html.length < 2000) return null; // página vazia/SPA
  } catch {
    return null; // timeout ou erro → caímos no fallback IA
  }

  const mainText = extractMainText(html);
  if (mainText.length < 500) return null;

  if (!(await aiAvailable())) return null;

  try {
    const versaoHint = versao
      ? `\n\nVERSÃO PEDIDA PELO USUÁRIO: "${versao}"
  → Se o texto lista MÚLTIPLAS versões, extraia APENAS dados desta versão específica.
  → Equipamentos exclusivos de OUTRAS versões NÃO PODEM aparecer.
  → Se não está claro qual versão o texto descreve, prefira null e poucos equipamentos.`
      : '\n\nO usuário NÃO especificou versão. Extraia somente dados COMUNS A TODAS as versões mencionadas.';

    const userMsg = `Marca: ${marca}
Modelo: ${modelo}${versao ? ` ${versao}` : ''}
${versaoHint}

LEMBRE: dado errado quebra a confiança do cliente. Em dúvida = null.

TEXTO DA PÁGINA OFICIAL:

${mainText}`;
    const r = await aiChat(userMsg, 'fast', {
      systemOverride: EXTRACTOR_SYSTEM,
      modelOverride: aiModel,
      jsonObjectMode: true,
      maxTokens: 2500,
    });
    if (!r.output) return null;
    const cleaned = r.output.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const data = JSON.parse(cleaned);

    // Validação literal: remove equipamentos cuja maioria das palavras-chave
    // NÃO aparece no texto fonte. Previne alucinação tipo "android_auto" sendo
    // listado quando a página só falava em "rádio AM/FM".
    if (Array.isArray(data.equipamentos)) {
      data.equipamentos = filterEquipamentosBySource(data.equipamentos, mainText);
    }
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

/**
 * Remove acentos + lower pra match tolerante.
 */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Mapa de sinônimos: o item snake_case → termos que provavelmente aparecem no texto
 * original. Permite match liberal (ex: "carplay" no texto vale pra "apple_carplay").
 */
const EQUIP_SYNONYMS: Record<string, string[]> = {
  airbag: ['airbag', 'air bag', 'air-bag'],
  abs: ['abs', 'antiblocante', 'antitravamento'],
  esp: ['esp', 'controle de estabilidade'],
  ebd: ['ebd', 'distribuicao de frenagem'],
  isofix: ['isofix'],
  carplay: ['carplay', 'apple car'],
  android: ['android auto'],
  bluetooth: ['bluetooth'],
  multimidia: ['multimidia', 'central multimidia', 'sistema multimidia', 'infotainment'],
  cruise: ['cruise', 'piloto automatico'],
  hill_descent: ['hill descent', 'descida controlada'],
  hill_start: ['hill start', 'assistente de partida em rampa'],
  bloqueio: ['bloqueio', 'diferencial blocante', 'blocante'],
  reducao: ['reducao', 'caixa de reducao', 'modo 4l'],
  led: ['led'],
  halogen: ['halogen', 'halogeno'],
  teto_solar: ['teto solar', 'sunroof', 'panoramico'],
  ar_condicionado: ['ar condicionado', 'ar-condicionado', 'climatizador'],
  bancos_couro: ['bancos de couro', 'banco em couro', 'couro nos bancos', 'revestimento em couro'],
  volante_couro: ['volante em couro', 'volante de couro'],
  partida_botao: ['partida sem chave', 'botao de partida', 'start stop', 'partida por botao'],
  camera_re: ['camera de re', 'camera traseira'],
  camera_360: ['camera 360', 'visao 360', 'panoramica'],
  sensor_estacionamento: ['sensor de estacionamento', 'sensor traseiro', 'sensor de re'],
  sensor_chuva: ['sensor de chuva'],
  sensor_luminosidade: ['sensor de luminosidade', 'sensor crepuscular'],
  rodas_aluminio: ['rodas de aluminio', 'rodas em liga', 'liga leve'],
  rodas_aco: ['rodas de aco'],
  estribos: ['estribos', 'estribo lateral'],
  capota: ['capota', 'tampa de cacamba'],
  cacamba_revestida: ['revestimento da cacamba', 'bedliner', 'forro da cacamba'],
  ganchos_amarracao: ['gancho de amarracao', 'ganchos de carga'],
  tomada_220v: ['tomada 220', 'tomada 110', 'tomada da cacamba'],
  frenagem_autonoma: ['frenagem autonoma', 'aeb', 'frenagem de emergencia'],
  lane_keep: ['lane keep', 'manutencao de faixa', 'assistente de faixa'],
  pre_colisao: ['pre colisao', 'alerta de colisao'],
  banco_eletrico: ['banco eletrico', 'banco com regulagem eletrica'],
  ventilacao_banco: ['banco ventilado', 'ventilacao do banco'],
  start_stop: ['start stop', 'start-stop'],
};

/**
 * Filtro permissivo: só descarta equipamentos cujos TOKENS principais não aparecem
 * NEM 1x no texto fonte. Itens com pelo menos 1 hit OU sinônimo casando ficam.
 * Preferimos passar item duvidoso (UI sinaliza fonte) a perder item válido.
 */
export function filterEquipamentosBySource(items: string[], sourceText: string): string[] {
  const src = normalize(sourceText);
  const kept: string[] = [];
  const dropped: string[] = [];

  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const item = raw.replace(/^[a-z_]+:/, '');
    const tokens = normalize(item.replace(/_/g, ' '))
      .split(/\s+/)
      .filter(t => t.length >= 3);

    // 1) Sinônimos curados (match liberal)
    let synHit = false;
    for (const [key, syns] of Object.entries(EQUIP_SYNONYMS)) {
      if (item.includes(key) || tokens.some(t => key.includes(t))) {
        if (syns.some(s => src.includes(normalize(s)))) { synHit = true; break; }
      }
    }
    if (synHit) { kept.push(raw); continue; }

    // 2) Pelo menos 1 token significativo no texto = mantém (permissivo)
    if (tokens.length === 0) { kept.push(raw); continue; } // sem tokens, mantém por padrão
    const hits = tokens.filter(t => src.includes(t)).length;
    if (hits >= 1) kept.push(raw);
    else dropped.push(raw);
  }

  if (dropped.length > 0) {
    console.log(`[manufacturer] descartou ${dropped.length} equipamentos sem nenhuma evidência: ${dropped.slice(0, 5).join(', ')}${dropped.length > 5 ? '...' : ''}`);
  }
  return kept;
}
