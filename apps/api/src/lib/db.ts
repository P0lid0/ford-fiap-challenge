/**
 * Conexão única com o PostgreSQL (pacote `postgres`, porsager).
 *
 * Uso nas rotas: sempre parâmetros via tagged template —
 *   sql`select * from clients where id = ${id}`
 *   sql`insert into clients ${sql(obj)}` / sql`update x set ${sql(obj, 'a', 'b')}`
 *   sql`... where id in ${sql(ids)}` ou `= any(${ids})`
 *   fragmentos sql`` para condições dinâmicas (ver lib/scope.ts).
 * `sql.unsafe` só no runner de migrations (scripts/db-migrate.mjs).
 *
 * Parsers customizados preservam o contrato HTTP que o PostgREST entregava:
 *   - numeric/bigint → Number (o driver devolve string por padrão);
 *   - date → string 'YYYY-MM-DD' (sem virar Date com fuso);
 *   - timestamptz continua Date (serializa ISO no JSON).
 */
import postgres from 'postgres';
import { env } from '../config.js';

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
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
