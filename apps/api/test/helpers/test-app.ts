/**
 * Utilidades para subir a API em memória e autenticar de verdade: o token vem de
 * POST /auth/login (e-mail + senha conferidos contra profiles.password_hash).
 */
import type { UserRole } from '../../src/lib/jwt.js';
import { DEALERSHIP_A, DEALERSHIP_B, TEST_PASSWORD, testUser } from './db.js';

export { DEALERSHIP_A, DEALERSHIP_B };

/** UUID v4 determinístico a partir de um número (ids legíveis nos testes). */
export function uuid(n: number): string {
  const hex = n.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

export type TestApp = Awaited<ReturnType<typeof import('../../src/app.js')['buildApp']>>;

let currentApp: TestApp | undefined;

/** Sobe a API completa (plugins, segurança, rotas) sem abrir porta. */
export async function createTestApp(): Promise<TestApp> {
  const { buildApp } = await import('../../src/app.js');
  const app = await buildApp({ logger: false });
  await app.ready();
  currentApp = app;
  return app;
}

let loginCounter = 0;

/** Cada login sai de um IP diferente, para o limite de 10/min do login não interferir. */
export function nextClientIp(): string {
  loginCounter += 1;
  return `10.20.${Math.floor(loginCounter / 250)}.${(loginCounter % 250) + 1}`;
}

const tokenCache = new Map<string, string>();

/**
 * Token REAL do usuário padrão do perfil/concessionária: faz POST /auth/login com a senha de teste.
 * Fica em cache por arquivo (o bcrypt de custo 12 leva centenas de ms); os usuários são
 * recriados com o MESMO id a cada teste, então o token continua válido.
 */
export async function tokenFor(role: UserRole, dealershipId: string | null = DEALERSHIP_A): Promise<string> {
  const user = testUser(role, dealershipId);
  const cached = tokenCache.get(user.id);
  if (cached) return cached;

  if (!currentApp) throw new Error('createTestApp() precisa rodar antes de authAs()/tokenFor()');
  const res = await currentApp.inject({
    method: 'POST', url: '/auth/login', remoteAddress: nextClientIp(),
    payload: { email: user.email, password: TEST_PASSWORD },
  });
  if (res.statusCode !== 200) throw new Error(`login de teste falhou (${user.email}): ${res.statusCode} ${res.body}`);

  const token = res.json().access_token as string;
  tokenCache.set(user.id, token);
  return token;
}

/** Header `Authorization` para o perfil informado. */
export async function authAs(role: UserRole, dealershipId: string | null = DEALERSHIP_A) {
  return { authorization: `Bearer ${await tokenFor(role, dealershipId)}` };
}

/** Id do usuário padrão (o `sub` do token e o `created_by`/`actor_id` gravados no banco). */
export function userIdOf(role: UserRole, dealershipId: string | null = DEALERSHIP_A): string {
  return testUser(role, dealershipId).id;
}
