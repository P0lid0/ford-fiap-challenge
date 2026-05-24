import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

/** Modelo de IA preferido (configurável em /configuracoes). */
export function getPreferredAiModel(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ai_model') || null;
}

/** Funções da app que podem ter modelo de IA configurado por usuário (Configurações). */
export type AiFunction =
  | 'vehicle_search'
  | 'manufacturer_extract'
  | 'compare_analysis'
  | 'client_insight'
  | 'portfolio_insight'
  | 'catalog_autofill';

async function authedHeaders(fn?: AiFunction): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const aiModel = getPreferredAiModel();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(aiModel ? { 'X-AI-Model': aiModel } : {}),
    ...(fn ? { 'X-AI-Function': fn } : {}),
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
  compareVehiclesCanonico: (ids: string[]) =>
    post<any>('/competitive/compare/canonico', { vehicle_ids: ids }),
  listCatalogItems: () =>
    get<{ total: number; sections: any[]; flat: any[] }>('/competitive/catalog-items'),
  getVehicleCatalogValues: (id: string) =>
    get<{
      vehicle: any;
      total_items: number;
      filled: number;
      sections: Array<{ secao: string; count: number; filled: number; items: any[] }>;
    }>(`/competitive/vehicles/${id}/catalog-values`),
  updateVehicleCatalogValues: (id: string, values: Array<{ item_id: string; valor: string | null }>) =>
    jpatch<{ ok: boolean; upserted: number; deleted: number }>(
      `/competitive/vehicles/${id}/catalog-values`, { values }),
  autoFillVehicleCatalog: (id: string, overwrite: boolean = false) =>
    post<{ ok: boolean; filled: number; skipped_existing: number; total_items: number }>(
      `/competitive/vehicles/${id}/catalog-values/auto-fill`, { overwrite }, 'catalog_autofill'),
  searchVehicle: (b: { marca: string; modelo: string; versao?: string; ano?: number; force_refresh?: boolean }) =>
    post<{ source: 'cache' | 'fresh'; vehicle: any }>('/competitive/search', b, 'vehicle_search'),
  analyzeComparison: (ids: string[]) =>
    post<{
      vehicles: any[];
      model: string;
      analise: string;
      citations?: Array<{ url: string; title?: string }>;
    }>('/competitive/compare/analyze', { vehicle_ids: ids }, 'compare_analysis'),
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
  refreshVehiclePrice: (id: string) =>
    post<{
      ok: boolean;
      preco_antigo: number | null;
      preco_novo: number;
      diff: number | null;
      mes_referencia: string;
      fipe_codigo: string;
      vehicle: any;
    }>(`/competitive/vehicles/${id}/refresh-price`, {}),
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
  setAiKey: async (provider: 'openai' | 'anthropic' | 'gemini' | 'fipe' | 'vehicle411' | 'resend' | 'email_from', api_key: string) => {
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
  listClients: (filters: { perfil_real?: string; model_name?: string; is_ford_real?: boolean; search?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v != null && v !== '') qs.append(k, String(v));
    return get<{ total: number; results: any[] }>(`/clients?${qs.toString()}`);
  },
  getClient: (id: string) => get<any>(`/clients/${id}`),
  createClient: (b: any) => post<any>('/clients', b),
  listLeads: (filters: {
    risco_min?: number;
    perfil?: 'fiel' | 'abandono' | 'esquecido' | 'economico';
    modelo?: string;
    dealer_code?: number;
    sinal?: 'revisao_atrasada' | 'garantia_vencida' | 'garantia_vencendo'
          | 'dealer_loyalty_baixa' | 'veiculo_veterano' | 'sem_revisao_alguma';
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (filters.risco_min != null) qs.set('risco_min', String(filters.risco_min));
    if (filters.perfil) qs.set('perfil', filters.perfil);
    if (filters.modelo) qs.set('modelo', filters.modelo);
    if (filters.dealer_code) qs.set('dealer_code', String(filters.dealer_code));
    if (filters.sinal) qs.set('sinal', filters.sinal);
    if (filters.limit) qs.set('limit', String(filters.limit));
    return get<Array<{
      id: string; nome_cliente: string | null; vin_hash: string;
      model_name: string; model_year: number; dealer_code_venda: number;
      perfil_real: 'fiel' | 'abandono' | 'esquecido' | 'economico';
      dias_desde_ultima_revisao: number | null;
      warranty_start_date: string | null;
      dealer_loyalty: number | null;
      num_revisoes: number;
      risco_composto: number;
      sinais: string[];
    }>>(`/clients/leads?${qs.toString()}`);
  },
  leadsStats: () => get<{
    total: number;
    breakdown_urgencia: { alto: number; medio: number; baixo: number };
    por_sinal: Record<string, number>;
    por_perfil: Record<string, number>;
  }>('/clients/leads/stats'),
  metrics: (filters?: { dealer_code?: number; model_name?: string; idade_bucket?: 'novo' | 'intermediario' | 'veterano' }) => {
    const qs = new URLSearchParams();
    if (filters?.dealer_code) qs.set('dealer_code', String(filters.dealer_code));
    if (filters?.model_name) qs.set('model_name', filters.model_name);
    if (filters?.idade_bucket) qs.set('idade_bucket', filters.idade_bucket);
    const q = qs.toString();
    return get<any>(`/metrics/dealership${q ? '?' + q : ''}`);
  },
  proximasRevisoes: (dentro_de_dias = 60, limit = 50) =>
    get<{
      janela_dias: number;
      total: number;
      breakdown: { vencida: number; imediata: number; proxima: number; distante: number };
      results: Array<{
        id: string; nome_cliente: string | null; model_name: string;
        model_year: number; vin_hash: string; dealer_code_venda: number;
        ultimo_servico: string | null; num_revisoes: number;
        perfil_real: string | null;
        proxima_revisao_estimada: string;
        dias_ate_proxima: number;
        urgencia: 'vencida' | 'imediata' | 'proxima' | 'distante';
      }>;
    }>(`/metrics/proximas-revisoes?dentro_de_dias=${dentro_de_dias}&limit=${limit}`),
  garantiaStatus: (anos_garantia = 3, limit = 100) =>
    get<{
      anos_garantia: number;
      total: number;
      counts: { vencida: number; vencendo: number; atencao: number; em_dia: number };
      results: Array<{
        id: string; nome_cliente: string | null; model_name: string;
        model_year: number; vin_hash: string; dealer_code_venda: number;
        warranty_start_date: string; warranty_end_date: string;
        dias_ate_vencer: number;
        status: 'vencida' | 'vencendo' | 'atencao' | 'em_dia';
        perfil_real: string | null; num_revisoes: number;
      }>;
    }>(`/metrics/garantia-status?anos_garantia=${anos_garantia}&limit=${limit}`),
  anomaliasDealer: (min_clientes = 50, limit = 20) =>
    get<{
      total_dealers: number;
      media_rede: number | null;
      dp_rede: number | null;
      anomalias: Array<{
        dealer_code: number;
        total_clientes: number;
        pct_fiel: number; pct_abandono: number; pct_esquecido: number; pct_economico: number;
        z_score_fidelidade: number;
        delta_vs_media: number;
      }>;
      top_performers: Array<{
        dealer_code: number;
        total_clientes: number;
        pct_fiel: number;
        z_score_fidelidade: number;
        delta_vs_media: number;
      }>;
    }>(`/metrics/anomalias-dealer?min_clientes=${min_clientes}&limit=${limit}`),
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
  // E-mail real via Resend (registra ação + envia)
  sendEmailAcao: (b: {
    client_id: string;
    subject?: string;
    body_html?: string;
    use_template?: boolean;
    to_override?: string;
  }) => post<{
    ok: boolean;
    acao_id: string;
    log_id: string;
    provider: 'resend' | 'mock';
    provider_message_id: string | null;
    status: 'sent' | 'failed';
    really_sent: boolean;
    mock_simulation: boolean;
    error?: string;
    preview: { to: string; subject: string; body_html: string };
  }>('/acoes/email-send', b),
  emailConfigStatus: () =>
    get<{
      resend_configured: boolean;
      from_configured: boolean;
      mode: 'real' | 'mock';
      message: string;
    }>('/acoes/email-config'),
  // Preview do template renderizado pra um cliente
  emailTemplatePreview: (client_id: string) =>
    get<{
      client_id: string;
      destinatario: string | null;
      perfil: string | null;
      subject: string;
      body_html: string;
    }>(`/acoes/email-templates/${client_id}`),
  campanha: (b: { perfil: string; tipo: string; titulo: string; descricao?: string; risco_min?: number; limit?: number }) =>
    post<{ ok: boolean; campaign_id: string | null; created: number; message?: string }>('/acoes/campanha', b),
  updateClientNotas: (id: string, notas: string) => jpatch<any>(`/clients/${id}/notas`, { notas }),
  reclassifyClient: (id: string, opts?: { force_ai?: boolean; ai_model?: string }) =>
    post<any>(`/clients/${id}/reclassify`, opts ?? { force_ai: true }),
  fordReal: () => get<any>('/metrics/ford-real'),
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
