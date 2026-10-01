/**
 * Sessão do usuário no web.
 *
 * O login é o da própria API: POST /auth/login devolve { access_token, token_type,
 * expires_in } (JWT HS256 do time). O web guarda o token e a validade no localStorage
 * (chave 'faroai.session') e consulta GET /me para saber e-mail e papel. Todo acesso ao
 * storage é protegido por try/catch: o SSR não tem window e o navegador pode bloquear
 * o storage (modo privado, dados de site bloqueados) — nesse caso a sessão vive só em
 * memória durante a vida da página.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
const STORAGE_KEY = 'faroai.session';

export type UserRole = 'analista' | 'gestor' | 'admin';

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  dealership_id: string | null;
};

export type Session = {
  token: string;
  /** Instante de expiração do token, em ms desde a época. */
  expires_at: number;
  user: SessionUser;
};

// Cópia em memória: cobre o caso de o storage estar indisponível.
let memorySession: Session | null = null;

function isValid(s: unknown): s is Session {
  const x = s as Partial<Session> | null;
  return !!x
    && typeof x.token === 'string'
    && typeof x.expires_at === 'number'
    && !!x.user
    && typeof x.user.id === 'string'
    && typeof x.user.email === 'string'
    && typeof x.user.role === 'string';
}

function readStorage(): Session | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(session: Session | null) {
  try {
    if (typeof window === 'undefined') return;
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage indisponível — a sessão fica só em memória
  }
}

/** Sessão atual ou null quando não há login (ou o token já expirou). */
export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const s = readStorage() ?? memorySession;
  if (!s) return null;
  if (s.expires_at <= Date.now()) {
    logout();
    return null;
  }
  return s;
}

/** Token da API para o header Authorization, ou null. */
export function getToken(): string | null {
  return getSession()?.token ?? null;
}

/** Descarta a sessão local (o JWT é stateless — a API não guarda nada para revogar). */
export function logout(): void {
  memorySession = null;
  writeStorage(null);
}

/**
 * Chamada quando a API responde 401 a um token que o web achava válido (expirado,
 * assinatura trocada, usuário removido): limpa a sessão e volta para o login.
 */
export function expireSession(): void {
  const tinhaSessao = !!(readStorage() ?? memorySession);
  logout();
  if (tinhaSessao && typeof window !== 'undefined' && window.location.pathname !== '/') {
    window.location.replace('/');
  }
}

/** Extrai a mensagem de uma resposta de erro (Problem Details do time ou texto cru). */
async function errorMessage(r: Response): Promise<string> {
  const text = await r.text();
  try {
    const data = text ? JSON.parse(text) : null;
    const msg = data?.detail ?? data?.message ?? data?.title ?? data?.error;
    if (msg) return String(msg);
  } catch { /* corpo não-JSON */ }
  return text || `HTTP ${r.status}`;
}

/**
 * POST /auth/login + GET /me. Guarda a sessão e a devolve.
 * Lança Error com a mensagem da API (ex.: "e-mail ou senha inválidos").
 */
export async function login(email: string, password: string): Promise<Session> {
  const r = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await errorMessage(r));

  const data = await r.json().catch(() => null);
  if (!data || typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') {
    throw new Error('resposta de autenticação inválida');
  }

  // E-mail e papel vêm de /me (claims do token) — o login só devolve o token.
  const me = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
    cache: 'no-store',
  });
  if (!me.ok) throw new Error(await errorMessage(me));
  const user = await me.json().catch(() => null);
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') {
    throw new Error('resposta de /me inválida');
  }

  const session: Session = {
    token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      dealership_id: user.dealership_id ?? null,
    },
  };
  memorySession = session;
  writeStorage(session);
  return session;
}
