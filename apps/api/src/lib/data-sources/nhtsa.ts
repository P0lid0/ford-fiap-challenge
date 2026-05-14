/**
 * Cliente NHTSA vPIC — Vehicle Product Information Catalog.
 *
 * API pública, gratuita, mantida pelo governo dos EUA.
 * É a base oficial para decodificação de VIN. Cobre fabricantes globais
 * (Ford, Toyota, VW, RAM, Chevrolet) mas com foco no mercado USA.
 *
 * Usamos para confirmar: número de cilindros, displacement em cc,
 * tipo de combustível, transmissão, body class, drive type.
 * Não tem preço BR nem versões BR-específicas.
 */
import { fetch } from 'undici';

const NHTSA = 'https://vpic.nhtsa.dot.gov/api';

export type NhtsaSpec = {
  variable: string;
  value: string | null;
};

async function jget<T>(path: string): Promise<T> {
  const r = await fetch(`${NHTSA}${path}${path.includes('?') ? '&' : '?'}format=json`);
  if (!r.ok) throw new Error(`NHTSA ${r.status}`);
  return r.json() as Promise<T>;
}

export const nhtsa = {
  async modelsForMakeYear(make: string, year: number) {
    return jget<{ Count: number; Results: { Make_Name: string; Model_Name: string }[] }>(
      `/vehicles/getmodelsformakeyear/make/${encodeURIComponent(make)}/modelyear/${year}`
    );
  },

  /**
   * Busca specs de um modelo via "vehicle variables" — sem VIN específico.
   * Para um VIN específico, use decodeVin().
   */
  async decodeVin(vin: string): Promise<NhtsaSpec[]> {
    const r = await jget<{ Results: { Variable: string; Value: string | null }[] }>(
      `/vehicles/decodevin/${encodeURIComponent(vin)}`
    );
    return r.Results.map(x => ({ variable: x.Variable, value: x.Value }));
  },

  /**
   * Mapeia dados NHTSA → schema canônico parcial.
   * Em produção, expandir para incluir EngineHP, DisplacementCC, etc.
   */
  async getModelSpecs(make: string, model: string, year: number): Promise<Record<string, unknown>> {
    try {
      const models = await this.modelsForMakeYear(make, year);
      const found = models.Results.find(
        m => m.Make_Name.toLowerCase() === make.toLowerCase() &&
             m.Model_Name.toLowerCase() === model.toLowerCase()
      );
      if (!found) return { _nhtsa_match: false };
      return { _nhtsa_match: true, _nhtsa_year: year };
    } catch {
      return { _nhtsa_match: false };
    }
  },
};
