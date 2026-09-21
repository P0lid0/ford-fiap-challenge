/**
 * Autenticação própria da API — substitui o Supabase Auth (GoTrue).
 *
 *   - Senha: bcrypt (cost 12) armazenado em profiles.password_hash.
 *   - Sessão: JWT HS256 assinado com env.JWT_SECRET, expira em
 *     env.JWT_EXPIRES_IN (default 12h). Claims: sub = profiles.id, email,
 *     role, dealership_id.
 *
 * Quem consome: routes/auth.ts (login/register) e plugins/auth.ts (preHandler
 * que valida o Bearer e popula req.user).
 */
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../config.js';

export type UserRole = 'analista' | 'gestor' | 'admin';

/** Dados do usuário que entram no token e voltam pro cliente no login. */
export type TokenUser = {
  id: string;
  email: string;
  role: UserRole;
  dealership_id: string | null;
};

export type TokenClaims = JWTPayload & {
  sub: string;
  email: string;
  role: UserRole;
  dealership_id: string | null;
};

const BCRYPT_COST = 12;
const secretKey = new TextEncoder().encode(env.JWT_SECRET);

// Hash fixo usado quando o e-mail não existe: garante que /auth/login gaste o
// mesmo tempo de bcrypt.compare e não vaze por timing quais e-mails existem.
export const DUMMY_HASH = bcrypt.hashSync('faroai-dummy-password-never-matches', BCRYPT_COST);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  // Sem hash (usuário sem senha) → compara contra o dummy e sempre falha.
  const ok = await bcrypt.compare(plain, hash ?? DUMMY_HASH);
  return hash ? ok : false;
}

export async function signToken(user: TokenUser): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role, dealership_id: user.dealership_id })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secretKey);
}

/** Devolve os claims ou null se o token for inválido/expirado. */
export async function verifyToken(token: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return payload as TokenClaims;
  } catch {
    return null;
  }
}
