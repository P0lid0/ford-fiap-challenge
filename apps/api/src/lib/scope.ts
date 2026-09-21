/**
 * Isolamento por dealership/papel — substitui as policies de RLS
 * (antigas 002_rls_policies, 009_acoes_retencao, 017_email_integration).
 *
 * A API conecta ao PostgreSQL com um único role, então TODA rota que antes
 * dependia do RLS (publicClient(u.jwt)) precisa aplicar estes helpers
 * explicitamente nas queries.
 *
 * Regras:
 *   admin    → lê e escreve tudo.
 *   gestor   → lê tudo (clients, client_history, predictions, acoes_retencao,
 *              email_logs); escreve só na própria dealership.
 *   analista → lê/escreve só dealership_id = user.dealership_id.
 *   email_logs: analista vê só sent_by = user.id; gestor/admin veem tudo.
 *   vehicles/catalog_items/vehicle_catalog_values/dealerships: leitura para
 *   qualquer autenticado; escrita conforme requireRole na rota.
 *   ai_keys/ai_config: admin (requireRole nas rotas).
 */
import type postgres from 'postgres';
import type { AuthUser } from '../plugins/auth.js';
import { sql } from './db.js';

export type Fragment = postgres.Fragment;

/**
 * Identificador de coluna, opcionalmente qualificado ('c.dealership_id').
 * `sql('c.dealership_id')` viraria "c.dealership_id" (um identificador só),
 * então separamos alias e coluna. Só aceita nomes fixos vindos do código.
 */
function ident(col: string): Fragment {
  const parts = col.split('.');
  if (parts.length === 1) return sql`${sql(col)}`;
  if (parts.length === 2) return sql`${sql(parts[0]!)}.${sql(parts[1]!)}`;
  throw new Error(`identificador de coluna inválido: ${col}`);
}

function httpError(status: number, message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = status;
  return err;
}

/** Fragmento vazio (sql`` sem parâmetros) — concatena sem efeito na query. */
const EMPTY = sql``;

/** Fragmento que não retorna nenhuma linha (analista sem dealership). */
const NOTHING = sql`and false`;

/** admin e gestor leem a rede inteira; analista só a própria dealership. */
export function canReadAll(u: AuthUser): boolean {
  return u.role === 'admin' || u.role === 'gestor';
}

/**
 * Filtro de LEITURA por dealership. Use como fragmento após um `where ...`:
 *
 *   sql`select * from clients c where true ${dealershipFilter(u, 'c.dealership_id')}`
 *
 * - admin/gestor → fragmento vazio (veem tudo).
 * - analista     → `and <col> = ${u.dealership_id}`.
 * - analista sem dealership → `and false` (não vê nada).
 *
 * `col` precisa ser um identificador fixo do código (não vem do usuário).
 */
export function dealershipFilter(u: AuthUser, col = 'dealership_id'): Fragment {
  if (canReadAll(u)) return EMPTY;
  if (!u.dealership_id) return NOTHING;
  return sql`and ${ident(col)} = ${u.dealership_id}`;
}

/**
 * Filtro de ESCRITA por dealership (update/delete em lote): admin edita tudo;
 * gestor e analista só a própria dealership.
 */
export function writeDealershipFilter(u: AuthUser, col = 'dealership_id'): Fragment {
  if (u.role === 'admin') return EMPTY;
  if (!u.dealership_id) return NOTHING;
  return sql`and ${ident(col)} = ${u.dealership_id}`;
}

/** Filtro de leitura de email_logs: analista só vê o que ele mesmo enviou. */
export function emailLogsFilter(u: AuthUser, col = 'sent_by'): Fragment {
  if (canReadAll(u)) return EMPTY;
  return sql`and ${ident(col)} = ${u.id}`;
}

/** true se o usuário pode LER registros da dealership informada. */
export function canReadDealership(u: AuthUser, dealershipId: string | null | undefined): boolean {
  if (canReadAll(u)) return true;
  return !!u.dealership_id && u.dealership_id === dealershipId;
}

/** true se o usuário pode ESCREVER registros da dealership informada. */
export function canWriteDealership(u: AuthUser, dealershipId: string | null | undefined): boolean {
  if (u.role === 'admin') return true;
  return !!u.dealership_id && u.dealership_id === dealershipId;
}

/**
 * Lança 403 se o usuário não puder escrever na dealership.
 * Equivale ao `with check` das antigas policies de insert/update.
 */
export function assertCanWriteDealership(u: AuthUser, dealershipId: string | null | undefined): void {
  if (!canWriteDealership(u, dealershipId)) {
    throw httpError(403, 'forbidden: dealership fora do escopo do usuário');
  }
}

/**
 * Lança 403 se o usuário não puder ler a dealership (útil em GET /:id onde o
 * comportamento antigo do RLS era "não encontrado"; escolha 404 na rota se
 * preferir preservar esse comportamento).
 */
export function assertCanReadDealership(u: AuthUser, dealershipId: string | null | undefined): void {
  if (!canReadDealership(u, dealershipId)) {
    throw httpError(403, 'forbidden: dealership fora do escopo do usuário');
  }
}

/**
 * Dealership a usar num INSERT (clients, acoes_retencao): a do usuário; admin
 * pode informar outra explicitamente. Lança 403 se não-admin tentar outra e
 * 400 se não houver dealership disponível.
 */
export function resolveWriteDealership(u: AuthUser, requested?: string | null): string {
  const target = requested ?? u.dealership_id;
  if (!target) throw httpError(400, 'usuário não está vinculado a uma concessionária');
  assertCanWriteDealership(u, target);
  return target;
}
