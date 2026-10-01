/**
 * Autorização — rotas públicas × protegidas, matriz de perfis e escopo de concessionária.
 * Roda contra o PostgreSQL de teste; os tokens vêm de POST /auth/login.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  insertAcao, insertClient, insertVehicle, rows, useTestDatabase,
} from './helpers/db.js';
import { authAs, createTestApp, DEALERSHIP_A, DEALERSHIP_B, uuid, type TestApp } from './helpers/test-app.js';

let app: TestApp;
useTestDatabase();
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

  beforeEach(async () => {
    await insertVehicle({ id: vehicleId, marca: 'Ford', modelo: 'Ranger', versao: 'XLS', ano: 2025 });
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
  ] as const)('%s %s (corpo: %j) como %s → %i', async (method, url, payload, role, expected) => {
    const res = await app.inject({ method, url, payload, headers: await authAs(role) });
    expect(res.statusCode).toBe(expected);
    if (expected === 403) expect(res.json().code).toBe('forbidden');
  });
});

describe('Escopo de concessionária', () => {
  const clientA = uuid(21);
  const clientB = uuid(22);

  beforeEach(async () => {
    await insertClient({ id: clientA, dealership_id: DEALERSHIP_A, nome_cliente: 'Cliente da loja A', notas: null });
    await insertClient({ id: clientB, dealership_id: DEALERSHIP_B, nome_cliente: 'Cliente da loja B', notas: null });
  });

  it('analista lista apenas os clientes da própria concessionária', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients', headers: await authAs('analista') });

    expect(res.statusCode).toBe(200);
    expect(res.json().results.map((c: { id: string }) => c.id)).toEqual([clientA]);
    expect(res.json().total).toBe(1);
  });

  it('gestor lista os clientes da rede inteira', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients', headers: await authAs('gestor') });
    expect(res.json().results.map((c: { id: string }) => c.id).sort()).toEqual([clientA, clientB].sort());
    expect(res.json().total).toBe(2);
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
    { role: 'analista', alvo: 'loja B', clientId: clientB, expected: 404 }, // não enxerga
    { role: 'gestor', alvo: 'loja B', clientId: clientB, expected: 403 },   // enxerga, mas não altera
    { role: 'gestor', alvo: 'loja A', clientId: clientA, expected: 200 },   // própria loja
    { role: 'admin', alvo: 'loja B', clientId: clientB, expected: 200 },    // altera a rede toda
  ] as const)('PATCH notas: $role da loja A em cliente da $alvo → $expected', async ({ role, clientId, expected }) => {
    const res = await app.inject({
      method: 'PATCH', url: `/clients/${clientId}/notas`,
      payload: { notas: 'ligou pedindo revisão' }, headers: await authAs(role, DEALERSHIP_A),
    });
    expect(res.statusCode).toBe(expected);
    const stored = (await rows('clients')).find((c) => c.id === clientId)!;
    expect(stored.notas).toBe(expected === 200 ? 'ligou pedindo revisão' : null);
  });

  it('analista sem concessionária vinculada recebe 403 no_dealership', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients', headers: await authAs('analista', null) });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('no_dealership');
  });
});

describe('Escopo do analista em ações, métricas e e-mail', () => {
  const clientA = uuid(31);
  const clientB = uuid(32);
  const acaoA = uuid(33);
  const acaoB = uuid(34);

  beforeEach(async () => {
    await insertClient({
      id: clientA, dealership_id: DEALERSHIP_A, model_name: 'RANGER', perfil_real: 'fiel',
      sales_date: '2024-01-10', warranty_start_date: '2024-01-10', email_cliente: 'a@cliente.test',
    });
    await insertClient({
      id: clientB, dealership_id: DEALERSHIP_B, model_name: 'RANGER', perfil_real: 'abandono',
      sales_date: '2024-02-10', warranty_start_date: '2024-02-10', email_cliente: 'b@cliente.test',
    });
    await insertClient({ dealership_id: DEALERSHIP_B, model_name: 'KA', perfil_real: 'abandono', sales_date: '2024-03-10' });
    await insertAcao({ id: acaoA, client_id: clientA, dealership_id: DEALERSHIP_A, status: 'planejada' });
    await insertAcao({ id: acaoB, client_id: clientB, dealership_id: DEALERSHIP_B, status: 'planejada' });
  });

  const ids = (res: { json(): any }) => res.json().results.map((r: { id: string }) => r.id);

  it('GET /acoes — analista vê só as ações da própria loja; gestor vê a rede', async () => {
    const analista = await app.inject({ method: 'GET', url: '/acoes', headers: await authAs('analista') });
    expect(analista.statusCode).toBe(200);
    expect(ids(analista)).toEqual([acaoA]);
    expect(analista.json().total).toBe(1);

    const gestor = await app.inject({ method: 'GET', url: '/acoes', headers: await authAs('gestor') });
    expect(ids(gestor).sort()).toEqual([acaoA, acaoB].sort());
    expect(gestor.json().total).toBe(2);
  });

  it('GET /acoes?client_id — analista não alcança as ações de cliente de outra loja', async () => {
    const res = await app.inject({ method: 'GET', url: `/acoes?client_id=${clientB}`, headers: await authAs('analista') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 0, results: [] });
  });

  it('PATCH /acoes/:id — gestor enxerga a ação de outra loja mas não altera (403)', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/acoes/${acaoB}`, headers: await authAs('gestor'), payload: { status: 'cancelada' },
    });
    expect(res.statusCode).toBe(403);
    expect((await rows('acoes_retencao')).find((a) => a.id === acaoB)!.status).toBe('planejada');
  });

  it('GET /metrics/dealership — analista conta só a própria loja; gestor, a rede', async () => {
    const analista = await app.inject({ method: 'GET', url: '/metrics/dealership', headers: await authAs('analista') });
    expect(analista.statusCode).toBe(200);
    expect(analista.json()).toMatchObject({ escopo: DEALERSHIP_A, total_clientes: 1, perfil_counts: { fiel: 1, abandono: 0 } });

    const gestor = await app.inject({ method: 'GET', url: '/metrics/dealership', headers: await authAs('gestor') });
    expect(gestor.json()).toMatchObject({ escopo: 'rede', total_clientes: 3, perfil_counts: { fiel: 1, abandono: 2 } });
  });

  it('GET /metrics/proximas-revisoes e /metrics/garantia-status — analista não vê clientes de outra loja', async () => {
    const revisoes = await app.inject({ method: 'GET', url: '/metrics/proximas-revisoes?dentro_de_dias=365', headers: await authAs('analista') });
    expect(revisoes.statusCode).toBe(200);
    expect(ids(revisoes)).toEqual([clientA]);

    const garantia = await app.inject({ method: 'GET', url: '/metrics/garantia-status', headers: await authAs('analista') });
    expect(garantia.statusCode).toBe(200);
    expect(garantia.json().total).toBe(1);
    expect(ids(garantia)).not.toContain(clientB);
  });

  it('POST /acoes/email-send — analista recebe 404 para cliente de outra loja; gestor, 403', async () => {
    const analista = await app.inject({
      method: 'POST', url: '/acoes/email-send', headers: await authAs('analista'), payload: { client_id: clientB },
    });
    expect(analista.statusCode).toBe(404);

    const gestor = await app.inject({
      method: 'POST', url: '/acoes/email-send', headers: await authAs('gestor'), payload: { client_id: clientB },
    });
    expect(gestor.statusCode).toBe(403);
    expect(await rows('acoes_retencao')).toHaveLength(2); // nenhuma ação nova foi criada
  });

  it('POST /clients/:id/reclassify — analista recebe 404 para cliente de outra loja', async () => {
    const res = await app.inject({
      method: 'POST', url: `/clients/${clientB}/reclassify`, headers: await authAs('analista'), payload: {},
    });
    expect(res.statusCode).toBe(404);
  });
});
