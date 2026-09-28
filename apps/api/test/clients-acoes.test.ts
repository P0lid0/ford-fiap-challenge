/**
 * Desafio 2 — clientes e ações de retenção (sucesso e erro).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditEvents, fakeDb } from './helpers/fakes.js';
import { authAs, createTestApp, DEALERSHIP_A, DEALERSHIP_B, uuid, type TestApp } from './helpers/test-app.js';

let app: TestApp;
beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });

const NEW_CLIENT = { model_name: 'RANGER', model_year: 2025, sales_date: '2025-03-10', cpf: '12345678901', nome_cliente: 'Maria' };

describe('POST /clients', () => {
  beforeEach(() => fakeDb.seed('clients', []));

  it('201 — cria o cliente na concessionária do usuário', async () => {
    const res = await app.inject({ method: 'POST', url: '/clients', payload: NEW_CLIENT, headers: await authAs('analista') });

    expect(res.statusCode).toBe(201);
    expect(res.json().client).toMatchObject({ model_name: 'RANGER', dealership_id: DEALERSHIP_A, created_by: 'user-analista' });
    expect(auditEvents).toContainEqual(expect.objectContaining({ action: 'client.created' }));
  });

  it('não grava o CPF em texto puro — apenas o hash', async () => {
    await app.inject({ method: 'POST', url: '/clients', payload: NEW_CLIENT, headers: await authAs('analista') });
    const [stored] = fakeDb.rows('clients');

    expect(stored).not.toHaveProperty('cpf');
    expect(stored!.cpf_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(NEW_CLIENT.cpf);
  });

  it('409 — VIN já cadastrado', async () => {
    fakeDb.failNext('clients', 'insert', { code: '23505', message: 'duplicate key value violates unique constraint' });
    const res = await app.inject({
      method: 'POST', url: '/clients', payload: { ...NEW_CLIENT, vin_hash: 'vin-repetido-123' }, headers: await authAs('analista'),
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('vin_already_exists');
    expect(res.body).not.toContain('duplicate key');
  });

  it('403 — usuário sem concessionária não pode cadastrar', async () => {
    const res = await app.inject({ method: 'POST', url: '/clients', payload: NEW_CLIENT, headers: await authAs('gestor', null) });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('no_dealership');
  });
});

describe('GET /clients/:id', () => {
  it('200 — devolve cliente, predições e histórico', async () => {
    const id = uuid(1);
    fakeDb.seed('clients', [{ id, dealership_id: DEALERSHIP_A }]);
    fakeDb.seed('predictions', [{ id: uuid(2), client_id: id, perfil_predito: 'fiel' }]);
    fakeDb.seed('client_history', []);

    const res = await app.inject({ method: 'GET', url: `/clients/${id}`, headers: await authAs('analista') });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ client: { id }, predictions: [{ perfil_predito: 'fiel' }], history: [] });
  });

  it('400 — id que não é UUID', async () => {
    const res = await app.inject({ method: 'GET', url: '/clients/123', headers: await authAs('analista') });
    expect(res.statusCode).toBe(400);
  });
});

describe('Ações de retenção', () => {
  const clientA = uuid(11);
  const clientB = uuid(12);
  const acaoB = uuid(13);

  beforeEach(() => {
    fakeDb.seed('clients', [
      { id: clientA, dealership_id: DEALERSHIP_A, email_cliente: null, predictions: [{ perfil_predito: 'esquecido', risco_evasao: 0.8 }] },
      { id: clientB, dealership_id: DEALERSHIP_B, email_cliente: 'b@cliente.test' },
    ]);
    fakeDb.seed('acoes_retencao', [
      { id: uuid(14), dealership_id: DEALERSHIP_A, status: 'concluida_sucesso', tipo: 'ligacao' },
      { id: acaoB, dealership_id: DEALERSHIP_B, status: 'planejada', tipo: 'email' },
    ]);
  });

  it('POST /acoes 201 — registra a ação na loja do usuário', async () => {
    const res = await app.inject({
      method: 'POST', url: '/acoes', headers: await authAs('analista'),
      payload: { client_id: clientA, tipo: 'ligacao', titulo: 'Lembrete de revisão' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ client_id: clientA, dealership_id: DEALERSHIP_A, actor_id: 'user-analista' });
  });

  it('POST /acoes 404 — cliente inexistente', async () => {
    const res = await app.inject({
      method: 'POST', url: '/acoes', headers: await authAs('analista'),
      payload: { client_id: uuid(999), tipo: 'ligacao', titulo: 'Contato' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('client_not_found');
  });

  it('POST /acoes 403 — gestor não registra ação para cliente de outra loja', async () => {
    const res = await app.inject({
      method: 'POST', url: '/acoes', headers: await authAs('gestor'),
      payload: { client_id: clientB, tipo: 'ligacao', titulo: 'Contato' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('PATCH /acoes/:id 200 — concluir a ação registra completed_at', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/acoes/${acaoB}`, headers: await authAs('admin'),
      payload: { status: 'concluida_sucesso', desfecho: 'agendou revisão' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().completed_at).toBeTypeOf('string');
  });

  it('PATCH /acoes/:id 404 — analista não enxerga ação de outra loja', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/acoes/${acaoB}`, headers: await authAs('analista'), payload: { status: 'cancelada' },
    });
    expect(res.statusCode).toBe(404);
    expect(fakeDb.rows('acoes_retencao').find((a) => a.id === acaoB)!.status).toBe('planejada');
  });

  it('GET /acoes/kpis — analista só contabiliza a própria loja', async () => {
    const res = await app.inject({ method: 'GET', url: '/acoes/kpis', headers: await authAs('analista') });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ total: 1, taxa_conclusao: 1, taxa_sucesso: 1 });
  });

  it('POST /acoes/email-send 422 — cliente sem e-mail cadastrado', async () => {
    const res = await app.inject({
      method: 'POST', url: '/acoes/email-send', headers: await authAs('analista'), payload: { client_id: clientA },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('no_email');
  });

  it('POST /acoes/campanha 201 — gestor cria uma ação para cada cliente do perfil', async () => {
    const res = await app.inject({
      method: 'POST', url: '/acoes/campanha', headers: await authAs('gestor'),
      payload: { perfil: 'esquecido', tipo: 'whatsapp', titulo: 'Volte para a revisão' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ ok: true, created: 1 });
    const created = fakeDb.rows('acoes_retencao').filter((a) => a.campaign_id === res.json().campaign_id);
    expect(created).toEqual([expect.objectContaining({ client_id: clientA, dealership_id: DEALERSHIP_A, status: 'planejada' })]);
  });
});
