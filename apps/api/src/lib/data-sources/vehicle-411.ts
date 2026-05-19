/**
 * 411 Vehicle Data API — via RapidAPI (411-vehicle-data.p.rapidapi.com).
 *
 * Cobertura: USA majoritária (1980–2026), boa pra Ford, Chevrolet, Toyota US,
 * Jeep, RAM, etc. Modelos BR-exclusivos (T-Cross, Fastback) costumam não estar.
 *
 * Auth: headers x-rapidapi-key + x-rapidapi-host (chave do RapidAPI dashboard).
 * Token: env VEHICLE411_API_KEY > tabela ai_keys (provider='vehicle411').
 *
 * Endpoints usados:
 *   GET /v1/vehicle?make=&model=&year=    → towing, oil, bolt_pattern
 *   GET /v1/horsepower?make=&model=&year= → HP, torque, displacement, drivetrain
 *   GET /v1/vin?vin=...                   → decode completo via VIN
 *
 * Esta API é OPCIONAL: se não há token, todas chamadas retornam null e o
 * aggregator cai pro AI normalmente. Quando há resposta, marca provenance
 * com `vehicle411` — confiança média (entre manufacturer e AI).
 */
import { fetchWithTimeout } from './_http.js';
import { adminClient } from '../supabase.js';

const RAPIDAPI_HOST = '411-vehicle-data.p.rapidapi.com';
const BASE = `https://${RAPIDAPI_HOST}`;
const TIMEOUT_MS = 20_000; // 411 às vezes demora; o user pediu "mesmo que demore".

// === Token cache 30s ===
let _tokenCache: { token: string | null; expires: number } | null = null;
const TOKEN_TTL = 30_000;

async function getToken(): Promise<string | null> {
  if (process.env.VEHICLE411_API_KEY) return process.env.VEHICLE411_API_KEY;
  if (_tokenCache && _tokenCache.expires > Date.now()) return _tokenCache.token;
  try {
    const { data } = await adminClient()
      .from('ai_keys').select('api_key').eq('provider', 'vehicle411').maybeSingle();
    const tok = data?.api_key ?? null;
    _tokenCache = { token: tok, expires: Date.now() + TOKEN_TTL };
    return tok;
  } catch {
    return null;
  }
}

export function clear411TokenCache() { _tokenCache = null; }

async function jget(path: string, tok: string): Promise<any | null> {
  try {
    const r = await fetchWithTimeout(`${BASE}${path}`, {
      headers: {
        'x-rapidapi-key': tok,
        'x-rapidapi-host': RAPIDAPI_HOST,
        'Accept': 'application/json',
      },
    }, TIMEOUT_MS);
    if (!r.ok) {
      // 404 é normal (carro não existe no catálogo US). 401/403 = key inválida.
      if (r.status !== 404) console.warn(`[411] ${r.status} ${path}`);
      return null;
    }
    return await r.json();
  } catch (err: any) {
    console.warn(`[411] timeout/erro ${path}:`, err?.message);
    return null;
  }
}

// === Conversões US → métrico BR ===
const HP_TO_CV = 1.01387;   // 1 hp = 1.0139 cv
const LBS_TO_KG = 0.45359;

