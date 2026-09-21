/**
 * Sessão própria do mobile — substitui o Supabase Auth (GoTrue).
 *
 * Fala com a API (POST /auth/login e /auth/register), guarda {token, user}
 * no AsyncStorage e avisa quem se inscreveu via onAuthStateChange
 * (listeners em memória; sem refresh automático — o JWT expira sozinho e o
 * usuário faz login de novo).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export type UserRole = 'admin' | 'gestor' | 'analista';

export type SessionUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  dealership_id: string | null;
};

export type Session = { token: string; user: SessionUser };

type Listener = (session: Session | null) => void;

const STORAGE_KEY = 'faroai.session';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as any)?.API_URL ||
  'http://localhost:3333';

const listeners = new Set<Listener>();
// Cache em memória para não bater no AsyncStorage a cada request.
let cached: Session | null | undefined;

function isSession(v: unknown): v is Session {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<Session>;
  return typeof s.token === 'string' && !!s.user && typeof s.user.id === 'string';
}

function notify(session: Session | null) {
  for (const fn of listeners) {
    try {
      fn(session);
    } catch (e) {
      console.warn('[auth] listener error', e);
    }
  }
}

async function persist(session: Session | null) {
  cached = session;
  try {
    if (session) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[auth] falha ao persistir sessão', e);
  }
  notify(session);
}

async function authRequest(path: '/auth/login' | '/auth/register', body: Record<string, unknown>): Promise<Session> {
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!r.ok) {
    throw new Error(data?.message || data?.error || `${r.status} ${text}`);
  }
  if (!isSession(data)) throw new Error('resposta de autenticação inválida');
  const session: Session = { token: data.token, user: data.user };
  await persist(session);
  return session;
}

/** POST /auth/login — 401 vira Error('invalid credentials'). */
export function login(email: string, password: string): Promise<Session> {
  return authRequest('/auth/login', { email: email.trim(), password });
}

/** POST /auth/register — cria role analista; 409 se e-mail já existe. */
export function register(email: string, password: string, full_name?: string): Promise<Session> {
  const body: Record<string, unknown> = { email: email.trim(), password };
  if (full_name?.trim()) body.full_name = full_name.trim();
  return authRequest('/auth/register', body);
}

export async function logout(): Promise<void> {
  await persist(null);
}

/** Sessão salva (ou null). Lê do AsyncStorage na primeira vez, depois usa cache. */
export async function getSession(): Promise<Session | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    cached = isSession(parsed) ? parsed : null;
  } catch (e) {
    console.warn('[auth] falha ao ler sessão', e);
    cached = null;
  }
  return cached;
}

export async function getToken(): Promise<string | null> {
  return (await getSession())?.token ?? null;
}

/**
 * Inscreve um listener chamado a cada login/logout. Retorna a função que
 * cancela a inscrição (uso em useEffect: `return onAuthStateChange(...)`).
 */
export function onAuthStateChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
