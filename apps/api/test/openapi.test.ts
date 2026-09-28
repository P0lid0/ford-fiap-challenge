/**
 * Documentação OpenAPI/Swagger — coerente com as regras de acesso e de erro.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROUTE_ERRORS } from '../src/plugins/openapi.js';
import { createTestApp, type TestApp } from './helpers/test-app.js';

let app: TestApp;
let doc: any;
beforeAll(async () => {
  app = await createTestApp();
  doc = (await app.inject({ method: 'GET', url: '/docs/json' })).json();
});
afterAll(async () => { await app.close(); });

const PROBLEM_REF = '#/components/schemas/ProblemDetails';

function operations(): { key: string; op: any }[] {
  return Object.entries<any>(doc.paths).flatMap(([path, item]) =>
    Object.entries<any>(item).map(([method, op]) => ({ key: `${method.toUpperCase()} ${path}`, op })));
}

describe('Swagger / OpenAPI', () => {
  it('publica OpenAPI 3 com esquema Bearer JWT e o schema ProblemDetails', () => {
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.components.securitySchemes.bearer).toEqual({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    expect(doc.components.schemas.ProblemDetails.properties).toHaveProperty('code');
  });

  it('toda rota protegida documenta 401 e informa o acesso na descrição', () => {
    for (const { key, op } of operations()) {
      const isPublic = Array.isArray(op.security) && op.security.length === 0;
      expect(op.description, key).toMatch(/\*\*Acesso:\*\*/);
      if (!isPublic) expect(op.responses, key).toHaveProperty('401');
    }
  });

  it('rotas restritas por perfil documentam 403 e os perfis permitidos', () => {
    const adminKeys = doc.paths['/admin/ai-keys'].get;
    expect(adminKeys.responses).toHaveProperty('403');
    expect(adminKeys.description).toContain('`admin`');

    const deleteVehicle = doc.paths['/competitive/vehicles/{id}'].delete;
    expect(deleteVehicle.description).toContain('`gestor`, `admin`');
  });

  it('toda resposta de erro usa application/problem+json com o schema ProblemDetails', () => {
    for (const { key, op } of operations()) {
      for (const [status, response] of Object.entries<any>(op.responses)) {
        if (Number(status) < 400) continue;
        expect(response.content, `${key} ${status}`).toEqual({ 'application/problem+json': { schema: { $ref: PROBLEM_REF } } });
      }
    }
  });

  it('cada entrada de ROUTE_ERRORS corresponde a uma rota real e aparece documentada', () => {
    for (const [route, codes] of Object.entries(ROUTE_ERRORS)) {
      const [method, url] = route.split(' ');
      const op = doc.paths[url!.replace(/:(\w+)/g, '{$1}')]?.[method!.toLowerCase()];
      expect(op, `rota inexistente em ROUTE_ERRORS: ${route}`).toBeDefined();
      for (const code of codes) expect(op.responses, `${route} → ${code}`).toHaveProperty(String(code));
    }
  });
});
