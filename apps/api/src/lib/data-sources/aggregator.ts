/**
 * Agregador de fontes para Desafio 1 — Inteligência Competitiva.
 *
 * Princípio: cada campo tem PROVENÊNCIA explícita. Nada de "AI disse e pronto".
 *
 * Ordem de busca:
 *   1. FIPE       → preço oficial BR, marca/modelo/ano/combustível
 *   2. NHTSA vPIC → confirmação de existência + specs globais (USA)
 *   3. OpenAI     → preenche gaps técnicos BR-específicos (potência, torque,
 *                   dimensões locais, equipamentos), MARCADO como ai_inferred
 *
 * O Vehicle final carrega `data_sources` por campo. UI mostra ao usuário:
 *   "preço: FIPE oficial maio/2026"
 *   "potência: AI estimado, verificar com fabricante"
 */
import { fipe, type FipePreco } from './fipe.js';
import { nhtsa } from './nhtsa.js';
import { fetchManufacturerSpecs, filterEquipamentosBySource } from './manufacturer.js';
import { resolveEbookUrl, fetchEbookSpecs, pickBestEbookMatch } from './manufacturer-ebook.js';
import { get411Specs, type V411Specs } from './vehicle-411.js';
import { chat as aiChat, aiAvailable } from '../ai.js';

const SYSTEM = `Você é um analista técnico automotivo brasileiro com ACESSO À WEB.
Esses dados vão pro CLIENTE FINAL decidir compra. A UI já marca claramente quais
campos foram preenchidos por IA — então não tem problema estimar com BOM EMBASAMENTO.

REGRA #1 — DUAS POLÍTICAS:

A) ESPECIFICAÇÕES TÉCNICAS (motor, dimensões, transmissão, desempenho, categoria, pais_origem, preço):
   → USE WEB SEARCH AGRESSIVAMENTE: site oficial da fabricante BR > Quatro Rodas /
     Auto Esporte / Carros UOL / Webmotors > FIPE.
   → SE achou em fonte confiável: preencha.
   → SE não achou MAS é VALOR PLAUSÍVEL pra essa versão/segmento: estime baseado em
     versões similares ou na média do segmento.
   → JAMAIS chute números absurdos (V8 1.0L, etc.) — qualquer estimativa precisa fazer
     sentido. Se realmente não tem ideia, use null.

B) EQUIPAMENTOS DE SÉRIE — TENTE SEMPRE TRAZER UMA LISTA SUBSTANCIAL:
   → Use web search pra achar a lista oficial da versão pedida.
   → Sites prioritários: oficial da marca, ficha técnica em portais (Webmotors, iCarros,
     Quatro Rodas), reviews especializados.
   → Liste 20-40 itens TÍPICOS da versão pedida. Lista vazia é fracasso, não virtude.
   → Itens marcados como opcionais NA VERSÃO ESPECÍFICA → fora (mas se é "série padrão",
     fica dentro).
   → Itens claramente exclusivos de OUTRAS versões → fora.
   → Quando você não tem CERTEZA se o item é exatamente igual entre trims, INCLUA
     mesmo assim — a UI vai sinalizar como "IA estimou" e o vendedor confirma com
     o cliente. Melhor sinalizar do que omitir.

REGRA #2: Responda APENAS com JSON válido (sem markdown).
REGRA #3: Combustível e preço já vêm da FIPE — não inclua na resposta.
REGRA #4: Unidades padronizadas: cc, cv, Nm, mm, kg, km/h, km/l, L.
REGRA #5: "combustivel" ∈ [gasolina, etanol, flex, diesel, diesel_s10, eletrico, hibrido, hibrido_plugin, gnv]
REGRA #6: "categoria" ∈ [hatch, sedan, suv, picape_compacta, picape_media, picape_grande, minivan, cupe, conversivel, comercial]

EQUIPAMENTOS — formato "categoria:item_snake_case":
  seguranca, conforto, tecnologia, assistencia, interior, exterior, cargo (picape), offroad (4x4)
  Exemplos: seguranca:airbag_motorista, conforto:ar_condicionado_digital,
  tecnologia:central_multimidia_8_polegadas, exterior:rodas_aluminio_18,
  cargo:cacamba_revestida, offroad:bloqueio_diferencial_traseiro.

Formato esperado:
{
  "categoria": "...",
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
  "pais_origem": str|null
}`;

