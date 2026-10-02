/**
 * Contrato da camada de dados do app (padrão Repository).
 *
 * Duas implementações:
 *  - ApiDataSource   → API REST (apps/api) com login em POST /auth/login (JWT da API) — desenvolvimento
 *  - LocalDataSource → dados de demonstração embutidos       — APK de entrega
 *
 * As telas dependem só desta interface; a escolha é feita em lib/data/index.ts.
 */
import type {
  ClientDetail,
  ClientPage,
  ComparisonResult,
  CreatedClient,
  DealershipMetrics,
  Insight,
  Lead,
  NewClientInput,
  PortfolioInsight,
  UserSession,
  Vehicle,
} from '../types';

export type DataMode = 'api' | 'local';

export type SessionListener = (session: UserSession | null) => void;

export interface DataSource {
  readonly mode: DataMode;

  // ─── Autenticação ─────────────────────────────────────────
  getSession(): Promise<UserSession | null>;
  signIn(email: string, password: string): Promise<UserSession>;
  signOut(): Promise<void>;
  /** Registra um ouvinte de mudança de sessão. Retorna a função para cancelar. */
  onSessionChange(listener: SessionListener): () => void;

  // ─── Desafio 2 — Retenção ─────────────────────────────────
  getMetrics(): Promise<DealershipMetrics>;
  listClients(): Promise<ClientPage>;
  getClient(id: string): Promise<ClientDetail>;
  createClient(input: NewClientInput): Promise<CreatedClient>;
  listLeads(riscoMin?: number): Promise<Lead[]>;
  getClientInsight(clientId: string): Promise<Insight>;
  getPortfolioInsight(): Promise<PortfolioInsight>;

  // ─── Desafio 1 — Inteligência Competitiva ─────────────────
  listVehicles(): Promise<Vehicle[]>;
  compareVehicles(vehicleIds: string[]): Promise<ComparisonResult>;
}

// ─── Erros ──────────────────────────────────────────────────

export type DataSourceErrorCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'unknown';

const DEFAULT_MESSAGES: Record<DataSourceErrorCode, string> = {
  network: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
  timeout: 'O servidor demorou para responder. Tente novamente.',
  unauthorized: 'Sua sessão expirou. Entre novamente.',
  forbidden: 'Você não tem permissão para esta ação.',
  not_found: 'Registro não encontrado.',
  validation: 'Alguns dados estão inválidos. Revise o formulário.',
  server: 'Erro no servidor. Tente novamente em instantes.',
  unknown: 'Algo deu errado. Tente novamente.',
};

/**
 * Único tipo de erro que a camada de dados lança.
 * `message` já vem em português, pronta para exibir ao usuário.
 */
export class DataSourceError extends Error {
  readonly code: DataSourceErrorCode;
  readonly status?: number;

  constructor(code: DataSourceErrorCode, message?: string, status?: number) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'DataSourceError';
    this.code = code;
    this.status = status;
  }

  /** Converte qualquer erro desconhecido em DataSourceError. */
  static from(error: unknown): DataSourceError {
    if (error instanceof DataSourceError) return error;
    return new DataSourceError('unknown');
  }

  /** Mapeia um status HTTP para o código de erro correspondente. */
  static fromHttpStatus(status: number, message?: string): DataSourceError {
    const code: DataSourceErrorCode =
      status === 401 ? 'unauthorized'
      : status === 403 ? 'forbidden'
      : status === 404 ? 'not_found'
      : status === 400 || status === 409 || status === 422 ? 'validation'
      : status >= 500 ? 'server'
      : 'unknown';
    return new DataSourceError(code, message, status);
  }
}
