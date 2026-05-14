import type { FastifyInstance, FastifyRequest } from 'fastify';
import { publicClient } from '../lib/supabase.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: 'analista' | 'gestor' | 'admin';
      dealership_id: string | null;
      jwt: string;
    };
  }
}

/**
 * Hook que valida o JWT do Supabase e popula `request.user`.
 * Em rotas que precisam de auth, use `request.requireUser()` no handler.
 */
export async function authPlugin(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    const jwt = header.slice(7).trim();
    if (!jwt) return;

    const client = publicClient(jwt);
    const { data: { user }, error } = await client.auth.getUser(jwt);
    if (error || !user) return;

    // Busca o profile (papel + dealership)
    const { data: profile } = await client
      .from('profiles')
      .select('role, dealership_id')
      .eq('id', user.id)
      .single();

    req.user = {
      id: user.id,
      email: user.email ?? '',
      role: (profile?.role as 'analista' | 'gestor' | 'admin') ?? 'analista',
      dealership_id: profile?.dealership_id ?? null,
      jwt,
    };
  });

  app.decorateRequest('requireUser', function (this: FastifyRequest) {
    if (!this.user) {
      const err = new Error('unauthorized');
      (err as any).statusCode = 401;
      throw err;
    }
    return this.user;
  });

  app.decorateRequest('requireRole', function (this: FastifyRequest, role: string) {
    const u = (this as any).requireUser();
    if (u.role !== role && u.role !== 'admin') {
      const err = new Error('forbidden');
      (err as any).statusCode = 403;
      throw err;
    }
    return u;
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    requireUser: () => NonNullable<FastifyRequest['user']>;
    requireRole: (role: string) => NonNullable<FastifyRequest['user']>;
  }
}
