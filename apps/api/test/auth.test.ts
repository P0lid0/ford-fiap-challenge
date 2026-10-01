/**
 * Autenticação — POST /auth/login (identidade local em public.profiles, bcrypt)
 * e uso do token nas rotas protegidas. Roda contra o PostgreSQL de teste.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { env } from '../src/config.js';
import {
  auditRows, comTabelaIndisponivel, DEALERSHIP_A, insertUser, TEST_PASSWORD, useTestDatabase,
} from './helpers/db.js';
import { createTestApp, nextClientIp, type TestApp } from './helpers/test-app.js';

// Usuários do cenário (gravados de verdade em public.profiles a cada teste).
const GESTOR = { id: '22222222-2222-4222-8222-000000000001', email: 'gestor@faroai.test', password: TEST_PASSWORD };
const NOVO = { id: '22222222-2222-4222-8222-000000000002', email: 'novo@faroai.test', password: TEST_PASSWORD };
const SEM_SENHA = { id: '22222222-2222-4222-8222-000000000003', email: 'semsenha@faroai.test' };

let app: TestApp;

/** Cada login sai de um IP diferente, para o limite de 10/min do login não interferir. */
function login(body: unknown) {
  return app.inject({ method: 'POST', url: '/auth/login', payload: body as object, remoteAddress: nextClientIp() });
}

useTestDatabase();
beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });

beforeEach(async () => {
  await insertUser({ id: GESTOR.id, email: GESTOR.email, role: 'gestor', dealership_id: DEALERSHIP_A });
  // Só e-mail e senha: perfil e concessionária ficam nos valores padrão do cadastro.
  await insertUser({ id: NOVO.id, email: NOVO.email });
  // Cadastro sem senha definida (password_hash nulo): não consegue entrar.
  await insertUser({ id: SEM_SENHA.id, email: SEM_SENHA.email, role: 'admin', password_hash: null });
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
    const { access_token } = (await login({ email: NOVO.email, password: NOVO.password })).json();
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${access_token}` } });
    expect(me.json()).toMatchObject({ role: 'analista', dealership_id: null });
  });

  it('registra o login no audit_log', async () => {
    await login({ email: GESTOR.email, password: GESTOR.password });
    expect(await auditRows('auth.login')).toEqual([
      expect.objectContaining({ action: 'auth.login', actor_id: GESTOR.id, entity_id: GESTOR.id }),
    ]);
  });

  it('401 — senha errada, com mensagem genérica e WWW-Authenticate', async () => {
    const res = await login({ email: GESTOR.email, password: 'errada' });

    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.json()).toMatchObject({ code: 'invalid_credentials', detail: 'e-mail ou senha inválidos' });
    expect(await auditRows('auth.login_failed')).toHaveLength(1);
  });

  it('401 — e-mail inexistente recebe a MESMA resposta (não revela quem existe)', async () => {
    const wrongPassword = (await login({ email: GESTOR.email, password: 'errada' })).json();
    const unknownUser = (await login({ email: 'ninguem@faroai.test', password: 'qualquer' })).json();
    expect(unknownUser.detail).toBe(wrongPassword.detail);
    expect(unknownUser.code).toBe(wrongPassword.code);
  });

  it('401 — e-mail inexistente leva tempo semelhante ao de senha errada (sem vazar por timing)', async () => {
    const elapsed = async (email: string) => {
      const start = performance.now();
      const res = await login({ email, password: 'senha-errada-1' });
      expect(res.statusCode).toBe(401);
      return performance.now() - start;
    };
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

    await elapsed(GESTOR.email); // aquecimento (JIT, conexões do pool)
    const existing: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 3; i++) {
      existing.push(await elapsed(GESTOR.email));
      unknown.push(await elapsed(`fantasma${i}@faroai.test`));
    }

    // Ambos pagam um bcrypt.compare de custo 12 (o do e-mail inexistente é contra um hash fixo).
    expect(median(existing)).toBeGreaterThan(50);
    expect(median(unknown)).toBeGreaterThan(50);
    expect(median(unknown) / median(existing)).toBeGreaterThan(0.5);
    expect(median(unknown) / median(existing)).toBeLessThan(2);
  });

  it('401 — usuário sem password_hash não entra, com a mesma resposta genérica', async () => {
    const res = await login({ email: SEM_SENHA.email, password: TEST_PASSWORD });
    const wrongPassword = (await login({ email: GESTOR.email, password: 'errada' })).json();

    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.json()).toMatchObject({ code: wrongPassword.code, detail: wrongPassword.detail });
    expect(await auditRows('auth.login')).toHaveLength(0);
  });

  it('401 — senha vazia ou só de espaços não substitui a senha cadastrada', async () => {
    const res = await login({ email: GESTOR.email, password: '   ' });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_credentials');
  });

  it('400 — corpo inválido lista os campos com problema', async () => {
    const res = await login({ email: 'nao-e-email' });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    expect(res.json().errors.map((e: { field: string }) => e.field)).toEqual(['body.email', 'body.password']);
  });

  it('502 — base de identidade fora do ar', async () => {
    const res = await comTabelaIndisponivel('profiles', () => login({ email: GESTOR.email, password: GESTOR.password }));

    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('identity_provider_unavailable');
    expect(res.body).not.toMatch(/relation|42P01|profiles/);
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

  it('401 — token com o perfil adulterado (analista → admin) não é aceito', async () => {
    const { access_token } = (await login({ email: NOVO.email, password: NOVO.password })).json();
    const [header, payload, signature] = access_token.split('.');
    const forged = { ...JSON.parse(Buffer.from(payload, 'base64url').toString()), role: 'admin' };
    const tampered = `${header}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${signature}`;

    const res = await app.inject({ method: 'GET', url: '/admin/ai-keys', headers: { authorization: `Bearer ${tampered}` } });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_token');
  });

  it('401 — esquema diferente de Bearer é ignorado', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Basic dXNlcjpzZW5oYQ==' } });
    expect(res.statusCode).toBe(401);
  });

  it('401 — token de outro emissor (como o de um provedor externo) não é aceito', async () => {
    const foreign = await new SignJWT({ email: GESTOR.email, role: 'admin', dealership_id: null })
      .setProtectedHeader({ alg: 'HS256' }).setSubject(GESTOR.id)
      .setIssuer('https://outro-provedor.test/auth/v1').setAudience(env.JWT_AUDIENCE)
      .setIssuedAt().setExpirationTime('1h')
      .sign(secret);
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${foreign}` } });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_token');
  });

  it('401 — token desconhecido (texto que não é JWT)', async () => {
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer token-desconhecido' } });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_token');
  });
});
