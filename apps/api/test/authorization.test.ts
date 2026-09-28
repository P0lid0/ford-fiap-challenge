/**
 * Autorização — rotas públicas × protegidas, matriz de perfis e escopo de concessionária.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fakeDb } from './helpers/fakes.js';
import { authAs, createTestApp, DEALERSHIP_A, DEALERSHIP_B, uuid, type TestApp } from './helpers/test-app.js';

let app: TestApp;
beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });

type Operation = { method: string; url: string; isPublic: boolean };

/** Todas as operações documentadas no OpenAPI, com parâmetros de path preenchidos. */
async function allOperations(): Promise<Operation[]> {
  const doc = (await app.inject({ method: 'GET', url: '/docs/json' })).json();
  return Object.entries<any>(doc.paths).flatMap(([path, item]) =>
    Object.entries<any>(item).map(([method, op]) => ({
      method: method.toUpperCase(),
      url: path.replace(/\{[^}]+\}/g, uuid(1)),
      isPublic: Array.isArray(op.security) && op.security.length === 0,
    })));
}

describe('Rotas públicas × protegidas', () => {
  it('apenas /health e /auth/login são públicas', async () => {
    const publicRoutes = (await allOperations()).filter((o) => o.isPublic).map((o) => `${o.method} ${o.url}`);
    expect(publicRoutes.sort()).toEqual(['GET /health', 'POST /auth/login']);
  });

  it('/health e a documentação abrem sem token', async () => {
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/docs/json' })).statusCode).toBe(200);
  });

  it('TODA rota protegida responde 401 sem token (segura por padrão)', async () => {
    const protectedOps = (await allOperations()).filter((o) => !o.isPublic);
    expect(protectedOps.length).toBeGreaterThan(40);

    const unexpected: string[] = [];
    for (const op of protectedOps) {
      const res = await app.inject({ method: op.method as any, url: op.url, payload: {} });
      if (res.statusCode !== 401) unexpected.push(`${op.method} ${op.url} → ${res.statusCode}`);
    }
    expect(unexpected).toEqual([]);
  });

  it('401 acontece ANTES da validação do corpo (payload não é processado)', async () => {
    const res = await app.inject({ method: 'POST', url: '/clients', payload: { lixo: true } });
    expect(res.statusCode).toBe(401);
  });
});

describe('Matriz de perfis', () => {
  const vehicleId = uuid(10);

  beforeEach(() => {
    fakeDb.seed('vehicles', [{ id: vehicleId, marca: 'Ford', modelo: 'Ranger' }]);
    fakeDb.seed('ai_keys', []);
    fakeDb.seed('clients', []);
  });

  it.each([
    // [método, rota, corpo, perfil, status esperado]
    ['GET', '/admin/ai-keys', undefined, 'analista', 403],
    ['GET', '/admin/ai-keys', undefined, 'gestor', 403],
    ['GET', '/admin/ai-keys', undefined, 'admin', 200],
    ['DELETE', `/competitive/vehicles/${vehicleId}`, undefined, 'analista', 403],
    ['DELETE', `/competitive/vehicles/${vehicleId}`, undefined, 'gestor', 200],
    ['POST', '/acoes/campanha', { perfil: 'fiel', tipo: 'email', titulo: 'Campanha' }, 'analista', 403],
    ['POST', '/acoes/campanha', { perfil: 'fiel', tipo: 'email', titulo: 'Campanha' }, 'gestor', 200],
    ['GET', '/competitive/vehicles', undefined, 'analista', 200],
    ['GET', '/admin/ai-function-models', undefined, 'analista', 200],
    ['GET', '/clients/leads', undefined, 'analista', 403],
    ['GET', '/clients/leads/stats', undefined, 'analista', 403],
    ['GET', '/metrics/anomalias-dealer', undefined, 'analista', 403],
  ] as const)('%s %s como %s → %i', async (method, url, payload, role, expected) => {
    const res = await app.inject({ method, url, payload, headers: await authAs(role) });
    expect(res.statusCode).toBe(expected);
    if (expected === 403) expect(res.json().code).toBe('forbidden');
  });
});

describe('Escopo de concessionária', () => {
  const clientA = uuid(21);
  const clientB = uuid(22);

  beforeEach(() => {
    fakeDb.seed('clients', [
      { id: clientA, dealership_id: DEALERSHIP_A, nome_cliente: 'Cliente da loja A', notas: null },
      { id: clientB, dealership_id: DEALERSHIP_B, nome_cliente: 'Cliente da loja B', notas: null },
    ]);
  });

  it('analista lista apenas os clientes da própria concessionária', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients', headers: await authAs('analista') });

    expect(res.statusCode).toBe(200);
    expect(res.json().results.map((c: { id: string }) => c.id)).toEqual([clientA]);
  });

  it('gestor lista os clientes da rede inteira', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients', headers: await authAs('gestor') });
    expect(res.json().results.map((c: { id: string }) => c.id).sort()).toEqual([clientA, clientB].sort());
  });

  it('analista recebe 404 ao abrir cliente de outra loja (não revela que existe)', async () => {
    const res = await app.inject({ method: 'GET', url: `/clients/${clientB}`, headers: await authAs('analista') });
    expect(res.statusCode).toBe(404);
  });

  it('gestor abre cliente de outra loja', async () => {
    const res = await app.inject({ method: 'GET', url: `/clients/${clientB}`, headers: await authAs('gestor') });
    expect(res.statusCode).toBe(200);
  });

  it.each([
    ['analista', DEALERSHIP_A, clientB, 404], // não enxerga
    ['gestor', DEALERSHIP_A, clientB, 403],   // enxerga, mas não altera
    ['gestor', DEALERSHIP_A, clientA, 200],   // própria loja
    ['admin', DEALERSHIP_A, clientB, 200],    // altera a rede toda
  ] as const)('PATCH notas: %s da loja A em cliente %s → %i', async (role, dealership, clientId, expected) => {
    const res = await app.inject({
      method: 'PATCH', url: `/clients/${clientId}/notas`,
      payload: { notas: 'ligou pedindo revisão' }, headers: await authAs(role, dealership),
    });
    expect(res.statusCode).toBe(expected);
    const stored = fakeDb.rows('clients').find((c) => c.id === clientId)!;
    expect(stored.notas).toBe(expected === 200 ? 'ligou pedindo revisão' : null);
  });

  it('analista sem concessionária vinculada recebe 403 no_dealership', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients', headers: await authAs('analista', null) });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('no_dealership');
  });
});
