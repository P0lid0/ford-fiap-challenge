/**
 * Utilidades para subir a API em memória e montar requisições autenticadas.
 */
import type { UserRole } from '../../src/lib/jwt.js';

export const DEALERSHIP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const DEALERSHIP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** UUID v4 determinístico a partir de um número (ids legíveis nos testes). */
export function uuid(n: number): string {
  const hex = n.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

export type TestApp = Awaited<ReturnType<typeof import('../../src/app.js')['buildApp']>>;

/** Sobe a API completa (plugins, segurança, rotas) sem abrir porta. */
export async function createTestApp(): Promise<TestApp> {
  const { buildApp } = await import('../../src/app.js');
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

/** JWT válido da própria API para o perfil informado. */
export async function tokenFor(role: UserRole, dealershipId: string | null = DEALERSHIP_A): Promise<string> {
  const { signAccessToken } = await import('../../src/lib/jwt.js');
  const { accessToken } = await signAccessToken({
    id: `user-${role}`,
    email: `${role}@faroai.test`,
    role,
    dealershipId,
  });
  return accessToken;
}

/** Header `Authorization` para o perfil informado. */
export async function authAs(role: UserRole, dealershipId: string | null = DEALERSHIP_A) {
  return { authorization: `Bearer ${await tokenFor(role, dealershipId)}` };
}
