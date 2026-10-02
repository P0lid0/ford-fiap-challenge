import { defineConfig } from 'vitest/config';

/**
 * Testes automatizados da API (Sprint 3) — rodam contra um PostgreSQL REAL de teste
 * (banco `faroai_test`; ver test/helpers/test-env.ts).
 *
 *   pnpm --filter @ford/api test            → roda os testes
 *   pnpm --filter @ford/api test:coverage   → roda + gera cobertura
 *
 * Evidências geradas em apps/api/test-results/:
 *   junit.xml            → resultado de cada teste (formato aceito por CI / IDEs)
 *   coverage/index.html  → cobertura de código navegável
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Antes da suíte: confere o banco de teste e aplica as migrations pendentes.
    globalSetup: ['test/global-setup.ts'],
    // Antes de cada arquivo: variáveis de ambiente de teste e dublês de IA/FIPE/rede.
    setupFiles: ['test/setup.ts'],
    environment: 'node',
    // Cada arquivo roda isolado (módulos e mocks não vazam entre arquivos)...
    isolate: true,
    // ...mas em SÉRIE: todos compartilham o mesmo banco, e cada teste apaga e semeia os dados.
    fileParallelism: false,
    // O login confere bcrypt de custo 12 (centenas de ms por tentativa).
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // server.ts só abre a porta.
      exclude: ['src/server.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: 'test-results/coverage',
    },
  },
});
