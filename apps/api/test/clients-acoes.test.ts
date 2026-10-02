/**
 * Desafio 2 — clientes e ações de retenção (sucesso e erro), contra o PostgreSQL de teste.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  auditRows, insertAcao, insertClient, insertPrediction, rows, sql, useTestDatabase,
} from './helpers/db.js';
import { authAs, createTestApp, DEALERSHIP_A, DEALERSHIP_B, userIdOf, uuid, type TestApp } from './helpers/test-app.js';

let app: TestApp;
useTestDatabase();
beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });

const NEW_CLIENT = { model_name: 'RANGER', model_year: 2025, sales_date: '2025-03-10', cpf: '12345678901', nome_cliente: 'Maria' };

describe('POST /clients', () => {
  it('201 — cria o cliente na concessionária do usuário', async () => {
    const res = await app.inject({ method: 'POST', url: '/clients', payload: NEW_CLIENT, headers: await authAs('analista') });

    expect(res.statusCode).toBe(201);
    expect(res.json().client).toMatchObject({
      model_name: 'RANGER', dealership_id: DEALERSHIP_A, created_by: userIdOf('analista'),
    });
    expect(await auditRows('client.created')).toHaveLength(1);
  });

  it('não grava o CPF em texto puro — apenas o hash', async () => {
    await app.inject({ method: 'POST', url: '/clients', payload: NEW_CLIENT, headers: await authAs('analista') });
    const [stored] = await rows('clients');

    expect(stored).not.toHaveProperty('cpf');
    expect(stored!.cpf_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(NEW_CLIENT.cpf);
  });

  it('409 — VIN já cadastrado', async () => {
    // Violação REAL de unicidade: o mesmo vin_hash já existe no banco.
    await insertClient({ vin_hash: 'vin-repetido-123' });
    const res = await app.inject({
      method: 'POST', url: '/clients', payload: { ...NEW_CLIENT, vin_hash: 'vin-repetido-123' }, headers: await authAs('analista'),
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('vin_already_exists');
    expect(res.body).not.toContain('duplicate key');
    expect(await rows('clients')).toHaveLength(1); // nada foi gravado
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
    await insertClient({ id, dealership_id: DEALERSHIP_A });
    await insertPrediction(id, { id: uuid(2), perfil_predito: 'fiel' });

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

  beforeEach(async () => {
    await insertClient({ id: clientA, dealership_id: DEALERSHIP_A, email_cliente: null });
    await insertPrediction(clientA, { perfil_predito: 'esquecido', risco_evasao: 0.8 });
    await insertClient({ id: clientB, dealership_id: DEALERSHIP_B, email_cliente: 'b@cliente.test' });
    await insertAcao({ id: uuid(14), client_id: clientA, dealership_id: DEALERSHIP_A, status: 'concluida_sucesso', tipo: 'ligacao' });
    await insertAcao({ id: acaoB, client_id: clientB, dealership_id: DEALERSHIP_B, status: 'planejada', tipo: 'email' });
  });

  it('POST /acoes 201 — registra a ação na loja do usuário', async () => {
    const res = await app.inject({
      method: 'POST', url: '/acoes', headers: await authAs('analista'),
      payload: { client_id: clientA, tipo: 'ligacao', titulo: 'Lembrete de revisão' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ client_id: clientA, dealership_id: DEALERSHIP_A, actor_id: userIdOf('analista') });
    expect(await auditRows('acao.created')).toHaveLength(1);
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
    const stored = (await rows('acoes_retencao')).find((a) => a.id === acaoB)!;
    expect(stored).toMatchObject({ status: 'concluida_sucesso', desfecho: 'agendou revisão' });
    expect(stored.completed_at).toBeInstanceOf(Date);
  });

  it('PATCH /acoes/:id 404 — analista não enxerga ação de outra loja', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/acoes/${acaoB}`, headers: await authAs('analista'), payload: { status: 'cancelada' },
    });
    expect(res.statusCode).toBe(404);
    expect((await rows('acoes_retencao')).find((a) => a.id === acaoB)!.status).toBe('planejada');
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
    const created = (await rows('acoes_retencao')).filter((a) => a.campaign_id === res.json().campaign_id);
    expect(created).toEqual([expect.objectContaining({ client_id: clientA, dealership_id: DEALERSHIP_A, status: 'planejada' })]);
    // risco_no_disparo vem da predição mais recente do cliente (numeric → número no JSON do banco)
    expect(Number(created[0]!.risco_no_disparo)).toBeCloseTo(0.8);
    expect(await sql`select count(*)::int as n from public.acoes_retencao`).toEqual([{ n: 3 }]);
  });
});