export type AggregatedVehicle = {
  marca: string;
  modelo: string;
  versao: string;
  ano: number;
  categoria: string;
  motor: any;
  dimensoes: any;
  transmissao: any;
  desempenho: any;
  equipamentos: string[];
  preco_brl: number | null;
  pais_origem: string | null;
  fontes: string[];
  data_sources: Record<string, string>; // mapa campo → fonte
  citations?: { url: string; title?: string }[]; // URLs consultadas pelo web search da IA
  fipe_codigo: string | null;
  fipe_mes_referencia: string | null;
  confianca_geral: 'alta' | 'media' | 'baixa';
};

function combustivelFromFipe(sigla: string): string | null {
  const map: Record<string, string> = { G: 'gasolina', A: 'etanol', D: 'diesel', E: 'flex' };
  return map[sigla.toUpperCase()] ?? null;
}

export async function aggregateVehicle(input: {
  marca: string;
  modelo: string;
  versao?: string;
  ano?: number;
  aiModel?: string;  // override do modelo de IA para este chamado
  manufacturerAiModel?: string; // override pro extract manufacturer
  ebookUrl?: string;  // URL custom do PDF do e-book (sobrepõe registry)
  skipEbook?: boolean; // pula extração do e-book mesmo se URL existir (controle de custo)
}): Promise<AggregatedVehicle | null> {
  const sources: string[] = [];
  const fieldSources: Record<string, string> = {};
  let aiCitations: { url: string; title?: string }[] | undefined;

  // ===== STEP 1: FIPE — preço oficial =====
  let fipeData: FipePreco | null = null;
  try {
    // Concatena modelo + versão para o fuzzy search FIPE
    const query = input.versao ? `${input.modelo} ${input.versao}` : input.modelo;
    fipeData = await fipe.findVehicle(input.marca, query, input.ano);
    if (fipeData) {
      sources.push(`fipe:${fipeData.CodigoFipe}@${fipeData.MesReferencia}`);
      fieldSources['preco_brl'] = 'fipe';
      fieldSources['marca'] = 'fipe';
      fieldSources['modelo'] = 'fipe';
      fieldSources['ano'] = 'fipe';
      fieldSources['motor.combustivel'] = 'fipe';
    }
  } catch (err) {
    console.error('[aggregator] FIPE failed:', err);
  }

  // ===== STEP 2: NHTSA — confirma existência global =====
  try {
    const yearForNhtsa = input.ano ?? new Date().getFullYear();
    const nhtsaResult = await nhtsa.getModelSpecs(input.marca, input.modelo, yearForNhtsa);
    if (nhtsaResult._nhtsa_match) {
      sources.push('nhtsa:vpic');
    }
  } catch (err) {
    console.error('[aggregator] NHTSA failed:', err);
  }

  // ===== STEP 3a: site oficial da fabricante — EXTRAÇÃO de HTML real =====
  // Esta é a fonte de specs técnicos MAIS CONFIÁVEL que conseguimos pegar grátis.
  // Cobertura: Toyota, VW, RAM, Chevrolet, Renault (testado em 14/05/2026).
  // Os fields preenchidos aqui têm `data_sources = manufacturer:{url}` — alta confiança.
  const marcaFinal = fipeData?.Marca ?? input.marca;
  const modeloVersaoFinal = fipeData?.Modelo ?? `${input.modelo} ${input.versao ?? ''}`.trim();
  const anoFinal = fipeData?.AnoModelo ?? input.ano ?? new Date().getFullYear();

  let manufacturerData: any = {};
  let manufacturerUrl: string | null = null;
  try {
    const m = await fetchManufacturerSpecs(input.marca, input.modelo, input.versao, input.manufacturerAiModel);
    if (m) {
      manufacturerData = m.data ?? {};
      manufacturerUrl = m.source_url;
      sources.push(`manufacturer:${m.source_url}`);
      // Tag campos preenchidos pelo site oficial — NÃO sobrescreve se ebook (mais autoritativo) já preencheu
      const tag = `manufacturer:${new URL(m.source_url).hostname}`;
      for (const k of ['motor', 'dimensoes', 'transmissao', 'desempenho']) {
        for (const subkey of Object.keys(manufacturerData[k] ?? {})) {
          const v = manufacturerData[k][subkey];
          const path = `${k}.${subkey}`;
          if (v !== null && v !== undefined && !fieldSources[path]) {
            fieldSources[path] = tag;
          }
        }
      }
      if (manufacturerData.equipamentos?.length && !fieldSources['equipamentos']) fieldSources['equipamentos'] = tag;
      if (manufacturerData.categoria && !fieldSources['categoria']) fieldSources['categoria'] = tag;
    }
  } catch (err: any) {
    console.error('[aggregator] manufacturer scraping failed:', err?.message);
  }

  // ===== STEP 3a': E-book/Catálogo PDF oficial — fonte MAIS COMPLETA =====
  // Roda em paralelo conceitualmente, mas separado porque é caro ($0.5-1/ext).
  // Cobertura via registry curado em manufacturer-ebook.ts; user pode passar URL custom.
  // Quando encontra o trim certo no PDF, esse dado tem prioridade sobre HTML.
  let ebookData: any = {};
  let ebookUrl: string | null = null;
  if (!input.skipEbook) {
    const url = input.ebookUrl ?? resolveEbookUrl(marcaFinal, input.modelo);
    if (url) {
      try {
        const ext = await fetchEbookSpecs(url, marcaFinal, input.modelo, input.versao);
        if (ext) {
          ebookUrl = ext.source_url;
          const match = pickBestEbookMatch(ext.data?.veiculos ?? [], input.modelo, input.versao, input.ano);
          if (match) {
            ebookData = match;
            const host = (() => { try { return new URL(ebookUrl).hostname; } catch { return 'ebook'; } })();
            sources.push(`manufacturer_ebook:${host}`);
            const tag = `manufacturer_ebook:${host}`;
            for (const k of ['motor', 'dimensoes', 'transmissao', 'desempenho']) {
              for (const subkey of Object.keys(ebookData[k] ?? {})) {
                const v = ebookData[k][subkey];
                if (v !== null && v !== undefined) {
                  fieldSources[`${k}.${subkey}`] = tag;
                }
              }
            }
            if (ebookData.equipamentos?.length) fieldSources['equipamentos'] = tag;
            if (ebookData.categoria) fieldSources['categoria'] = tag;
            if (ebookData.pais_origem) fieldSources['pais_origem'] = tag;
          }
        }
      } catch (err: any) {
        console.error('[aggregator] ebook extraction failed:', err?.message);
      }
    }
  }

  // ===== STEP 3b: 411 Vehicle Data — specs detalhadas (US-centric) =====
  // O user pediu pra usar 411 mesmo que demore. Funciona como camada intermediária
  // entre manufacturer (BR scraping) e AI fallback. Cobre bem Ford/GM/Toyota US,
  // Jeep, RAM, mas falha em modelos BR-exclusivos. Quando retorna, preenche
  // SÓ os campos que o manufacturer NÃO trouxe — confiança média.
  let data411: V411Specs | null = null;
  try {
    data411 = await get411Specs(marcaFinal, input.modelo, anoFinal, input.versao);
    if (data411?.found) {
      sources.push(`vehicle411:${data411.trim_used ?? 'best-match'}`);
      const tag = 'vehicle411';
      // Tag campos novos (manufacturer tem prioridade — não sobrescreve)
      for (const k of ['motor', 'transmissao', 'dimensoes', 'desempenho'] as const) {
        const obj = (data411 as any)[k];
        if (!obj) continue;
        for (const subkey of Object.keys(obj)) {
          const v = obj[subkey];
          const path = `${k}.${subkey}`;
          if (v !== null && v !== undefined && !fieldSources[path]) {
            fieldSources[path] = tag;
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[aggregator] 411 failed:', err?.message);
  }

  // ===== STEP 3c: OpenAI/Anthropic/Gemini — preenche GAPS finais =====
  // Roda quando faltam specs CORE OU quando a lista de equipamentos veio vazia/curta.
  let llmData: any = {};
  const haveCoreSpecs =
    (ebookData.motor?.potencia_cv || manufacturerData.motor?.potencia_cv || data411?.motor?.potencia_cv) &&
    (ebookData.motor?.torque_nm || manufacturerData.motor?.torque_nm) && // 411 não tem torque
    (ebookData.dimensoes?.comprimento_mm || manufacturerData.dimensoes?.comprimento_mm);
  const equipamentosFromSources =
    (ebookData.equipamentos?.length ?? 0) +
    (manufacturerData.equipamentos?.length ?? 0);
  const haveEnoughEquipamentos = equipamentosFromSources >= 10;
  const needsLlm = (!ebookUrl && !manufacturerUrl) || !haveCoreSpecs || !haveEnoughEquipamentos;

  if (needsLlm && await aiAvailable()) {
    try {
      const userPrompt = `Preencha specs técnicos de: ${marcaFinal} ${modeloVersaoFinal} ${anoFinal}.` +
        (fipeData ? `\n\nDado já confirmado pela FIPE:\n- Combustível: ${fipeData.Combustivel}\n- Preço FIPE: ${fipeData.Valor}` : '\n\nA FIPE NÃO trouxe preço. Estime "preco_brl_estimado".') +
        (ebookUrl ? `\n\nDados já extraídos do E-BOOK oficial (não duplique, complete gaps): ${JSON.stringify({ motor: ebookData.motor, transmissao: ebookData.transmissao, dimensoes: ebookData.dimensoes, desempenho: ebookData.desempenho, equipamentos: ebookData.equipamentos })}` : '') +
        (manufacturerUrl ? `\n\nDados já extraídos do site oficial (não duplique, complete gaps): ${JSON.stringify(manufacturerData)}` : '') +
        (data411?.found ? `\n\nDados já extraídos do 411 Vehicle Data (US, não duplique, complete gaps): ${JSON.stringify({ motor: data411.motor, transmissao: data411.transmissao, dimensoes: data411.dimensoes })}` : '');
      const r = await aiChat(userPrompt, 'fast', {
        systemOverride: SYSTEM,
        modelOverride: input.aiModel,
        jsonObjectMode: true,
        maxTokens: 2000, // JSON de specs completo precisa de espaço — 600 trunca
        webSearch: true,           // grounding em fontes oficiais
        searchContextSize: 'high', // contexto máximo de busca
      });
      const text = r.output;
      if (text) {
        // Strip markdown fences caso o modelo ignore jsonObjectMode
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        try {
          llmData = JSON.parse(cleaned);
        } catch (parseErr: any) {
          console.error('[aggregator] AI JSON parse falhou:', parseErr.message, '| sample:', cleaned.slice(0, 200));
          // Marca tentativa falha pra UI mostrar que IA foi chamada
          sources.push(`ai:${r.provider}:${r.model}:parse_failed`);
          throw parseErr;
        }
        const modelLabel = `${r.provider}:${r.model}`;
        sources.push(modelLabel);
        // Salva citations do web search (URLs consultadas) — vão pro UI/auditoria
        if (r.citations?.length) {
          aiCitations = r.citations.slice(0, 12); // limita a 12 pra não inflar
          for (const c of aiCitations) sources.push(`web:${c.url}`);
        }
        // SÓ marca como ai_inferred os campos que o manufacturer NÃO preencheu.
        for (const k of ['motor', 'dimensoes', 'transmissao', 'desempenho']) {
          for (const subkey of Object.keys(llmData[k] ?? {})) {
            const v = llmData[k][subkey];
            const path = `${k}.${subkey}`;
            if (v !== null && v !== undefined && !fieldSources[path]) {
              fieldSources[path] = `ai:${modelLabel}`;
            }
          }
        }
        // Equipamentos da IA com web search: confiamos no grounding do search.
        // Não filtramos por citation text (que é só URL+título — não inclui o conteúdo).
        // O badge "IA ESTIMOU" na UI já avisa o usuário que precisa verificar.
        if (Array.isArray(llmData.equipamentos) && llmData.equipamentos.length > 0) {
          if (!fieldSources['equipamentos']) {
            fieldSources['equipamentos'] = `ai:${modelLabel}`;
          }
        }
        if (llmData.categoria && !fieldSources['categoria']) fieldSources['categoria'] = `ai:${modelLabel}`;
        if (llmData.pais_origem && !fieldSources['pais_origem']) fieldSources['pais_origem'] = `ai:${modelLabel}`;
        // preço estimado pela IA (quando FIPE não tem)
        if (!fipeData && llmData.preco_brl_estimado) {
          fieldSources['preco_brl'] = `ai:${modelLabel}`;
        }
      }
    } catch (err: any) {
      console.error('[aggregator] OpenAI failed:', err?.message);
    }
  }

  // ===== STEP 4: Merge final — ebook > manufacturer HTML > 411 > LLM > null =====
  if (!fipeData && !ebookUrl && !manufacturerUrl && !data411?.found && !llmData.motor) return null;

  const motorCombustivel =
    (fipeData ? combustivelFromFipe(fipeData.SiglaCombustivel) : null) ??
    ebookData.motor?.combustivel ??
    manufacturerData.motor?.combustivel ??
    llmData.motor?.combustivel ?? null;

  // Cadeia de prioridade N fontes
  const pickN = (sources: any[], key: string) => {
    for (const s of sources) {
      if (s?.[key] != null) return s[key];
    }
    return null;
  };
  const mergeObjN = (sources: any[], keys: string[]) => {
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = pickN(sources, k);
    return out;
  };

  const motor = {
    ...mergeObjN(
      [ebookData.motor, manufacturerData.motor, data411?.motor, llmData.motor],
      ['cilindrada_cc', 'potencia_cv', 'torque_nm', 'aspiracao', 'cilindros']),
    combustivel: motorCombustivel,
  };
  const dimensoes = mergeObjN(
    [ebookData.dimensoes, manufacturerData.dimensoes, data411?.dimensoes, llmData.dimensoes],
    ['comprimento_mm', 'largura_mm', 'altura_mm', 'entre_eixos_mm', 'vao_livre_mm',
     'peso_kg', 'capacidade_porta_malas_l', 'capacidade_cacamba_l',
     'capacidade_carga_kg', 'capacidade_reboque_kg']);
  const transmissao = mergeObjN(
    [ebookData.transmissao, manufacturerData.transmissao, data411?.transmissao, llmData.transmissao],
    ['tipo', 'marchas', 'tracao']);
  const desempenho = mergeObjN(
    [ebookData.desempenho, manufacturerData.desempenho, data411?.desempenho, llmData.desempenho],
    ['aceleracao_0_100_s', 'velocidade_max_kmh', 'consumo_cidade_kml',
     'consumo_estrada_kml', 'autonomia_km']);

  // Equipamentos: usa a UNIÃO dos que vieram de fontes confiáveis (ebook/manufacturer)
  // + os do AI quando ainda for pouco. Deduplica.
  const trustedEquip: string[] = [
    ...(ebookData.equipamentos ?? []),
    ...(manufacturerData.equipamentos ?? []),
  ];
  const aiEquip: string[] = llmData.equipamentos ?? [];
  // Se já temos 10+ confirmados, usa só os confirmados (preserva confiança alta).
  // Senão, faz união (AI complementa o que faltou).
  const mergedEquip = trustedEquip.length >= 10
    ? trustedEquip
    : [...new Set([...trustedEquip, ...aiEquip])];
  const equipamentos = mergedEquip;
  const categoria = ebookData.categoria ?? manufacturerData.categoria ?? llmData.categoria ?? 'sedan';

  // Confiança geral: ebook/manufacturer/411 + FIPE = alta; alguma fonte real = media; só LLM = baixa
  const hasEbook = !!ebookUrl;
  const hasManufacturer = !!manufacturerUrl;
  const has411 = !!data411?.found;
  const hasFipe = !!fipeData;
  const hasRealSpecs = hasEbook || hasManufacturer || has411;
  const confianca = hasRealSpecs && hasFipe ? 'alta' : hasRealSpecs || hasFipe ? 'media' : 'baixa';

  const vehicle: AggregatedVehicle = {
    marca: marcaFinal,
    modelo: input.modelo,
    versao: input.versao ?? modeloVersaoFinal.replace(input.modelo, '').trim() ?? 'Padrão',
    ano: anoFinal,
    categoria,
    motor,
    dimensoes,
    transmissao,
    desempenho,
    equipamentos,
    preco_brl: fipeData ? fipe.parseValor(fipeData.Valor) : null,
    pais_origem: ebookData.pais_origem ?? manufacturerData.pais_origem ?? llmData.pais_origem ?? null,
    fontes: sources,
    data_sources: fieldSources,
    citations: aiCitations,
    fipe_codigo: fipeData?.CodigoFipe ?? null,
    fipe_mes_referencia: fipeData?.MesReferencia ?? null,
    confianca_geral: confianca,
  };

  return vehicle;
}
