import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

async function authedHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  listFields: () => get<{ label: string; path: string; criterion: string }[]>('/competitive/fields'),
  listClients: () => get<{ total: number; results: any[] }>('/clients'),
  getClient: (id: string) => get<any>(`/clients/${id}`),
  createClient: (b: any) => post<any>('/clients', b),
  listLeads: (riscoMin = 0.5) => get<any[]>(`/clients/leads?risco_min=${riscoMin}`),
  metrics: () => get<any>('/metrics/dealership'),
  insightClient: (id: string) => get<any>(`/insights/client/${id}`),
  insightPortfolio: () => get<any>('/insights/portfolio'),
};
