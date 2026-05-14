import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config.js';
import { publicClient } from '../lib/supabase.js';

type AuthUser = {
  id: string;
  email: string;
  role: 'analista' | 'gestor' | 'admin';
  dealership_id: string | null;
  jwt: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Hook que valida o JWT do Supabase e popula `request.user`.
 * Em rotas que precisam de auth, importe `requireUser(req)` no handler.
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
    const jwt = header.slice(7).trim();
    if (!jwt) return;

    try {
      req.log.info('[auth] validating jwt');
      // Valida o JWT chamando direto /auth/v1/user (mais confiável que SDK).
      const ures = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${jwt}` },
      });
      req.log.info({ status: ures.status }, '[auth] supabase response');
      if (!ures.ok) {
        const body = await ures.text();
        req.log.warn({ status: ures.status, body: body.slice(0, 200) }, '[auth] /auth/v1/user rejected token');
        return;
      }
      const user = await ures.json() as { id: string; email?: string };
      req.log.info({ uid: user.id }, '[auth] jwt validated');

      const client = publicClient(jwt);
      const { data: profile } = await client
        .from('profiles')
        .select('role, dealership_id')
        .eq('id', user.id)
        .single();

      req.user = {
        id: user.id,
        email: user.email ?? '',
        role: (profile?.role as AuthUser['role']) ?? 'analista',
        dealership_id: profile?.dealership_id ?? null,
        jwt,
      };
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
