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

// Pra multipart uploads: NÃO setar Content-Type (browser põe boundary).
async function authedHeadersNoJson(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get<T>(path: string, fn?: AiFunction): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, { headers: await authedHeaders(fn), cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
async function post<T>(path: string, body: unknown, fn?: AiFunction): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST', headers: await authedHeaders(fn), body: JSON.stringify(body), cache: 'no-store',
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
async function jdelete(path: string): Promise<void> {
  // DELETE não tem body — Fastify rejeita Content-Type: application/json sem body.
  const r = await fetch(`${API_URL}${path}`, { method: 'DELETE', headers: await authedHeadersNoJson() });
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${await r.text()}`);
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
    post<{ source: 'cache' | 'fresh'; vehicle: any }>('/competitive/search', b, 'vehicle_search'),
  analyzeComparison: (ids: string[]) =>
    post<{ vehicles: any[]; model: string; analise: string }>('/competitive/compare/analyze', { vehicle_ids: ids }, 'compare_analysis'),
  listMarcas: () => get<{ codigo: string; nome: string; tem_scraping: boolean }[]>('/competitive/marcas'),
  getVehicle: (id: string) => get<any>(`/competitive/vehicles/${id}`),
  createVehicle: (v: any) => post<any>('/competitive/vehicles', v),
  updateVehicle: (id: string, patch: any) => jpatch<any>(`/competitive/vehicles/${id}`, patch),
  deleteVehicle: async (id: string) => {
    const r = await fetch(`${API_URL}/competitive/vehicles/${id}`, {
      method: 'DELETE', headers: await authedHeadersNoJson(), // sem Content-Type — Fastify recusa JSON sem body
    });
    if (!r.ok) {
      let detail = '';
      try {
        const body = await r.json();
        detail = body?.message ?? body?.error ?? '';
      } catch { detail = await r.text(); }
      throw new Error(`Falha ao excluir (HTTP ${r.status}): ${detail}`);
    }
    return r.json().catch(() => ({ ok: true }));
  },
  refreshVehicle: (id: string, opts?: { ebook_url?: string; skip_ebook?: boolean }) =>
    post<any>(`/competitive/vehicles/${id}/refresh`, opts ?? {}),
  importVehicles: (format: 'json' | 'csv', content: string) =>
    post<any>('/competitive/vehicles/import', { format, content }),
  importVehiclesFromFile: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${API_URL}/competitive/import/file`, {
      method: 'POST',
      headers: await authedHeadersNoJson(),
      body: fd,
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<{
      filename: string; mime: string; size_bytes: number;
      extracted_by: string; count: number; veiculos: any[];
    }>;
  },
  // FIPE drilldown
  fipeModelosAgrupados: (marcaCodigo: string) =>
    get<{ base: string; versoes: { codigo: number; nome: string }[]; count: number }[]>(
      `/competitive/fipe/modelos-agrupados/${marcaCodigo}`),
  fipeAnos: (marcaCodigo: string, modeloCodigo: string | number) =>
    get<{ codigo: string; nome: string }[]>(
      `/competitive/fipe/anos?marcaCodigo=${marcaCodigo}&modeloCodigo=${modeloCodigo}`),
  searchByFipe: (b: { marca_codigo: string; modelo_codigo: string | number; ano_codigo: string }) =>
    post<{ source: 'cache' | 'fresh'; vehicle: any }>('/competitive/search/fipe', b, 'vehicle_search'),
  // AI config (admin)
  getAiKeys: () => get<Record<string, { configured: boolean; source: string; preview?: string }>>('/admin/ai-keys'),
  setAiKey: async (provider: 'openai' | 'anthropic' | 'gemini' | 'fipe' | 'vehicle411', api_key: string) => {
    const r = await fetch(`${API_URL}/admin/ai-keys/${provider}`, {
      method: 'PUT', headers: await authedHeaders(), body: JSON.stringify({ api_key }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  deleteAiKey: (provider: string) => jdelete(`/admin/ai-keys/${provider}`),
  getAiModels: () => get<Record<string, { id: string; label: string; tier: string }[]>>('/admin/ai-models'),
  getFunctionModels: () => get<{ function_name: string; model_id: string }[]>('/admin/ai-function-models'),
  setFunctionModel: async (fn: AiFunction, model_id: string) => {
    const r = await fetch(`${API_URL}/admin/ai-function-models/${fn}`, {
      method: 'PUT', headers: await authedHeaders(), body: JSON.stringify({ model_id }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  clearFunctionModel: (fn: AiFunction) => jdelete(`/admin/ai-function-models/${fn}`),
  listFields: () => get<{ label: string; path: string; criterion: string }[]>('/competitive/fields'),
  listClients: () => get<{ total: number; results: any[] }>('/clients'),
  getClient: (id: string) => get<any>(`/clients/${id}`),
  createClient: (b: any) => post<any>('/clients', b),
  listLeads: (riscoMin = 0.5) => get<any[]>(`/clients/leads?risco_min=${riscoMin}`),
  metrics: () => get<any>('/metrics/dealership'),
  insightClient: (id: string) => get<any>(`/insights/client/${id}`),
  insightPortfolio: () => get<any>('/insights/portfolio'),

  // Ações de retenção (D2)
  listAcoes: (filters: { client_id?: string; status?: string; tipo?: string; perfil_alvo?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v != null && v !== '') qs.append(k, String(v));
    return get<{ total: number; results: any[] }>(`/acoes?${qs.toString()}`);
  },
  createAcao: (b: any) => post<any>('/acoes', b),
  updateAcao: (id: string, patch: any) => jpatch<any>(`/acoes/${id}`, patch),
  campanha: (b: { perfil: string; tipo: string; titulo: string; descricao?: string; risco_min?: number; limit?: number }) =>
    post<{ ok: boolean; campaign_id: string | null; created: number; message?: string }>('/acoes/campanha', b),
  acoesKpis: () => get<{
    total: number;
    por_status: Record<string, number>;
    por_tipo: Record<string, number>;
    por_perfil: Record<string, number>;
    taxa_conclusao: number;
    taxa_sucesso: number;
    lead_time_horas_medio: number | null;
  }>('/acoes/kpis'),
};
