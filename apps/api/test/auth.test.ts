/**
 * Autenticação — POST /auth/login e uso do token nas rotas protegidas.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { env } from '../src/config.js';
import { auditEvents, fakeDb, mockSupabaseAuth } from './helpers/fakes.js';
import { createTestApp, DEALERSHIP_A, type TestApp } from './helpers/test-app.js';

const GESTOR = { id: 'user-gestor', email: 'gestor@faroai.test', password: 'Senha#123' };
const SEM_PERFIL = { id: 'user-sem-perfil', email: 'novo@faroai.test', password: 'Senha#123' };

let app: TestApp;
let clientIp = 0;

/** Cada login sai de um IP diferente, para o limite de 10/min do login não interferir. */
function login(body: unknown) {
  clientIp += 1;
  return app.inject({ method: 'POST', url: '/auth/login', payload: body as object, remoteAddress: `10.0.0.${clientIp}` });
}

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });

beforeEach(() => {
  mockSupabaseAuth({
    users: [GESTOR, SEM_PERFIL],
    legacyTokens: { 'token-legado-supabase': { id: GESTOR.id, email: GESTOR.email } },
  });
  fakeDb.seed('profiles', [{ id: GESTOR.id, role: 'gestor', dealership_id: DEALERSHIP_A }]);
});

describe('POST /auth/login', () => {
  it('200 — devolve JWT Bearer com validade', async () => {
    const res = await login({ email: GESTOR.email, password: GESTOR.password });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ token_type: 'Bearer', expires_in: env.JWT_EXPIRES_IN_SECONDS });
    expect(res.json().access_token.split('.')).toHaveLength(3);
  });

  it('o token emitido dá acesso a /me com o perfil e a concessionária do usuário', async () => {
    const { access_token } = (await login({ email: GESTOR.email, password: GESTOR.password })).json();
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${access_token}` } });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual({ id: GESTOR.id, email: GESTOR.email, role: 'gestor', dealership_id: DEALERSHIP_A });
  });

  it('normaliza o e-mail (maiúsculas e espaços)', async () => {
    const res = await login({ email: '  GESTOR@FaroAI.test ', password: GESTOR.password });
    expect(res.statusCode).toBe(200);
  });

  it('usuário sem perfil cadastrado recebe o menor privilégio (analista)', async () => {
    const { access_token } = (await login({ email: SEM_PERFIL.email, password: SEM_PERFIL.password })).json();
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${access_token}` } });
    expect(me.json()).toMatchObject({ role: 'analista', dealership_id: null });
  });

  it('registra o login no audit_log', async () => {
    await login({ email: GESTOR.email, password: GESTOR.password });
    expect(auditEvents).toContainEqual(expect.objectContaining({ action: 'auth.login', actor_id: GESTOR.id }));
  });

  it('401 — senha errada, com mensagem genérica e WWW-Authenticate', async () => {
    const res = await login({ email: GESTOR.email, password: 'errada' });

    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.json()).toMatchObject({ code: 'invalid_credentials', detail: 'e-mail ou senha inválidos' });
    expect(auditEvents).toContainEqual(expect.objectContaining({ action: 'auth.login_failed' }));
  });

  it('401 — e-mail inexistente recebe a MESMA resposta (não revela quem existe)', async () => {
    const wrongPassword = (await login({ email: GESTOR.email, password: 'errada' })).json();
    const unknownUser = (await login({ email: 'ninguem@faroai.test', password: 'qualquer' })).json();
    expect(unknownUser.detail).toBe(wrongPassword.detail);
    expect(unknownUser.code).toBe(wrongPassword.code);
  });

  it('400 — corpo inválido lista os campos com problema', async () => {
    const res = await login({ email: 'nao-e-email' });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    expect(res.json().errors.map((e: { field: string }) => e.field)).toEqual(['body.email', 'body.password']);
  });

  it('502 — Supabase Auth fora do ar', async () => {
    mockSupabaseAuth({ down: true });
    const res = await login({ email: GESTOR.email, password: GESTOR.password });

    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('identity_provider_unavailable');
  });

  it('429 — bloqueia força bruta após 10 tentativas por minuto do mesmo IP', async () => {
    const attempt = () => app.inject({
      method: 'POST', url: '/auth/login', remoteAddress: '192.168.99.99',
      payload: { email: GESTOR.email, password: 'errada' },
    });
    for (let i = 0; i < 10; i++) expect((await attempt()).statusCode).toBe(401);

    const blocked = await attempt();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.json().code).toBe('rate_limited');
  });
});

describe('Uso do token nas rotas protegidas', () => {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const now = () => Math.floor(Date.now() / 1000);

  it('401 — requisição sem token', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });

    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.json().code).toBe('unauthorized');
  });

  it('401 — token expirado, com código específico', async () => {
    const expired = await new SignJWT({ email: GESTOR.email, role: 'gestor', dealership_id: DEALERSHIP_A })
      .setProtectedHeader({ alg: 'HS256' }).setSubject(GESTOR.id)
      .setIssuer(env.JWT_ISSUER).setAudience(env.JWT_AUDIENCE)
      .setIssuedAt(now() - 7200).setExpirationTime(now() - 60)
      .sign(secret);
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${expired}` } });

    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
    expect(res.json()).toMatchObject({ code: 'token_expired', detail: 'token expirado' });
  });

  it('401 — token com assinatura inválida', async () => {
    const { access_token } = (await login({ email: GESTOR.email, password: GESTOR.password })).json();
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${access_token}x` } });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_token');
  });

  it('401 — esquema diferente de Bearer é ignorado', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Basic dXNlcjpzZW5oYQ==' } });
    expect(res.statusCode).toBe(401);
  });

  it('200 — token legado do Supabase (web/mobile) continua aceito', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer token-legado-supabase' } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: GESTOR.id, role: 'gestor' });
  });

  it('401 — token legado rejeitado pelo Supabase', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer token-desconhecido' } });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_token');
  });
});
