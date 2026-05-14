/**
 * Cliente FIPE — API v2 (fipe.parallelum.com.br/api/v2).
 *
 * Vantagens da v2 sobre v1:
 *   - 1000 req/dia com token (vs 500 sem)
 *   - Suporta carros + motos + caminhões
 *   - Endpoints em inglês padronizados
 *   - Mesma fonte de dados (fipe.org.br)
 *
 * Token: env FIPE_API_TOKEN > tabela ai_keys (provider='fipe').
 * Sem token, API ainda funciona até 500 req/dia.
 */
import { fetchWithTimeout } from './_http.js';
import { adminClient } from '../supabase.js';

const FIPE_BASE = 'https://fipe.parallelum.com.br/api/v2';

// v2 retorna camelCase em inglês
type FipeMarcaV2 = { code: string; name: string };
type FipeModeloV2 = { code: string; name: string };
type FipeAnoV2 = { code: string; name: string };
type FipePrecoV2 = {
  vehicleType: number; price: string; brand: string; model: string;
  modelYear: number; fuel: string; codeFipe: string;
  referenceMonth: string; fuelAcronym: string;
};

// Tipos públicos mantém compat com chamadores (PT)
export type FipeAno = { codigo: string; nome: string };
export type FipePreco = {
  TipoVeiculo: number; Valor: string; Marca: string; Modelo: string;
  AnoModelo: number; Combustivel: string; CodigoFipe: string;
  MesReferencia: string; SiglaCombustivel: string;
};

function v2ToV1(p: FipePrecoV2): FipePreco {
  return {
    TipoVeiculo: p.vehicleType, Valor: p.price, Marca: p.brand,
    Modelo: p.model, AnoModelo: p.modelYear, Combustivel: p.fuel,
    CodigoFipe: p.codeFipe, MesReferencia: p.referenceMonth,
    SiglaCombustivel: p.fuelAcronym,
  };
}

// === Token cache 30s ===
let _tokenCache: { token: string | null; expires: number } | null = null;
const TOKEN_TTL = 30_000;

async function getFipeToken(): Promise<string | null> {
  if (process.env.FIPE_API_TOKEN) return process.env.FIPE_API_TOKEN;
  if (_tokenCache && _tokenCache.expires > Date.now()) return _tokenCache.token;
  try {
    const { data } = await adminClient().from('ai_keys').select('api_key').eq('provider', 'fipe').maybeSingle();
    const tok = data?.api_key ?? null;
    _tokenCache = { token: tok, expires: Date.now() + TOKEN_TTL };
    return tok;
  } catch {
    return null;
  }
}

export function clearFipeTokenCache() { _tokenCache = null; }

async function jget<T>(path: string): Promise<T> {
  const tok = await getFipeToken();
  const headers: Record<string, string> = {};
  if (tok) headers['X-Subscription-Token'] = tok;
  const r = await fetchWithTimeout(`${FIPE_BASE}${path}`, { headers }, 15_000);
  if (!r.ok) throw new Error(`FIPE ${r.status} ${path}`);
  return r.json() as Promise<T>;
}

export const fipe = {
  async marcas(): Promise<{ codigo: string; nome: string }[]> {
    const arr = await jget<FipeMarcaV2[]>('/cars/brands');
    return arr.map(m => ({ codigo: m.code, nome: m.name }));
  },

  async modelos(marcaCodigo: string): Promise<{ codigo: number; nome: string }[]> {
    const arr = await jget<FipeModeloV2[]>(`/cars/brands/${marcaCodigo}/models`);
    return arr.map(m => ({ codigo: Number(m.code), nome: m.name }));
  },

  async anos(marcaCodigo: string, modeloCodigo: string | number): Promise<FipeAno[]> {
    const arr = await jget<FipeAnoV2[]>(`/cars/brands/${marcaCodigo}/models/${modeloCodigo}/years`);
    return arr.map(a => ({ codigo: a.code, nome: a.name }));
  },

  async preco(marcaCodigo: string, modeloCodigo: string | number, anoCodigo: string): Promise<FipePreco> {
    const v2 = await jget<FipePrecoV2>(`/cars/brands/${marcaCodigo}/models/${modeloCodigo}/years/${anoCodigo}`);
    return v2ToV1(v2);
  },

  /** Busca completa por (marca, modelo, ano). Tokeniza, faz AND match. */
  async findVehicle(marcaNome: string, modeloQuery: string, ano?: number): Promise<FipePreco | null> {
    const marcas = await this.marcas();
    const marca = marcas.find(m => m.nome.toLowerCase() === marcaNome.toLowerCase());
    if (!marca) return null;

    const modelos = await this.modelos(marca.codigo);
    const tokens = modeloQuery.toLowerCase().split(/\s+/).filter(t => t.length >= 2 && !/^\d{4}$/.test(t));

    const scored = modelos
      .map(m => {
        const name = m.nome.toLowerCase();
        const score = tokens.filter(t => name.includes(t)).length;
        return { modelo: m, score, nameLen: m.nome.length };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.nameLen - b.nameLen);

    if (scored.length === 0) return null;

    const candidates: { preco: FipePreco; modelMatchScore: number }[] = [];
    for (const { modelo, score } of scored.slice(0, 8)) {
      try {
        const anos = await this.anos(marca.codigo, modelo.codigo);
        const reais = anos.filter(a => /^\d{4}-\d$/.test(a.codigo));
        if (reais.length === 0) continue;

        if (ano) {
          const anoMatch = reais.find(a => a.codigo.startsWith(`${ano}-`));
          if (!anoMatch) continue;
          const preco = await this.preco(marca.codigo, modelo.codigo, anoMatch.codigo);
          candidates.push({ preco, modelMatchScore: score });
        } else {
          const mostRecent = reais.sort((a, b) => b.codigo.localeCompare(a.codigo))[0]!;
          const preco = await this.preco(marca.codigo, modelo.codigo, mostRecent.codigo);
          candidates.push({ preco, modelMatchScore: score });
        }
      } catch { continue; }
    }

    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => b.modelMatchScore - a.modelMatchScore)[0]!.preco;
  },

  parseValor(valor: string): number {
    const clean = valor.replace(/[^0-9,]/g, '').replace(',', '.');
    return Math.round(parseFloat(clean));
  },
};
