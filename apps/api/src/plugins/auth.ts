import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { sql } from '../lib/db.js';
import { verifyToken, type UserRole } from '../lib/auth.js';

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  dealership_id: string | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Hook que valida o JWT emitido pela própria API (lib/auth.ts) e popula
 * `request.user` com o profile atual do banco.
 * Em rotas que precisam de auth, importe `requireUser(req)` no handler.
 *
 * O profile é recarregado a cada request (não confiamos só nos claims):
 * mudança de role/dealership ou remoção do usuário vale imediatamente.
 *
 * Por que helpers e não `req.requireUser()`?
 * Fastify v5 mudou o binding de `this` em decorateRequest — funções dependentes
 * de `this` não são confiáveis. Helpers puros são mais simples e tipados.
 */
// fp() marca o plugin como global (não encapsulado) — sem isso, o hook
// só rodaria nas rotas registradas dentro deste plugin.
export const authPlugin = fp(async function authPluginImpl(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    const token = header.slice(7).trim();
    if (!token) return;

    try {
      const claims = await verifyToken(token);
      if (!claims) {
        req.log.warn('[auth] token inválido ou expirado');
        return;
      }

      const [profile] = await sql<AuthUser[]>`
        select id, email, full_name, role, dealership_id
        from public.profiles
        where id = ${claims.sub}
      `;
      // Sem linha (usuário removido) → segue sem user; rota devolve 401.
      if (!profile) return;

      req.user = profile;
    } catch (err) {
      req.log?.warn({ err: String(err) }, '[auth] failed to validate JWT');
    }
  });
});

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) {
    const err = new Error('unauthorized') as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }
  return req.user;
}

export function requireRole(req: FastifyRequest, role: AuthUser['role']): AuthUser {
  const u = requireUser(req);
  if (u.role !== role && u.role !== 'admin') {
    const err = new Error('forbidden') as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  return u;
}
