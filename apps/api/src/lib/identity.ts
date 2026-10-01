/**
 * Adaptador de identidade local (usuários em `public.profiles`).
 *
 * Responsabilidade única: conferir quem é o usuário e buscar o perfil de acesso
 *   - conferir e-mail/senha (login) contra o hash bcrypt de profiles.password_hash,
 *   - buscar o perfil de acesso (role + concessionária) do usuário.
 *
 * Quem EMITE o JWT da API é lib/jwt.ts — aqui só verificamos identidade.
 * Usuários não se cadastram pela API: são criados por scripts/db-create-user.mjs
 * (ou scripts/db-seed-admin.mjs).
 */
import bcrypt from 'bcryptjs';
import { sql } from './db.js';
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

/** A base de identidade falhou ou está fora do ar → HTTP 502. */
export class IdentityProviderError extends ApiError {
  constructor(message: string) {
    super(502, 'identity_provider_unavailable', message);
    this.name = 'IdentityProviderError';
  }
}

/** Custo do bcrypt — o mesmo dos scripts que gravam o hash (db-seed-admin / db-create-user). */
export const BCRYPT_COST = 12;

// Hash de uma senha qualquer, usado quando o e-mail não existe (ou o usuário
// não tem senha): o login gasta o mesmo tempo de bcrypt.compare e não vaza,
// por timing, quais e-mails estão cadastrados.
const DUMMY_HASH = bcrypt.hashSync('faroai-dummy-password-never-matches', BCRYPT_COST);

type CredentialRow = { id: string; email: string; password_hash: string | null };

/**
 * Confere as credenciais contra `profiles.password_hash`.
 * @returns o usuário, ou `null` se e-mail/senha estiverem errados
 * @throws IdentityProviderError se o banco não responder
 */
export async function authenticateWithPassword(email: string, password: string): Promise<IdentityUser | null> {
  let row: CredentialRow | undefined;
  try {
    [row] = await sql<CredentialRow[]>`
      select id, email, password_hash
      from public.profiles
      where lower(email) = ${email.trim().toLowerCase()}
      limit 1
    `;
  } catch {
    throw new IdentityProviderError('base de identidade indisponível');
  }

  // Sempre roda um compare (contra o hash dummy se não há usuário/senha).
  const matches = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !row.password_hash || !matches) return null;
  return { id: row.id, email: row.email };
}

/**
 * Busca role e concessionária em `profiles`.
 * Sem perfil (ou com role desconhecida) → 'analista': o MENOR privilégio.
 */
export async function findUserProfile(userId: string): Promise<UserProfile> {
  const [row] = await sql<{ role: string; dealership_id: string | null }[]>`
    select role, dealership_id from public.profiles where id = ${userId}
  `;

  const role = USER_ROLES.includes(row?.role as UserRole) ? (row!.role as UserRole) : 'analista';
  return { role, dealershipId: row?.dealership_id ?? null };
}
