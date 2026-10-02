import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAccessToken, TokenError, type TokenErrorCode, type UserRole } from '../lib/jwt.js';
import { forbidden, unauthorized } from '../lib/api-error.js';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  dealership_id: string | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    /** Motivo da rejeição do token (ex.: expirado) — usado na mensagem do 401. */
    authError?: TokenErrorCode;
  }
  interface FastifyContextConfig {
    /** `true` = rota acessível sem token. Padrão: protegida. */
    public?: boolean;
  }
}

function extractBearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Token da própria API: assinatura, expiração e claims conferidas localmente. */
async function authenticateApiToken(req: FastifyRequest, token: string): Promise<void> {
  try {
    const subject = await verifyAccessToken(token);
    req.user = {
      id: subject.id,
      email: subject.email,
      role: subject.role,               // vem da claim — sem consulta ao banco
      dealership_id: subject.dealershipId,
    };
  } catch (err) {
    if (err instanceof TokenError) {
      req.authError = err.code;
      req.log.info({ reason: err.code }, '[auth] api token rejected');
      return;
    }
    throw err;
  }
}

/** Rotas que dispensam token: marcadas com `config.public`, Swagger UI, preflight CORS e 404. */
function isPublicRequest(req: FastifyRequest): boolean {
  if (req.method === 'OPTIONS') return true;
  if (req.is404) return true;
  if (req.routeOptions.config?.public === true) return true;
  return req.routeOptions.url?.startsWith('/docs') ?? false;
}

/**
 * Autenticação SEGURA POR PADRÃO:
 *  1. Identifica o usuário pelo header `Authorization: Bearer <token>`.
 *  2. Toda rota exige token válido (401), exceto as marcadas com `config: { public: true }`.
 *
 * Roda em `onRequest` — antes do parse/validação do corpo — então uma requisição
 * sem credencial recebe 401 sem que o servidor processe o payload.
 * Restrições por perfil ficam em cada rota via `authorize(...)`.
 */
// fp() marca o plugin como global (não encapsulado) — sem isso, o hook
// só rodaria nas rotas registradas dentro deste plugin.
export const authPlugin = fp(async function authPluginImpl(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    const token = extractBearerToken(req);
    if (token) await authenticateApiToken(req, token);

    if (!isPublicRequest(req)) requireUser(req);
  });
});

/** Retorna o usuário autenticado ou lança 401. */
export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) {
    if (req.authError === 'token_expired') throw unauthorized('token expirado', 'token_expired');
    if (req.authError === 'invalid_token') throw unauthorized('token inválido', 'invalid_token');
    throw unauthorized();
  }
  return req.user;
}

/**
 * Hook de autorização por perfil. Uso na rota:
 *   { onRequest: [authorize('gestor', 'admin')] }
 * 401 se não autenticado · 403 se o perfil não está na lista.
 */
export function authorize(...allowedRoles: UserRole[]) {
  async function authorizeHook(req: FastifyRequest): Promise<void> {
    const user = requireUser(req);
    if (!allowedRoles.includes(user.role)) {
      req.log.info({ uid: user.id, role: user.role, allowedRoles }, '[auth] forbidden');
      throw forbidden(`perfil '${user.role}' não tem acesso a este recurso`);
    }
  }
  // Metadado lido pela documentação OpenAPI (plugins/openapi.ts) para listar os perfis da rota.
  return Object.assign(authorizeHook, { allowedRoles });
}

/** Perfis exigidos por um hook criado com `authorize(...)`, ou `null` se não for um. */
export function allowedRolesOf(hook: unknown): UserRole[] | null {
  const roles = (hook as { allowedRoles?: unknown } | null)?.allowedRoles;
  return Array.isArray(roles) ? (roles as UserRole[]) : null;
}
