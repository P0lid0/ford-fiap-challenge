/**
 * Adaptador do provedor de identidade (Supabase Auth).
 *
 * Responsabilidade única: conversar com o Supabase para
 *   - conferir e-mail/senha (login),
 *   - validar tokens legados emitidos pelo próprio Supabase,
 *   - buscar o perfil de acesso (role + concessionária) do usuário.
 *
 * Quem EMITE o JWT da API é lib/jwt.ts — aqui só verificamos identidade.
 */
import { env } from '../config.js';
import { adminClient } from './supabase.js';
import { USER_ROLES, type UserRole } from './jwt.js';
import { ApiError } from './api-error.js';

export type IdentityUser = {
  id: string;
  email: string;
};

export type UserProfile = {
  role: UserRole;
  dealershipId: string | null;
};

/** O provedor de identidade falhou ou está fora do ar → HTTP 502. */
export class IdentityProviderError extends ApiError {
  constructor(message: string) {
    super(502, 'identity_provider_unavailable', message);
    this.name = 'IdentityProviderError';
  }
}

function supabaseAuthHeaders(): Record<string, string> {
  return {
    apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };
}

/**
 * Confere as credenciais no Supabase Auth (grant_type=password).
 * @returns o usuário, ou `null` se e-mail/senha estiverem errados
 * @throws IdentityProviderError se o Supabase não responder corretamente
 */
export async function authenticateWithPassword(email: string, password: string): Promise<IdentityUser | null> {
  let response: Response;
  try {
    response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: supabaseAuthHeaders(),
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new IdentityProviderError('provedor de identidade indisponível');
  }

  // Supabase responde 400 (invalid_grant) para credenciais erradas.
  if (response.status === 400 || response.status === 401) return null;
  if (!response.ok) {
    throw new IdentityProviderError(`provedor de identidade respondeu ${response.status}`);
  }

  const body = await response.json() as { user?: { id?: string; email?: string } };
  if (!body.user?.id) {
    throw new IdentityProviderError('resposta inesperada do provedor de identidade');
  }
  return { id: body.user.id, email: body.user.email ?? email };
}

/**
 * Valida um token emitido pelo Supabase (fluxo legado do web/mobile).
 * @returns o usuário, ou `null` se o token for rejeitado
 */
export async function findUserBySupabaseToken(supabaseJwt: string): Promise<IdentityUser | null> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { ...supabaseAuthHeaders(), Authorization: `Bearer ${supabaseJwt}` },
  });
  if (!response.ok) return null;

  const user = await response.json() as { id?: string; email?: string };
  if (!user.id) return null;
  return { id: user.id, email: user.email ?? '' };
}

/**
 * Busca role e concessionária em `profiles`.
 * Sem perfil (ou com role desconhecida) → 'analista': o MENOR privilégio.
 */
export async function findUserProfile(userId: string): Promise<UserProfile> {
  const { data } = await adminClient()
    .from('profiles')
    .select('role, dealership_id')
    .eq('id', userId)
    .maybeSingle();

  const role = USER_ROLES.includes(data?.role) ? (data!.role as UserRole) : 'analista';
  return { role, dealershipId: data?.dealership_id ?? null };
}
