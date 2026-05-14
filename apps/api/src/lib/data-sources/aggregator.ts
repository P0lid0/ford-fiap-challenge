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
import OpenAI from 'openai';
import { env } from '../../config.js';
import { fipe, type FipePreco } from './fipe.js';
import { nhtsa } from './nhtsa.js';
import { fetchManufacturerSpecs } from './manufacturer.js';

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

const SYSTEM = `Você é um analista técnico automotivo brasileiro. Preencha specs técnicos de um veículo
para o mercado BR, baseado em SEU CONHECIMENTO REAL (treinado até janeiro/2026).

REGRAS INEGOCIÁVEIS:
- Responda APENAS com JSON válido (sem markdown).
- Campos que você NÃO tem certeza: use null. JAMAIS chute números.
- Combustível e preço já vêm da FIPE — não inclua esses na resposta.
- Use unidades padronizadas: cc, cv, Nm, mm, kg, km/h, km/l, L.
- "combustivel" ∈ [gasolina, etanol, flex, diesel, diesel_s10, eletrico, hibrido, hibrido_plugin, gnv]
- "categoria" ∈ [hatch, sedan, suv, picape_compacta, picape_media, picape_grande, minivan, cupe, conversivel, comercial]
- Equipamentos: liste só os RELEVANTES de SÉRIE da versão; snake_case (ex: "bloqueio_diferencial_traseiro").

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
  "equipamentos": [str],
  "pais_origem": str|null,
  "_confianca_por_campo": { "motor.potencia_cv": "alta"|"media"|"baixa", ... }
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
}): Promise<AggregatedVehicle | null> {
  const sources: string[] = [];
  const fieldSources: Record<string, string> = {};

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
    const m = await fetchManufacturerSpecs(input.marca, input.modelo, input.versao);
    if (m) {
      manufacturerData = m.data ?? {};
      manufacturerUrl = m.source_url;
      sources.push(`manufacturer:${m.source_url}`);
      // Tag campos preenchidos pelo site oficial
      for (const k of ['motor', 'dimensoes', 'transmissao', 'desempenho']) {
        for (const subkey of Object.keys(manufacturerData[k] ?? {})) {
          const v = manufacturerData[k][subkey];
          if (v !== null && v !== undefined) {
            fieldSources[`${k}.${subkey}`] = `manufacturer:${new URL(m.source_url).hostname}`;
          }
        }
      }
      if (manufacturerData.equipamentos?.length) fieldSources['equipamentos'] = `manufacturer:${new URL(m.source_url).hostname}`;
      if (manufacturerData.categoria) fieldSources['categoria'] = `manufacturer:${new URL(m.source_url).hostname}`;
    }
  } catch (err: any) {
    console.error('[aggregator] manufacturer scraping failed:', err?.message);
  }

  // ===== STEP 3b: OpenAI — preenche GAPS deixados pelo site oficial =====
  // Só roda se há gaps OU se o site oficial não respondeu.
  let llmData: any = {};
  const needsLlm = !manufacturerUrl ||
    !manufacturerData.motor?.potencia_cv ||
    !manufacturerData.motor?.torque_nm ||
    !manufacturerData.dimensoes?.comprimento_mm;

  if (needsLlm && openai) {
    try {
      const r = await openai.chat.completions.create({
        model: env.OPENAI_MODEL_FAST,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `Preencha specs técnicos de: ${marcaFinal} ${modeloVersaoFinal} ${anoFinal}.` +
              (fipeData ? `\n\nDado já confirmado pela FIPE:\n- Combustível: ${fipeData.Combustivel}\n- Preço médio: ${fipeData.Valor}` : '') +
              (manufacturerUrl ? `\n\nDados já extraídos do site oficial (não duplique, complete gaps): ${JSON.stringify(manufacturerData)}` : ''),
          },
        ],
      });
      const text = r.choices[0]?.message?.content?.trim();
      if (text) {
        llmData = JSON.parse(text);
        sources.push(`openai:${env.OPENAI_MODEL_FAST}`);
        // SÓ marca como ai_inferred os campos que o manufacturer NÃO preencheu.
        for (const k of ['motor', 'dimensoes', 'transmissao', 'desempenho']) {
          for (const subkey of Object.keys(llmData[k] ?? {})) {
            const v = llmData[k][subkey];
            const path = `${k}.${subkey}`;
            if (v !== null && v !== undefined && !fieldSources[path]) {
              fieldSources[path] = `ai:${env.OPENAI_MODEL_FAST}`;
            }
          }
        }
        if (llmData.equipamentos?.length && !fieldSources['equipamentos']) {
          fieldSources['equipamentos'] = `ai:${env.OPENAI_MODEL_FAST}`;
        }
        if (llmData.categoria && !fieldSources['categoria']) fieldSources['categoria'] = `ai:${env.OPENAI_MODEL_FAST}`;
        if (llmData.pais_origem && !fieldSources['pais_origem']) fieldSources['pais_origem'] = `ai:${env.OPENAI_MODEL_FAST}`;
      }
    } catch (err: any) {
      console.error('[aggregator] OpenAI failed:', err?.message);
    }
  }

  // ===== STEP 4: Merge final — site oficial > LLM > null =====
  if (!fipeData && !manufacturerUrl && !llmData.motor) return null;

  const motorCombustivel =
    (fipeData ? combustivelFromFipe(fipeData.SiglaCombustivel) : null) ??
    manufacturerData.motor?.combustivel ??
    llmData.motor?.combustivel ?? null;

  // Helper: prefere manufacturer, depois LLM, depois null
  const pick = (obj1: any, obj2: any, key: string) =>
    (obj1?.[key] != null ? obj1[key] : obj2?.[key]) ?? null;

  const mergeObj = (obj1: any, obj2: any, keys: string[]) => {
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = pick(obj1, obj2, k);
    return out;
  };

  const motor = {
    ...mergeObj(manufacturerData.motor, llmData.motor,
      ['cilindrada_cc', 'potencia_cv', 'torque_nm', 'aspiracao', 'cilindros']),
    combustivel: motorCombustivel,
  };
  const dimensoes = mergeObj(manufacturerData.dimensoes, llmData.dimensoes,
    ['comprimento_mm', 'largura_mm', 'altura_mm', 'entre_eixos_mm', 'vao_livre_mm',
     'peso_kg', 'capacidade_porta_malas_l', 'capacidade_cacamba_l',
     'capacidade_carga_kg', 'capacidade_reboque_kg']);
  const transmissao = mergeObj(manufacturerData.transmissao, llmData.transmissao,
    ['tipo', 'marchas', 'tracao']);
  const desempenho = mergeObj(manufacturerData.desempenho, llmData.desempenho,
    ['aceleracao_0_100_s', 'velocidade_max_kmh', 'consumo_cidade_kml',
     'consumo_estrada_kml', 'autonomia_km']);

  const equipamentos = (manufacturerData.equipamentos?.length ? manufacturerData.equipamentos : llmData.equipamentos) ?? [];
  const categoria = manufacturerData.categoria ?? llmData.categoria ?? 'sedan';

  // Confiança geral: manufacturer + FIPE = alta; FIPE só = media; LLM só = baixa
  const hasManufacturer = !!manufacturerUrl;
  const hasFipe = !!fipeData;
  const confianca = hasManufacturer && hasFipe ? 'alta' : hasManufacturer || hasFipe ? 'media' : 'baixa';

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
    pais_origem: manufacturerData.pais_origem ?? llmData.pais_origem ?? null,
    fontes: sources,
    data_sources: fieldSources,
    fipe_codigo: fipeData?.CodigoFipe ?? null,
    fipe_mes_referencia: fipeData?.MesReferencia ?? null,
    confianca_geral: confianca,
  };

  return vehicle;
}
