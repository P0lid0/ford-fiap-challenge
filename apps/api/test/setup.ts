/**
 * Executado antes de CADA arquivo de teste (vitest.config.ts → setupFiles).
 *
 * 1. Define variáveis de ambiente de teste (antes de qualquer import de src/) —
 *    inclusive a DATABASE_URL do banco de teste (helpers/test-env.ts).
 * 2. Troca as dependências externas (IA, FIPE, rede) pelos dublês de test/helpers/fakes.ts.
 *    O banco e o audit_log são REAIS (PostgreSQL de teste).
 * 3. Zera os dublês antes de cada teste — nenhum teste depende de outro.
 */
import { beforeEach, vi } from 'vitest';
import { assertTestDatabase, TEST_DATABASE_URL } from './helpers/test-env.js';

assertTestDatabase();
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.CLIENT_CPF_PEPPER = 'test-only-cpf-pepper-more-than-32-chars';
process.env.ML_SERVICE_TOKEN = 'test-only-ml-service-token-more-than-32-chars';
process.env.JWT_SECRET = 'test-only-jwt-secret-with-more-than-32-chars';
process.env.JWT_EXPIRES_IN_SECONDS = '3600';
process.env.RATE_LIMIT_MAX = '10000'; // o limite global não interfere; o do login é testado à parte

vi.mock('../src/lib/ai.js', async (importOriginal) => {
  const { fakeAi } = await import('./helpers/fakes.js');
  const original = await importOriginal<typeof import('../src/lib/ai.js')>();
  return {
    ...original,
    aiAvailable: () => fakeAi.available,
    chat: (...args: unknown[]) => fakeAi.chat(...args),
    getApiKey: async () => '',
  };
});

vi.mock('../src/lib/data-sources/fipe.js', async (importOriginal) => {
  const { fakeFipe } = await import('./helpers/fakes.js');
  const original = await importOriginal<typeof import('../src/lib/data-sources/fipe.js')>();
  return {
    ...original,
    fipe: {
      ...original.fipe,
      findVehicle: (...args: unknown[]) => fakeFipe.findVehicle(...args),
      preco: (...args: unknown[]) => fakeFipe.preco(...args),
    },
  };
});

vi.stubGlobal('fetch', async (input: unknown, init?: RequestInit) => {
  const { fakeHttp } = await import('./helpers/fakes.js');
  return fakeHttp.handler(String(input instanceof Request ? input.url : input), init);
});

beforeEach(async () => {
  const { resetFakes } = await import('./helpers/fakes.js');
  resetFakes();
});
