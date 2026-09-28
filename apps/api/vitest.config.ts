import { defineConfig } from 'vitest/config';

/**
 * Testes automatizados da API (Sprint 3).
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
    setupFiles: ['test/setup.ts'],
    environment: 'node',
    // Cada arquivo roda isolado — o banco simulado e os mocks não vazam entre arquivos.
    isolate: true,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // server.ts só abre a porta; supabase.ts e audit.ts são substituídos pelos dublês de test/helpers.
      exclude: ['src/server.ts', 'src/lib/supabase.ts', 'src/lib/audit.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: 'test-results/coverage',
    },
  },
});
