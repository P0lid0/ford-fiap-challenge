/**
 * Banco de dados dos testes — decide QUAL banco os testes usam e impede, por
 * construção, que a suíte rode (e apague dados) em outro que não seja de teste.
 *
 * Ordem de escolha da URL:
 *   1. TEST_DATABASE_URL;
 *   2. DATABASE_URL do ambiente, SE o nome do banco terminar em `_test` (é o caso do CI);
 *   3. PostgreSQL local, banco `faroai_test` (usuário postgres, sem senha).
 * Uma DATABASE_URL de desenvolvimento (banco `faroai`) é ignorada de propósito.
 */
const DEFAULT_TEST_DATABASE_URL = 'postgres://postgres@127.0.0.1:5432/faroai_test';

function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

function pickUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv && /_test$/.test(databaseName(fromEnv))) return fromEnv;
  return DEFAULT_TEST_DATABASE_URL;
}

export const TEST_DATABASE_URL = pickUrl();

/** Falha se a URL não apontar para um banco de teste (nome terminado em `_test`). */
export function assertTestDatabase(url: string = TEST_DATABASE_URL): void {
  const dbName = databaseName(url);
  if (!/_test$/.test(dbName)) {
    throw new Error(
      `Os testes apagam dados e só rodam em banco cujo nome termina em "_test" (recebido: "${dbName}"). ` +
      'Ajuste TEST_DATABASE_URL.',
    );
  }
}
