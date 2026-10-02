/**
 * Conexão única com o PostgreSQL (pacote `postgres`, porsager).
 *
 * Uso nas rotas: sempre parâmetros via tagged template —
 *   sql`select * from clients where id = ${id}`
 *   sql`insert into clients ${sql(obj)}` / sql`update x set ${sql(obj, 'a', 'b')}`
 *   sql`... where id in ${sql(ids)}` ou `= any(${ids})`
 *   fragmentos sql`` para condições dinâmicas (ver lib/data-access.ts: scopeFilter).
 * `sql.unsafe` só no runner de migrations (scripts/db-migrate.mjs).
 *
 * Parsers customizados preservam o contrato HTTP que o PostgREST entregava:
 *   - numeric/bigint → Number (o driver devolve string por padrão);
 *   - date → string 'YYYY-MM-DD' (sem virar Date com fuso);
 *   - timestamptz continua Date (serializa ISO no JSON).
 */
import postgres from 'postgres';
import { env } from '../config.js';

/**
 * Normaliza a URL para o driver: provedores gerenciados (ex.: Neon) incluem
 * `channel_binding=require`, que o pacote `postgres` não reconhece.
 */
export function normalizeDatabaseUrl(raw: string): string {
  const url = new URL(raw);
  url.searchParams.delete('channel_binding');
  return url.toString();
}

const databaseUrl = normalizeDatabaseUrl(env.DATABASE_URL);
// Pooler em modo transaction (PgBouncer, ex.: host "-pooler" do Neon) não suporta
// prepared statements nomeados — desliga quando a URL aponta para um pooler.
const viaPooler = new URL(databaseUrl).hostname.includes('-pooler');

export const sql = postgres(databaseUrl, {
  max: 10,
  prepare: !viaPooler,
  onnotice: () => {},
  types: {
    numeric: { to: 1700, from: [1700], serialize: (v: unknown) => String(v), parse: (v: string) => Number(v) },
    bigint: { to: 20, from: [20], serialize: (v: unknown) => String(v), parse: (v: string) => Number(v) },
    date: {
      to: 1082,
      from: [1082],
      // Aceita Date ou string; Date vira 'YYYY-MM-DD' (UTC) em vez do toString() local.
      serialize: (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)),
      parse: (v: string) => v,
    },
  },
});

export type Sql = typeof sql;

/**
 * SQLSTATE de um erro do driver (ex.: '23505' = unique_violation,
 * '23503' = foreign_key_violation), ou `undefined` se não for erro do Postgres.
 * Substitui o `error.code` que o supabase-js devolvia:
 *
 *   try { await sql`insert into clients ${sql(row)}`; }
 *   catch (err) {
 *     if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) throw conflict('já existe…', 'vin_already_exists');
 *     throw err;
 *   }
 */
export function pgErrorCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';
