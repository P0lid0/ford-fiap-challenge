/**
 * Modelos de domínio do app mobile.
 *
 * Espelham os contratos JSON da API (apps/api) — mesmos nomes de campo (snake_case)
 * para que ApiDataSource e LocalDataSource devolvam exatamente o mesmo formato.
 */

// ─── Enumerações ────────────────────────────────────────────────────────────

export const PERFIS = ['fiel', 'abandono', 'esquecido', 'economico'] as const;
export type Perfil = (typeof PERFIS)[number];

export const REGIOES = ['sul', 'sudeste', 'centro_oeste', 'nordeste', 'norte'] as const;
export type Regiao = (typeof REGIOES)[number];

export const GENEROS = ['M', 'F', 'outro'] as const;
export type Genero = (typeof GENEROS)[number];

export const ESTADOS_CIVIS = ['solteiro', 'casado', 'divorciado', 'viuvo'] as const;
export type EstadoCivil = (typeof ESTADOS_CIVIS)[number];

export const FINANCIAMENTOS = ['a_vista', 'financiado', 'leasing', 'consorcio'] as const;
export type Financiamento = (typeof FINANCIAMENTOS)[number];

export const CANAIS_AQUISICAO = ['concessionaria', 'online', 'frota', 'indicacao'] as const;
export type CanalAquisicao = (typeof CANAIS_AQUISICAO)[number];

/** Modelos Ford aceitos por POST /clients (enum `model_name` da API). */
export const FORD_MODELS = [
  'RANGER', 'TERRITORY', 'BRONCO SPORT', 'MAVERICK', 'TRANSIT', 'F-150',
  'MUSTANG', 'MUSTANG MACH-E', 'KA', 'ECOSPORT',
] as const;
export type FordModel = (typeof FORD_MODELS)[number];

export const LEAD_SINAIS = [
  'revisao_atrasada', 'garantia_vencida', 'garantia_vencendo',
  'dealer_loyalty_baixa', 'veiculo_veterano', 'sem_revisao_alguma',
] as const;
export type LeadSinal = (typeof LEAD_SINAIS)[number];

// ─── Autenticação ───────────────────────────────────────────────────────────

export type UserSession = {
  userId: string;
  email: string;
  accessToken: string;
};

// ─── Desafio 2 — Retenção ───────────────────────────────────────────────────

/** Resumo da predição embutido na listagem de clientes. */
export type PredictionSummary = {
  perfil_predito: Perfil;
  risco_evasao: number;   // 0..1
  confianca: number;      // 0..1
  created_at: string;
};

/** Predição completa (GET /clients/:id). */
export type Prediction = PredictionSummary & {
  id: string;
  client_id: string;
  model_version: string;
  prob_fiel: number;
  prob_abandono: number;
  prob_esquecido: number;
  prob_economico: number;
  recomendacoes_acao: string[];
};

/** Item de GET /clients. */
export type ClientSummary = {
  id: string;
  nome_cliente: string | null;
  model_name: string;
  model_year: number | null;
  modelo_comprado: string | null;
  versao_comprada: string | null;
  preco_pago_brl: number | null;
  perfil_real: Perfil | null;
  created_at: string;
  predictions: PredictionSummary[];
};

/** Cliente completo (GET /clients/:id → client). Campos pré-compra podem faltar nos dados reais Ford. */
export type Client = ClientSummary & {
  sales_date: string | null;
  idade: number | null;
  genero: Genero | null;
  regiao: Regiao | null;
  renda_mensal_brl: number | null;
  estado_civil: EstadoCivil | null;
  score_credito: number | null;
  financiamento: Financiamento | null;
  parcelas: number | null;
  canal_aquisicao: CanalAquisicao | null;
  primeiro_carro: boolean | null;
  test_drive_realizado: boolean | null;
  num_revisoes: number | null;
  dias_desde_ultima_revisao: number | null;
};

export type ClientDetail = {
  client: Client;
  predictions: Prediction[];
};

export type ClientPage = {
  total: number;
  results: ClientSummary[];
};

/** Corpo de POST /clients. */
export type NewClientInput = {
  nome_cliente?: string;
  model_name: FordModel;
  model_year: number;
  sales_date: string;          // AAAA-MM-DD
  versao_comprada: string;
  preco_pago_brl: number;
  idade: number;
  genero: Genero;
  regiao: Regiao;
  renda_mensal_brl: number;
  estado_civil: EstadoCivil;
  score_credito: number;
  financiamento: Financiamento;
  parcelas: number;
  canal_aquisicao: CanalAquisicao;
  primeiro_carro: boolean;
  test_drive_realizado: boolean;
};

export type CreatedClient = {
  client: Client;
  prediction: Prediction | null;
};

/** Item de GET /clients/leads (ranking por risco composto). */
export type Lead = {
  id: string;                  // id do cliente
  nome_cliente: string | null;
  model_name: string;
  model_year: number | null;
  perfil_real: Perfil | null;
  dias_desde_ultima_revisao: number | null;
  num_revisoes: number | null;
  risco_composto: number;      // 0..1
  sinais: LeadSinal[];
};

/** GET /metrics/dealership. */
export type DealershipMetrics = {
  total_clientes: number;
  clientes_ativos: number;
  vin_share_estimado: number;        // 0..1
  taxa_aderencia_revisoes: number;   // 0..1
  alto_risco_count: number;
  perfil_counts: Record<Perfil, number>;
  por_modelo: Record<string, number>;
};

// ─── Insights de IA ─────────────────────────────────────────────────────────

export type Insight = {
  source: 'cache' | 'fresh' | 'local';
  model: string;
  output: string;
};

export type PortfolioInsight = Insight & {
  metrics?: {
    totalClients: number;
    avgRisco: number;
    perfilCounts: Record<Perfil, number>;
  };
};

// ─── Desafio 1 — Inteligência Competitiva ──────────────────────────────────

export type Vehicle = {
  id: string;
  marca: string;
  modelo: string;
  versao: string;
  ano: number;
  categoria: string;
  motor: Record<string, unknown>;
  dimensoes: Record<string, unknown>;
  transmissao: Record<string, unknown>;
  desempenho: Record<string, unknown>;
  equipamentos: string[];
  preco_brl: number | null;
  pais_origem: string | null;
};

export type ComparisonCriterion = 'max' | 'min' | 'none';

export type ComparisonField = {
  label: string;
  path: string;
  values: Array<string | number | boolean | null>;
  winner_index: number | null;
  criterion: ComparisonCriterion;
};

/** POST /competitive/compare. */
export type ComparisonResult = {
  vehicles: Vehicle[];
  fields: ComparisonField[];
};
