import Constants from 'expo-constants';
import { supabase } from './supabase';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as any)?.API_URL ||
  'http://localhost:3333';

async function authedHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function jget<T>(path: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, { headers: await authedHeaders() });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function jpost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: await authedHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  health: () => jget<{ status: string }>('/health'),
  me: () => jget('/me'),
  // Desafio 1
  listVehicles: (params?: { marca?: string; modelo?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return jget<any[]>(`/competitive/vehicles${qs}`);
  },
  lookupVehicle: (marca: string, modelo: string, versao?: string, fields?: string[]) => {
    const params: any = { marca, modelo };
    if (versao) params.versao = versao;
    if (fields?.length) params.fields = fields.join(',');
    return jget<any>(`/competitive/lookup?${new URLSearchParams(params).toString()}`);
  },
  compareVehicles: (ids: string[]) => jpost<any>('/competitive/compare', { vehicle_ids: ids }),
  listFields: () => jget<{ label: string; path: string; criterion: string }[]>('/competitive/fields'),
  // Desafio 2
  createClient: (body: Record<string, unknown>) => jpost<any>('/clients', body),
  listClients: (params?: { perfil?: string; risco_min?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return jget<{ total: number; results: any[] }>(`/clients${qs}`);
  },
  getClient: (id: string) => jget<any>(`/clients/${id}`),
  listLeads: (risco_min = 0.6) => jget<any[]>(`/clients/leads?risco_min=${risco_min}`),
  metrics: () => jget<any>('/metrics/dealership'),
  // Insights
  clientInsight: (id: string) => jget<any>(`/insights/client/${id}`),
  portfolioInsight: () => jget<any>('/insights/portfolio'),
};
