/**
 * Acesso a dados de acordo com QUEM está autenticado.
 *
 * Regras de visibilidade (as mesmas das políticas RLS do Postgres):
 *   LEITURA   → analista: só a própria concessionária · gestor/admin: rede inteira
 *   ALTERAÇÃO → admin: rede inteira · analista/gestor: só a própria concessionária
 *
 * Tokens legados do Supabase continuam usando o cliente com RLS (o banco filtra).
 * Tokens da API usam o cliente de serviço e o filtro é aplicado pela API,
 * com base nas claims `role` e `dealership_id` do JWT. Em ambos os casos a rota
 * aplica o escopo — o RLS vira uma segunda camada de defesa.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../plugins/auth.js';
import { adminClient, publicClient } from './supabase.js';
import { forbidden, notFound } from './api-error.js';

export type DealershipScope =
  | { kind: 'network' }
  | { kind: 'dealership'; dealershipId: string };

/** Cliente de banco adequado à origem do token do usuário. */
export function dbFor(user: AuthUser): SupabaseClient {
  return user.authSource === 'supabase' ? publicClient(user.jwt) : adminClient();
}

function ownDealership(user: AuthUser): DealershipScope {
  return { kind: 'dealership', dealershipId: requireDealership(user) };
}

/**
 * Escopo de LEITURA (espelha as políticas RLS de SELECT).
 * @throws ApiError 403 se o usuário restrito não tiver concessionária vinculada
 */
export function readScopeOf(user: AuthUser): DealershipScope {
  if (user.role === 'gestor' || user.role === 'admin') return { kind: 'network' };
  return ownDealership(user);
}

/**
 * Escopo de ALTERAÇÃO (espelha as políticas RLS de UPDATE).
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
