/**
 * Geração e validação dos JWT emitidos pela própria API.
 *
 * Fluxo:
 *   POST /auth/login → signAccessToken() → cliente guarda o token
 *   Requisições seguintes → Authorization: Bearer <token> → verifyAccessToken()
 *
 * Algoritmo: HS256 (HMAC-SHA256 com segredo simétrico em JWT_SECRET).
 * Claims registradas: sub, iss, aud, iat, exp, jti.
 * Claims da aplicação: email, role, dealership_id (usadas na autorização).
 */
import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify, decodeJwt, errors } from 'jose';
import { z } from 'zod';
import { env } from '../config.js';

export const USER_ROLES = ['analista', 'gestor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Dados do usuário que viram claims dentro do token. */
export type TokenSubject = {
  id: string;
  email: string;
  role: UserRole;
  dealershipId: string | null;
};

/** Resultado de uma emissão de token (formato devolvido no /auth/login). */
export type IssuedToken = {
  accessToken: string;
  expiresIn: number; // segundos
};

export type TokenErrorCode = 'token_expired' | 'invalid_token';

/** Erro de validação de token — o plugin de auth converte em HTTP 401. */
export class TokenError extends Error {
  constructor(public readonly code: TokenErrorCode, message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

const ALGORITHM = 'HS256';
const secretKey = new TextEncoder().encode(env.JWT_SECRET);

// Garante que o payload assinado tem exatamente o formato esperado.
// Um token com assinatura válida mas claims incoerentes também é rejeitado.
const AccessTokenPayload = z.object({
  sub: z.string().min(1),
  email: z.string(),
  role: z.enum(USER_ROLES),
  dealership_id: z.string().nullable(),
});

export async function signAccessToken(subject: TokenSubject): Promise<IssuedToken> {
  const expiresIn = env.JWT_EXPIRES_IN_SECONDS;

  const accessToken = await new SignJWT({
    email: subject.email,
    role: subject.role,
    dealership_id: subject.dealershipId,
  })
    .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
    .setSubject(subject.id)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .setJti(randomUUID())
    .sign(secretKey);

  return { accessToken, expiresIn };
}

/**
 * Valida assinatura, algoritmo, emissor, audiência e expiração.
 * @throws TokenError('token_expired') se o `exp` já passou
 * @throws TokenError('invalid_token') para qualquer outra falha
 */
export async function verifyAccessToken(token: string): Promise<TokenSubject> {
  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(token, secretKey, {
      algorithms: [ALGORITHM],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }));
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      throw new TokenError('token_expired', 'token expirado');
    }
    throw new TokenError('invalid_token', 'token inválido');
  }

  const claims = AccessTokenPayload.safeParse(payload);
  if (!claims.success) {
    throw new TokenError('invalid_token', 'claims do token inválidas');
  }

  return {
    id: claims.data.sub,
    email: claims.data.email,
    role: claims.data.role,
    dealershipId: claims.data.dealership_id,
  };
}

/**
 * Lê o `iss` SEM validar a assinatura — serve só para decidir QUAL validador usar
 * (token desta API vs. token de outro emissor). A validação real vem depois.
 */
export function isIssuedByThisApi(token: string): boolean {
  try {
    return decodeJwt(token).iss === env.JWT_ISSUER;
  } catch {
    return false;
  }
}
