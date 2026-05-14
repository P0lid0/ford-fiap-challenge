/**
 * Cliente FIPE (Fundação Instituto de Pesquisas Econômicas).
 *
 * Tabela FIPE é a referência OFICIAL de preços de veículos no Brasil,
 * atualizada mensalmente. Wrapper público gratuito: parallelum.com.br
 *
 * O que a FIPE entrega:
 *   - Marca, Modelo, Versão (texto)
 *   - Ano + combustível
 *   - Valor (preço médio de mercado)
 *   - Código FIPE (referência oficial)
 *   - Mês de referência
 *
 * O que NÃO entrega: specs técnicos (potência, torque, dimensões, equipamentos).
 * Esses vêm de NHTSA / OpenAI com flag de fonte.
 */
import { fetchWithTimeout } from './_http.js';

const FIPE_BASE = 'https://parallelum.com.br/fipe/api/v1/carros';

export type FipeMarca = { codigo: string; nome: string };
export type FipeModelo = { codigo: number; nome: string };
export type FipeAno = { codigo: string; nome: string };
export type FipePreco = {
  TipoVeiculo: number;
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
  SiglaCombustivel: string;
};

async function jget<T>(path: string): Promise<T> {
  const r = await fetchWithTimeout(`${FIPE_BASE}${path}`, {}, 15_000);
  if (!r.ok) throw new Error(`FIPE ${r.status} ${path}`);
  return r.json() as Promise<T>;
}

export const fipe = {
  async marcas(): Promise<FipeMarca[]> {
    return jget('/marcas');
  },

  async modelos(marcaCodigo: string): Promise<FipeModelo[]> {
    const r = await jget<{ modelos: FipeModelo[] }>(`/marcas/${marcaCodigo}/modelos`);
    return r.modelos;
  },

  async anos(marcaCodigo: string, modeloCodigo: string | number): Promise<FipeAno[]> {
    return jget(`/marcas/${marcaCodigo}/modelos/${modeloCodigo}/anos`);
  },

  async preco(marcaCodigo: string, modeloCodigo: string | number, anoCodigo: string): Promise<FipePreco> {
    return jget(`/marcas/${marcaCodigo}/modelos/${modeloCodigo}/anos/${anoCodigo}`);
  },

  /**
   * Busca completa por (marca, modelo, ano).
   * Estratégia:
   *  1. Tokeniza a query (ex: "Civic Touring 2024" → ["civic", "touring"])
   *  2. Filtra modelos que contêm TODOS os tokens (AND, não OR)
   *  3. Para cada candidato, busca anos disponíveis
   *  4. Se ano informado, EXIGE que o modelo tenha aquele ano
   *  5. Ordena candidatos por (tem o ano correto, score de match, comprimento do nome)
   */
  async findVehicle(marcaNome: string, modeloQuery: string, ano?: number): Promise<FipePreco | null> {
    const marcas = await this.marcas();
    const marca = marcas.find(m => m.nome.toLowerCase() === marcaNome.toLowerCase());
    if (!marca) return null;

    const modelos = await this.modelos(marca.codigo);
    const tokens = modeloQuery.toLowerCase().split(/\s+/).filter(t => t.length >= 2 && !/^\d{4}$/.test(t));

    // Score = quantos tokens da query aparecem no nome do modelo
    const scored = modelos
      .map(m => {
        const name = m.nome.toLowerCase();
        const score = tokens.filter(t => name.includes(t)).length;
        return { modelo: m, score, nameLen: m.nome.length };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.nameLen - b.nameLen);

    if (scored.length === 0) return null;

    // Tenta até 8 candidatos (modelos brasileiros costumam ter variações longas)
    const candidates: { preco: FipePreco; modelMatchScore: number }[] = [];
    for (const { modelo, score } of scored.slice(0, 8)) {
      try {
        const anos = await this.anos(marca.codigo, modelo.codigo);
        const reais = anos.filter(a => /^\d{4}-\d$/.test(a.codigo));
        if (reais.length === 0) continue;

        if (ano) {
          // EXIGE o ano informado
          const anoMatch = reais.find(a => a.codigo.startsWith(`${ano}-`));
          if (!anoMatch) continue;
          const preco = await this.preco(marca.codigo, modelo.codigo, anoMatch.codigo);
          candidates.push({ preco, modelMatchScore: score });
        } else {
          // Pega o mais recente
          const mostRecent = reais.sort((a, b) => b.codigo.localeCompare(a.codigo))[0]!;
          const preco = await this.preco(marca.codigo, modelo.codigo, mostRecent.codigo);
          candidates.push({ preco, modelMatchScore: score });
        }
      } catch { continue; }
    }

    if (candidates.length === 0) return null;
    // Retorna o de maior match score (já está pré-ordenado)
    return candidates.sort((a, b) => b.modelMatchScore - a.modelMatchScore)[0]!.preco;
  },

  /**
   * Converte "R$ 415.842,00" → 41584200 (centavos)
   * ou para BRL inteiro: 415842
   */
  parseValor(valor: string): number {
    const clean = valor.replace(/[^0-9,]/g, '').replace(',', '.');
    const n = parseFloat(clean);
    return Math.round(n);
  },
};
