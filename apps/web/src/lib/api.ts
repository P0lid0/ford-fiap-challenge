import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

/** Modelo de IA preferido (configurável em /configuracoes). */
export function getPreferredAiModel(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ai_model') || null;
}

async function authedHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const aiModel = getPreferredAiModel();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(aiModel ? { 'X-AI-Model': aiModel } : {}),
  };
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, { headers: await authedHeaders(), cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST', headers: await authedHeaders(), body: JSON.stringify(body), cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
async function jpatch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    method: 'PATCH', headers: await authedHeaders(), body: JSON.stringify(body), cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  me: () => get<any>('/me'),
  listVehicles: () => get<any[]>('/competitive/vehicles'),
  lookupVehicle: (marca: string, modelo: string, versao?: string, fields?: string[]) => {
    const p: any = { marca, modelo };
    if (versao) p.versao = versao;
    if (fields?.length) p.fields = fields.join(',');
    return get<any[]>(`/competitive/lookup?${new URLSearchParams(p)}`);
  },
  compareVehicles: (ids: string[]) => post<any>('/competitive/compare', { vehicle_ids: ids }),
  searchVehicle: (b: { marca: string; modelo: string; versao?: string; ano?: number; force_refresh?: boolean }) =>
    post<{ source: 'cache' | 'fresh'; vehicle: any }>('/competitive/search', b),
  analyzeComparison: (ids: string[]) =>
    post<{ vehicles: any[]; model: string; analise: string }>('/competitive/compare/analyze', { vehicle_ids: ids }),
  listMarcas: () => get<{ codigo: string; nome: string; tem_scraping: boolean }[]>('/competitive/marcas'),
  getVehicle: (id: string) => get<any>(`/competitive/vehicles/${id}`),
  createVehicle: (v: any) => post<any>('/competitive/vehicles', v),
  updateVehicle: (id: string, patch: any) => jpatch<any>(`/competitive/vehicles/${id}`, patch),
  importVehicles: (format: 'json' | 'csv', content: string) =>
    post<any>('/competitive/vehicles/import', { format, content }),
  listFields: () => get<{ label: string; path: string; criterion: string }[]>('/competitive/fields'),
  listClients: () => get<{ total: number; results: any[] }>('/clients'),
  getClient: (id: string) => get<any>(`/clients/${id}`),
  createClient: (b: any) => post<any>('/clients', b),
  listLeads: (riscoMin = 0.5) => get<any[]>(`/clients/leads?risco_min=${riscoMin}`),
  metrics: () => get<any>('/metrics/dealership'),
  insightClient: (id: string) => get<any>(`/insights/client/${id}`),
  insightPortfolio: () => get<any>('/insights/portfolio'),
};
