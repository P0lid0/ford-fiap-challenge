/**
 * Roda UMA vez antes de toda a suíte (vitest.config.ts → globalSetup):
 *   1. confere que o banco é de teste;
 *   2. desfaz resíduos de uma execução interrompida (tabela renomeada por um teste de falha);
 *   3. aplica as migrations pendentes de db/migrations (o mesmo runner do projeto).
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { assertTestDatabase, TEST_DATABASE_URL } from './helpers/test-env.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export default async function globalSetup(): Promise<void> {
  assertTestDatabase();

  const sql = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await sql`select 1`;
    // Teste de falha de banco renomeia a tabela por instantes (helpers/db.ts → comTabelaIndisponivel).
    const quebradas = await sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' and tablename like '%\\_\\_indisponivel'
    `;
    for (const { tablename } of quebradas) {
      const original = tablename.replace(/\_\_indisponivel$/, '');
      await sql.unsafe(`alter table public."${tablename}" rename to "${original}"`);
    }
    // Gatilhos de falha simulada que sobraram.
    const gatilhos = await sql<{ tgname: string; relname: string }[]>`
      select t.tgname, c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where t.tgname like 'zz\\_teste\\_falha\\_%' and not t.tgisinternal
    `;
    for (const { tgname, relname } of gatilhos) {
      await sql.unsafe(`drop trigger if exists "${tgname}" on public."${relname}"`);
    }
  } catch (err) {
    throw new Error(
      `Banco de teste inacessível (${new URL(TEST_DATABASE_URL).host}${new URL(TEST_DATABASE_URL).pathname}). ` +
      `Suba o PostgreSQL e crie o banco: createdb faroai_test. Causa: ${(err as Error).message}`,
    );
  } finally {
    await sql.end();
  }

  // Runner do projeto (idempotente: pula o que já foi aplicado).
  execFileSync(process.execPath, [resolve(repoRoot, 'scripts', 'db-migrate.mjs')], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
