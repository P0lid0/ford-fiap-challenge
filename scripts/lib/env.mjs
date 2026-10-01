/**
 * Carrega .env.local da raiz do monorepo sem sobrescrever o que já está no
 * ambiente e devolve a DATABASE_URL. Compartilhado por todos os scripts
 * que falam com o PostgreSQL.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadRootEnv() {
  const envPath = join(repoRoot, '.env.local');
  if (!existsSync(envPath)) return;
  // split em \r?\n: no Windows o arquivo pode estar em CRLF e o \r iria pro valor.
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

export function databaseUrl() {
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL ausente (defina no ambiente ou em .env.local na raiz).');
    console.error('   ex.: DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/faroai');
    process.exit(1);
  }
  return url;
}

/** URL base da API (scripts que falam HTTP com a API, ex.: e2e-test.mjs). */
export function apiUrl() {
  loadRootEnv();
  return process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3333';
}
