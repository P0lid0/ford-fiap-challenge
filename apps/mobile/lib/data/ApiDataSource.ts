/**
 * Implementação de DataSource que consome a API REST (apps/api).
 *
 * Autenticação: POST /auth/login devolve um JWT emitido pela própria API.
 * O token fica no AsyncStorage e segue em `Authorization: Bearer <token>`.
 * Validade de 1 h, sem refresh: ao expirar (ou em qualquer 401), a sessão é encerrada.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig } from '../config';
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
import { DataSourceError, type DataSource, type SessionListener } from './DataSource';

const SESSION_STORAGE_KEY = 'faroai.session';

/** Folga para considerar o token expirado um pouco antes do `exp` real. */
const EXPIRY_MARGIN_SECONDS = 30;

type LoginResponse = { access_token: string; token_type: 'Bearer'; expires_in: number };

type StoredSession = UserSession & { expiresAt: number }; // epoch em segundos

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Rotas públicas (login): não enviam token e não encerram a sessão em 401. */
  isPublic?: boolean;
  /** Tempo limite desta chamada (padrão: AppConfig.requestTimeoutMs). */
  timeoutMs?: number;
};

export class ApiDataSource implements DataSource {
  readonly mode = 'api' as const;

  private session: StoredSession | null = null;
  private sessionLoaded = false;
  private readonly listeners = new Set<SessionListener>();

  // ─── Autenticação ─────────────────────────────────────────

  async getSession(): Promise<UserSession | null> {
    if (!this.sessionLoaded) {
      this.session = await this.readStoredSession();
      this.sessionLoaded = true;
    }
    if (this.session && isExpired(this.session.expiresAt)) {
      await this.clearSession();
    }
    return this.session;
  }

  async signIn(email: string, password: string): Promise<UserSession> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password },
      isPublic: true,
    });

    const claims = decodeJwtPayload(response.access_token);
    const session: StoredSession = {
      userId: String(claims.sub ?? ''),
      email: String(claims.email ?? email),
      accessToken: response.access_token,
      expiresAt: typeof claims.exp === 'number'
        ? claims.exp
        : nowInSeconds() + response.expires_in,
    };

    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    this.setSession(session);
    return session;
  }

  async signOut(): Promise<void> {
    await this.clearSession();
  }

  onSessionChange(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // ─── Desafio 2 — Retenção ─────────────────────────────────

  getMetrics(): Promise<DealershipMetrics> {
    return this.request('/metrics/dealership');
  }

  listClients(): Promise<ClientPage> {
    return this.request('/clients?limit=50');
  }

  getClient(id: string): Promise<ClientDetail> {
    return this.request(`/clients/${encodeURIComponent(id)}`);
  }

  createClient(input: NewClientInput): Promise<CreatedClient> {
    return this.request('/clients', { method: 'POST', body: input });
  }

  listLeads(riscoMin = 0.5): Promise<Lead[]> {
    return this.request(`/clients/leads?risco_min=${riscoMin}&limit=50`);
  }

  getClientInsight(clientId: string): Promise<Insight> {
    return this.request(`/insights/client/${encodeURIComponent(clientId)}`, { timeoutMs: AppConfig.aiRequestTimeoutMs });
  }

  getPortfolioInsight(): Promise<PortfolioInsight> {
    return this.request('/insights/portfolio', { timeoutMs: AppConfig.aiRequestTimeoutMs });
  }

  // ─── Desafio 1 — Inteligência Competitiva ─────────────────

  listVehicles(): Promise<Vehicle[]> {
    return this.request('/competitive/vehicles?limit=100');
  }

  compareVehicles(vehicleIds: string[]): Promise<ComparisonResult> {
    return this.request('/competitive/compare', { method: 'POST', body: { vehicle_ids: vehicleIds } });
  }

  // ─── HTTP ─────────────────────────────────────────────────

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, isPublic = false, timeoutMs = AppConfig.requestTimeoutMs } = options;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!isPublic) {
      const session = await this.getSession();
      if (!session) throw new DataSourceError('unauthorized');
      headers.Authorization = `Bearer ${session.accessToken}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${AppConfig.apiUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new DataSourceError('timeout');
      throw new DataSourceError('network');
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw await this.toError(response, isPublic);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Converte a resposta de erro (Problem Details — RFC 7807) em DataSourceError. */
  private async toError(response: Response, isPublic: boolean): Promise<DataSourceError> {
    const detail = await readProblemDetail(response);
    const { status } = response;

    if (status === 401 && !isPublic) {
      await this.clearSession(); // token expirado ou inválido → volta ao login
      return new DataSourceError('unauthorized', undefined, status);
    }
    if (status === 429) {
      return new DataSourceError('server', 'Muitas tentativas seguidas. Aguarde um minuto.', status);
    }
    // Mensagens da API já vêm em português e são úteis nestes casos.
    const useApiMessage = isPublic || [400, 404, 409, 422].includes(status);
    return DataSourceError.fromHttpStatus(status, useApiMessage ? capitalize(detail) : undefined);
  }

  // ─── Sessão ───────────────────────────────────────────────

  private async readStoredSession(): Promise<StoredSession | null> {
    try {
      const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  }

  private async clearSession(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => undefined);
    this.setSession(null);
  }

  private setSession(session: StoredSession | null): void {
    const changed = this.session?.accessToken !== session?.accessToken;
    this.session = session;
    this.sessionLoaded = true;
    if (changed) this.listeners.forEach(listener => listener(session));
  }
}

// ─── Utilitários ────────────────────────────────────────────

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isExpired(expiresAt: number): boolean {
  return nowInSeconds() >= expiresAt - EXPIRY_MARGIN_SECONDS;
}

function capitalize(text: string | undefined): string | undefined {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : undefined;
}

async function readProblemDetail(response: Response): Promise<string | undefined> {
  try {
    const problem = (await response.json()) as { detail?: string; message?: string };
    return problem.detail ?? problem.message;
  } catch {
    return undefined;
  }
}

/** Lê as claims do JWT (sem validar assinatura — quem valida é a API). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1] ?? '';
    return JSON.parse(base64UrlDecode(payload)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodificador base64url → UTF-8 sem depender de atob/Buffer. */
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of base64) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) continue; // ignora padding '='
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return decodeURIComponent(bytes.map(b => `%${b.toString(16).padStart(2, '0')}`).join(''));
}
