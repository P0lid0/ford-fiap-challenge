/**
 * Padronização de erros — toda falha sai como Problem Details (RFC 7807).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comTabelaIndisponivel, useTestDatabase } from './helpers/db.js';
import { authAs, createTestApp, uuid, type TestApp } from './helpers/test-app.js';

let app: TestApp;
useTestDatabase();
beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });

const PROBLEM_FIELDS = ['type', 'title', 'status', 'detail', 'instance', 'code', 'timestamp', 'error', 'message'];

function expectProblem(res: Awaited<ReturnType<TestApp['inject']>>, status: number, code: string) {
  expect(res.statusCode).toBe(status);
  expect(res.headers['content-type']).toContain('application/problem+json');
  const body = res.json();
  for (const field of PROBLEM_FIELDS) expect(body).toHaveProperty(field);
  expect(body).toMatchObject({ type: 'about:blank', status, code, error: code });
  expect(body.message).toBe(body.detail); // compatibilidade com web/mobile
  return body;
}

describe('Formato Problem Details', () => {
  it('400 — validação lista cada campo inválido', async () => {
    const res = await app.inject({
      method: 'POST', url: '/clients', headers: await authAs('analista'),
      payload: { model_name: 'FUSCA', model_year: 1970, sales_date: '10/01/2024' },
    });
    const body = expectProblem(res, 400, 'validation_error');

    expect(body.title).toBe('Bad Request');
    expect(body.errors.map((e: { field: string }) => e.field).sort())
      .toEqual(['body.model_name', 'body.model_year', 'body.sales_date']);
  });

  it('400 — JSON malformado', async () => {
    const res = await app.inject({
      method: 'POST', url: '/auth/login', payload: '{"email": ',
      headers: { 'content-type': 'application/json' },
    });
    expectProblem(res, 400, 'bad_request');
  });

  it('401 — traz WWW-Authenticate', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients' });
    expectProblem(res, 401, 'unauthorized');
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('403 — perfil sem permissão', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/ai-keys', headers: await authAs('analista') });
    const body = expectProblem(res, 403, 'forbidden');
    expect(body.detail).toContain('analista');
  });

  it('404 — recurso inexistente', async () => {
    const res = await app.inject({ method: 'GET', url: `/clients/${uuid(99)}`, headers: await authAs('gestor') });
    const body = expectProblem(res, 404, 'not_found');
    expect(body.instance).toBe(`/clients/${uuid(99)}`);
  });

  it('404 — rota inexistente', async () => {
    const res = await app.inject({ method: 'GET', url: '/rota/que/nao/existe' });
    expectProblem(res, 404, 'route_not_found');
  });

  it('instance não ecoa a query string (evita vazar parâmetros)', async () => {
    const res = await app.inject({ method: 'GET', url: '/rota/inexistente?token=segredo' });
    expect(res.json().instance).toBe('/rota/inexistente');
    expect(res.body).not.toContain('segredo');
  });

  it('500 — falha do banco não vaza mensagem, código nem hint do Postgres', async () => {
    // Falha REAL do Postgres: a tabela some por instantes e a query estoura com 42P01
    // ("relation public.clients does not exist"). O token é obtido antes da quebra.
    const headers = await authAs('gestor');
    const res = await comTabelaIndisponivel('clients', () => app.inject({ method: 'GET', url: '/clients', headers }));
    const body = expectProblem(res, 500, 'internal_error');

    expect(body.detail).toBe('erro interno do servidor');
    expect(res.body).not.toMatch(/relation|42P01|does not exist|public\./);
  });
});
