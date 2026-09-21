/**
 * Sessão do usuário no web — substitui o Supabase Auth.
 *
 * A API emite um JWT próprio (POST /auth/login e /auth/register) e o web
 * guarda {token, user} no localStorage (chave 'faroai.session'). Todo acesso
 * ao storage é protegido por try/catch: SSR não tem window, e o navegador
 * pode bloquear storage (modo privado, dados de site bloqueados).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
const STORAGE_KEY = 'faroai.session';

export type UserRole = 'analista' | 'gestor' | 'admin';

export type SessionUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  dealership_id: string | null;
};

export type Session = { token: string; user: SessionUser };

function readStorage(): Session | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed || typeof parsed.token !== 'string' || !parsed.user || typeof parsed.user.id !== 'string') {
      return null;
    }
    return parsed as Session;
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
    // storage indisponível — sessão vive só em memória nesta página
  }
}

/** Sessão atual ({token, user}) ou null quando não há login. */
export function getSession(): Session | null {
  return readStorage();
}

/** Token JWT para o header Authorization, ou null. */
export function getToken(): string | null {
  return readStorage()?.token ?? null;
}

async function authRequest(path: '/auth/login' | '/auth/register', body: Record<string, unknown>): Promise<Session> {
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* corpo não-JSON */ }
  if (!r.ok) {
    // A API devolve {error, message}; mostramos a mensagem quando existir.
    const message = data?.message ?? data?.error ?? text ?? `${r.status}`;
    throw new Error(String(message));
  }
  if (!data?.token || !data?.user) throw new Error('resposta de autenticação inválida');
  const session: Session = { token: data.token, user: data.user };
  writeStorage(session);
  return session;
}

/** POST /auth/login — guarda a sessão e a devolve. Lança Error com a mensagem da API. */
export function login(email: string, password: string): Promise<Session> {
  return authRequest('/auth/login', { email, password });
}

/** POST /auth/register — cria usuário (role analista) e já entra. */
export function register(email: string, password: string, full_name?: string): Promise<Session> {
  return authRequest('/auth/register', { email, password, ...(full_name ? { full_name } : {}) });
}

/** Encerra a sessão local (o JWT é stateless — basta descartar). */
export function logout(): void {
  writeStorage(null);
}
