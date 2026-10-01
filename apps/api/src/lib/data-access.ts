/**
 * Acesso a dados de acordo com QUEM está autenticado.
 *
 * Regras de visibilidade:
 *   LEITURA   → analista: só a própria concessionária · gestor/admin: rede inteira
 *   ALTERAÇÃO → admin: rede inteira · analista/gestor: só a própria concessionária
 *
 * A API conecta ao PostgreSQL com um único papel e NÃO há RLS: o escopo é
 * aplicado EXPLICITAMENTE em cada query, com base nas claims `role` e
 * `dealership_id` do JWT (ver `scopeFilter` abaixo).
 */
import type postgres from 'postgres';
import type { AuthUser } from '../plugins/auth.js';
import { sql } from './db.js';
import { forbidden, notFound } from './api-error.js';

export type DealershipScope =
  | { kind: 'network' }
  | { kind: 'dealership'; dealershipId: string };

/**
 * Identificador de coluna, opcionalmente qualificado ('c.dealership_id').
 * `sql('c.dealership_id')` viraria um identificador único "c.dealership_id",
 * então separamos alias e coluna. Só aceita nomes fixos vindos do código.
 */
function columnIdent(column: string): postgres.Fragment {
  const parts = column.split('.');
  if (parts.length === 1) return sql`${sql(column)}`;
  if (parts.length === 2) return sql`${sql(parts[0]!)}.${sql(parts[1]!)}`;
  throw new Error(`identificador de coluna inválido: ${column}`);
}

/**
 * Fragmento SQL que aplica o escopo a uma query. Use depois de um `where`:
 *
 *   sql`select * from clients where true ${scopeFilter(readScopeOf(u))}`
 *   sql`select * from clients c where c.perfil_real = ${p} ${scopeFilter(scope, 'c.dealership_id')}`
 *
 * - escopo `network`      → fragmento vazio (sem restrição);
 * - escopo `dealership`   → `and <coluna> = $id`.
 *
 * `column` precisa ser um nome fixo do código (nunca vem do usuário).
 */
export function scopeFilter(scope: DealershipScope, column = 'dealership_id'): postgres.Fragment {
  if (scope.kind === 'network') return sql``;
  return sql`and ${columnIdent(column)} = ${scope.dealershipId}`;
}

function ownDealership(user: AuthUser): DealershipScope {
  return { kind: 'dealership', dealershipId: requireDealership(user) };
}

/**
 * Escopo de LEITURA: gestor/admin veem a rede inteira; analista só a própria concessionária.
 * @throws ApiError 403 se o usuário restrito não tiver concessionária vinculada
 */
export function readScopeOf(user: AuthUser): DealershipScope {
  if (user.role === 'gestor' || user.role === 'admin') return { kind: 'network' };
  return ownDealership(user);
}

/**
 * Escopo de ALTERAÇÃO: só admin altera a rede inteira; os demais, só a própria concessionária.
 * @throws ApiError 403 se o usuário restrito não tiver concessionária vinculada
 */
export function writeScopeOf(user: AuthUser): DealershipScope {
  if (user.role === 'admin') return { kind: 'network' };
  return ownDealership(user);
}

/** O escopo permite acessar um registro dessa concessionária? */
export function canAccessDealership(scope: DealershipScope, dealershipId: string | null | undefined): boolean {
  return scope.kind === 'network' || scope.dealershipId === dealershipId;
}

/**
 * Garante que o usuário pode ALTERAR um registro desta concessionária.
 * @throws 404 se o usuário nem enxerga o registro (não revela que ele existe)
 * @throws 403 se enxerga, mas não pode alterar (ex.: gestor em outra loja)
 */
export function assertCanModify(user: AuthUser, dealershipId: string | null | undefined, notFoundMessage: string): void {
  if (!canAccessDealership(readScopeOf(user), dealershipId)) throw notFound(notFoundMessage);
  if (!canAccessDealership(writeScopeOf(user), dealershipId)) {
    throw forbidden('perfil só pode alterar registros da própria concessionária');
  }
}

/**
 * Exige que o usuário esteja vinculado a uma concessionária (para CRIAR registros).
 * @returns o id da concessionária
 * @throws 403 no_dealership
 */
export function requireDealership(user: AuthUser): string {
  if (!user.dealership_id) throw forbidden('usuário não está vinculado a uma concessionária', 'no_dealership');
  return user.dealership_id;
}
