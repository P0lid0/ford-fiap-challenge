/**
 * Dublês das dependências externas da API. O `test/setup.ts` liga cada um
 * no lugar do módulo real; cada teste configura o comportamento que precisa.
 *
 * Nenhum teste acessa rede, Supabase, IA ou FIPE reais.
 */
import type { AuditEvent } from '../../src/lib/audit.js';
import { FakeSupabase } from './fake-supabase.js';

/** Banco de dados (substitui adminClient/publicClient). */
export const fakeDb = new FakeSupabase();

/** Eventos gravados no audit_log (substitui logAudit). */
export const auditEvents: AuditEvent[] = [];

type ChatResult = { output: string; provider: string; model: string };

/** Provedor de IA (substitui aiAvailable/chat de lib/ai.ts). */
export const fakeAi = {
  available: false,
  chat: async (..._args: unknown[]): Promise<ChatResult> => {
    throw new Error('IA desabilitada nos testes');
  },
};

/** Tabela FIPE (substitui fipe.findVehicle/fipe.preco). */
export const fakeFipe = {
  findVehicle: async (..._args: unknown[]): Promise<any> => null,
  preco: async (..._args: unknown[]): Promise<any> => {
    throw new Error('FIPE indisponível nos testes');
  },
};

type HttpHandler = (url: string, init?: RequestInit) => Promise<Response>;

/** Rede HTTP (substitui fetch global). Por padrão, bloqueia qualquer chamada. */
export const fakeHttp: { handler: HttpHandler } = {
  handler: async (url) => {
    throw new Error(`rede bloqueada nos testes: ${url}`);
  },
};

export function resetFakes(): void {
  fakeDb.reset();
  auditEvents.length = 0;
  fakeAi.available = false;
  fakeAi.chat = async () => { throw new Error('IA desabilitada nos testes'); };
  fakeFipe.findVehicle = async () => null;
  fakeFipe.preco = async () => { throw new Error('FIPE indisponível nos testes'); };
  fakeHttp.handler = async (url) => { throw new Error(`rede bloqueada nos testes: ${url}`); };
}

type AuthUserFixture = { id: string; email: string; password: string };

/**
 * Simula o Supabase Auth via `fetch`:
 *   POST /auth/v1/token?grant_type=password → 200 com o usuário ou 400 (credencial errada)
 *   GET  /auth/v1/user                      → 200 se o token legado for conhecido, senão 401
 */
export function mockSupabaseAuth(options: {
  users?: AuthUserFixture[];
  legacyTokens?: Record<string, { id: string; email: string }>;
  down?: boolean;
}): void {
  fakeHttp.handler = async (url, init) => {
    if (options.down) throw new Error('ECONNREFUSED');

    if (url.includes('/auth/v1/token')) {
      const { email, password } = JSON.parse(String(init?.body ?? '{}'));
      const user = options.users?.find((u) => u.email === email && u.password === password);
      return user
        ? Response.json({ access_token: 'supabase-session', user: { id: user.id, email: user.email } })
        : Response.json({ error: 'invalid_grant' }, { status: 400 });
    }

    if (url.includes('/auth/v1/user')) {
      const auth = new Headers(init?.headers).get('authorization') ?? '';
      const user = options.legacyTokens?.[auth.replace('Bearer ', '')];
      return user ? Response.json(user) : Response.json({ message: 'invalid JWT' }, { status: 401 });
    }

    throw new Error(`rede bloqueada nos testes: ${url}`);
  };
}