function pickNum(...vals: any[]): number | null {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

// API retorna múltiplos trims. Sem versão específica, prioriza:
//  1. trim com maior potência (geralmente o flagship)
//  2. fallback: primeiro registro
function pickBestHpRecord(results: any[], versao?: string): any | null {
  if (!results?.length) return null;
  if (versao) {
    const v = versao.toLowerCase();
    const match = results.find((r: any) => (r.trim ?? '').toLowerCase().includes(v));
    if (match) return match;
  }
  return [...results].sort((a, b) => (b.horsepower ?? 0) - (a.horsepower ?? 0))[0];
}

function pickBestTowing(records: any[], versao?: string): any | null {
  if (!records?.length) return null;
  if (versao) {
    const v = versao.toLowerCase();
    const match = records.find((r: any) => (r.trim ?? '').toLowerCase().includes(v));
    if (match) return match;
  }
  // Mediana de towing — evita pegar o extremo
  const sorted = [...records].sort((a, b) => (a.max_towing_lbs ?? 0) - (b.max_towing_lbs ?? 0));
  return sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
}

const MPG_TO_KML = 0.42514;  // 1 mpg (US) = 0.4251 km/l

function parseTransmission(s: string | undefined): { tipo: string | null; marchas: number | null } {
  if (!s) return { tipo: null, marchas: null };
  const lower = s.toLowerCase();
  let tipo: string | null = null;
  if (lower.includes('automatic')) tipo = 'automatica';
  else if (lower.includes('manual')) tipo = 'manual';
  else if (lower.includes('cvt')) tipo = 'cvt';
  else if (lower.includes('dual') || lower.includes('dct')) tipo = 'dct';
  const gearMatch = s.match(/(\d+)\s*-?\s*spd/i) || s.match(/(\d+)\s*speed/i);
  const marchas = gearMatch ? parseInt(gearMatch[1]!, 10) : null;
  return { tipo, marchas };
}

function parseDrivetrain(d: string | undefined): string | null {
  if (!d) return null;
  const s = d.toLowerCase();
  if (s.includes('awd') || s.includes('all-wheel')) return 'awd';
  if (s.includes('4wd') || s.includes('4x4') || s.includes('four')) return '4x4';
  if (s.includes('fwd') || s.includes('front')) return 'dianteira';
  if (s.includes('rwd') || s.includes('rear')) return 'traseira';
  return null;
}

function parseFuelType(f: string | undefined): string | null {
  if (!f) return null;
  const s = f.toLowerCase();
  if (s.includes('diesel')) return 'diesel';
  if (s.includes('electric')) return 'eletrico';
  if (s.includes('hybrid') && s.includes('plug')) return 'hibrido_plugin';
  if (s.includes('hybrid')) return 'hibrido';
  if (s.includes('flex')) return 'flex';
  if (s.includes('gasoline') || s.includes('regular') || s.includes('premium')) return 'gasolina';
  return null;
}

export type V411Specs = {
  motor?: {
    potencia_cv?: number | null;
    cilindrada_cc?: number | null;
    cilindros?: number | null;
    aspiracao?: string | null;
    combustivel?: string | null;
  };
  transmissao?: {
    tracao?: string | null;
    tipo?: string | null;
    marchas?: number | null;
  };
  dimensoes?: {
    capacidade_reboque_kg?: number | null;
    capacidade_carga_kg?: number | null;
  };
  desempenho?: {
    consumo_cidade_kml?: number | null;
    consumo_estrada_kml?: number | null;
  };
  found: boolean;
  trim_used?: string | null; // pra debug/UI mostrar qual versão foi extraída
};

/**
 * Busca specs no 411 Vehicle Data via RapidAPI.
 * Retorna null se:
 *  - sem token configurado
 *  - 411 não respondeu (timeout / 5xx)
 *  - 411 respondeu mas sem dados úteis (modelo não está no catálogo US)
 */
export async function get411Specs(
  make: string,
  model: string,
  year: number,
  versao?: string,
): Promise<V411Specs | null> {
  const tok = await getToken();
  if (!tok) return null;

  const params = new URLSearchParams({ make, model, year: String(year) });

  // Paraleliza vehicle (towing+payload) + horsepower (motor+transmissão+consumo).
  const [vehicleResp, hpResp] = await Promise.all([
    jget(`/v1/vehicle?${params}`, tok),
    jget(`/v1/horsepower?${params}`, tok),
  ]);

  if (!vehicleResp && !hpResp) return null;

  const out: V411Specs = { found: false };

  // === Horsepower: motor + transmissão + consumo ===
  const hpResults = hpResp?.results ?? hpResp?.records ?? (Array.isArray(hpResp) ? hpResp : []);
  const hp = pickBestHpRecord(hpResults, versao);
  if (hp) {
    out.trim_used = hp.trim ?? null;

    const motor: NonNullable<V411Specs['motor']> = {};
    const horsepower = pickNum(hp.horsepower);
    if (horsepower) { motor.potencia_cv = Math.round(horsepower * HP_TO_CV); out.found = true; }

    const displL = pickNum(hp.displacement);
    if (displL) { motor.cilindrada_cc = Math.round(displL * 1000); out.found = true; }

    const cyl = pickNum(hp.cylinders);
    if (cyl) { motor.cilindros = Math.round(cyl); out.found = true; }

    if (hp.is_turbocharged === true) { motor.aspiracao = 'turbo'; out.found = true; }
    else if (hp.is_supercharged === true) { motor.aspiracao = 'supercharged'; out.found = true; }
    else if (hp.is_turbocharged === false && hp.is_supercharged === false) {
      motor.aspiracao = 'aspirado'; out.found = true;
    }

    const fuel = parseFuelType(hp.fuel_type);
    if (fuel) { motor.combustivel = fuel; out.found = true; }

    if (Object.keys(motor).length) out.motor = motor;

    const tracao = parseDrivetrain(hp.drive);
    const { tipo, marchas } = parseTransmission(hp.transmission);
    if (tracao || tipo || marchas) {
      out.transmissao = {
        ...(tracao && { tracao }),
        ...(tipo && { tipo }),
        ...(marchas && { marchas }),
      };
      out.found = true;
    }

    const desempenho: NonNullable<V411Specs['desempenho']> = {};
    const cityMpg = pickNum(hp.city_mpg);
    const hwyMpg = pickNum(hp.highway_mpg);
    if (cityMpg) { desempenho.consumo_cidade_kml = +(cityMpg * MPG_TO_KML).toFixed(1); out.found = true; }
    if (hwyMpg) { desempenho.consumo_estrada_kml = +(hwyMpg * MPG_TO_KML).toFixed(1); out.found = true; }
    if (Object.keys(desempenho).length) out.desempenho = desempenho;
  }

  // === Vehicle: towing + payload ===
  const towRecords = vehicleResp?.towing?.records ?? vehicleResp?.records ?? [];
  const tow = pickBestTowing(towRecords, versao);
  if (tow) {
    const dim: NonNullable<V411Specs['dimensoes']> = {};
    const towLbs = pickNum(tow.max_towing_lbs, tow.towing_lbs);
    if (towLbs) { dim.capacidade_reboque_kg = Math.round(towLbs * LBS_TO_KG); out.found = true; }
    const payloadLbs = pickNum(tow.max_payload_lbs, tow.payload_lbs);
    if (payloadLbs) { dim.capacidade_carga_kg = Math.round(payloadLbs * LBS_TO_KG); out.found = true; }
    if (Object.keys(dim).length) out.dimensoes = dim;
  }

  return out.found ? out : null;
}
