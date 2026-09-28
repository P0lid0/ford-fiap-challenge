/**
 * Desafio 1 — catálogo competitivo de veículos (sucesso e erro).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fakeDb, fakeFipe } from './helpers/fakes.js';
import { authAs, createTestApp, uuid, type TestApp } from './helpers/test-app.js';

let app: TestApp;
beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); });

const RANGER = {
  id: uuid(1), marca: 'Ford', modelo: 'Ranger', versao: 'XLS', ano: 2025, categoria: 'picape',
  motor: { potencia_cv: 170, torque_nm: 405 }, dimensoes: {}, transmissao: {}, desempenho: {},
  equipamentos: [], preco_brl: 250000, pais_origem: 'AR',
};
const HILUX = {
  ...RANGER, id: uuid(2), marca: 'Toyota', modelo: 'Hilux', versao: 'SRV',
  motor: { potencia_cv: 204, torque_nm: 500 }, preco_brl: 280000, pais_origem: 'AR',
};

beforeEach(() => fakeDb.seed('vehicles', [RANGER, HILUX]));

describe('Consulta e comparação', () => {
  it('GET /competitive/vehicles 200 — lista o catálogo', async () => {
    const res = await app.inject({ method: 'GET', url: '/competitive/vehicles', headers: await authAs('analista') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });

  it('GET /competitive/lookup 200 — devolve só os campos pedidos (null explícito se ausente)', async () => {
    const res = await app.inject({
      method: 'GET', headers: await authAs('analista'),
      url: '/competitive/lookup?marca=ford&modelo=ranger&fields=motor.potencia_cv,desempenho.aceleracao_0_100_s,preco_brl',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{
      id: RANGER.id, marca: 'Ford', modelo: 'Ranger', versao: 'XLS', ano: 2025,
      motor: { potencia_cv: 170 }, desempenho: { aceleracao_0_100_s: null }, preco_brl: 250000,
    }]);
  });

  it('GET /competitive/lookup 404 — nenhum veículo combina', async () => {
    const res = await app.inject({ method: 'GET', url: '/competitive/lookup?marca=Fiat&modelo=Toro', headers: await authAs('analista') });
    expect(res.statusCode).toBe(404);
  });

  it('POST /competitive/compare 200 — indica o vencedor de cada critério', async () => {
    const res = await app.inject({
      method: 'POST', url: '/competitive/compare', headers: await authAs('analista'),
      payload: { vehicle_ids: [RANGER.id, HILUX.id] },
    });

    expect(res.statusCode).toBe(200);
    const byPath = Object.fromEntries(res.json().fields.map((f: any) => [f.path, f]));
    expect(byPath['motor.potencia_cv']).toMatchObject({ values: [170, 204], winner_index: 1, criterion: 'max' });
    expect(byPath['preco_brl']).toMatchObject({ values: [250000, 280000], winner_index: 0, criterion: 'min' });
  });

  it('POST /competitive/compare 400 — menos de 2 ids', async () => {
    const res = await app.inject({
      method: 'POST', url: '/competitive/compare', headers: await authAs('analista'), payload: { vehicle_ids: [RANGER.id] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /competitive/compare 422 — ids válidos que não existem no catálogo', async () => {
    const res = await app.inject({
      method: 'POST', url: '/competitive/compare', headers: await authAs('analista'), payload: { vehicle_ids: [uuid(8), uuid(9)] },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe('vehicles_not_found');
  });
});

describe('Manutenção do catálogo (gestor/admin)', () => {
  it('DELETE 200 → GET 404: o veículo é removido', async () => {
    const headers = await authAs('gestor');
    const del = await app.inject({ method: 'DELETE', url: `/competitive/vehicles/${RANGER.id}`, headers });
    expect(del.statusCode).toBe(200);

    const get = await app.inject({ method: 'GET', url: `/competitive/vehicles/${RANGER.id}`, headers });
    expect(get.statusCode).toBe(404);
  });

  it('DELETE 404 — veículo que já não existe', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/competitive/vehicles/${uuid(77)}`, headers: await authAs('admin') });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE 500 — falha do banco sem vazar detalhes', async () => {
    fakeDb.failNext('vehicles', 'delete', { code: '23503', message: 'violates foreign key constraint', hint: 'x' });
    const res = await app.inject({ method: 'DELETE', url: `/competitive/vehicles/${RANGER.id}`, headers: await authAs('admin') });

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toMatch(/foreign key|23503/);
  });

  it('POST /competitive/vehicles/import 200 — importa lista JSON', async () => {
    const content = JSON.stringify([{ marca: 'Chevrolet', modelo: 'S10', versao: 'LTZ', ano: 2025 }]);
    const res = await app.inject({
      method: 'POST', url: '/competitive/vehicles/import', headers: await authAs('gestor'), payload: { format: 'json', content },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().inserted).toBe(1);
    expect(fakeDb.rows('vehicles').some((v) => v.modelo === 'S10')).toBe(true);
  });

  it('POST /competitive/vehicles/import 400 — JSON malformado', async () => {
    const res = await app.inject({
      method: 'POST', url: '/competitive/vehicles/import', headers: await authAs('gestor'),
      payload: { format: 'json', content: '[{"marca": ' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('parse_failed');
  });

  it('POST /competitive/vehicles/import 422 — nenhum item válido', async () => {
    const res = await app.inject({
      method: 'POST', url: '/competitive/vehicles/import', headers: await authAs('gestor'),
      payload: { format: 'json', content: '[          ]' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('POST /competitive/import/file 415 — tipo de arquivo não suportado', async () => {
    const boundary = 'TESTBOUNDARY';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="planilha.txt"',
      'Content-Type: text/plain',
      '',
      'conteudo',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const res = await app.inject({
      method: 'POST', url: '/competitive/import/file', payload: body,
      headers: { ...(await authAs('gestor')), 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
    expect(res.statusCode).toBe(415);
  });
});

describe('Integrações externas', () => {
  it('refresh-price 502 — FIPE fora do ar, sem vazar detalhes da falha', async () => {
    fakeFipe.findVehicle = async () => { throw new Error('ECONNREFUSED https://fipe.test?token=SEGREDO'); };
    const res = await app.inject({
      method: 'POST', url: `/competitive/vehicles/${RANGER.id}/refresh-price`, headers: await authAs('analista'),
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('fipe_unavailable');
    expect(res.body).not.toContain('SEGREDO');
  });

  it('refresh-price 404 — combinação inexistente na FIPE', async () => {
    fakeFipe.findVehicle = async () => null;
    const res = await app.inject({
      method: 'POST', url: `/competitive/vehicles/${RANGER.id}/refresh-price`, headers: await authAs('analista'),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('not_in_fipe');
  });

  it('refresh-price 200 — atualiza o preço com o valor da FIPE', async () => {
    fakeFipe.findVehicle = async () => ({ Valor: 'R$ 260.000,00', CodigoFipe: '005123-4', MesReferencia: 'setembro de 2026' });
    const res = await app.inject({
      method: 'POST', url: `/competitive/vehicles/${RANGER.id}/refresh-price`, headers: await authAs('analista'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ preco_antigo: 250000, preco_novo: 260000, diff: 10000 });
  });

  it('auto-fill 503 — catálogo canônico ainda não carregado', async () => {
    fakeDb.seed('catalog_items', []);
    const res = await app.inject({
      method: 'POST', url: `/competitive/vehicles/${RANGER.id}/catalog-values/auto-fill`,
      headers: await authAs('gestor'), payload: {},
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('catalog_not_loaded');
  });
});
