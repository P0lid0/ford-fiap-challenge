/**
 * Autenticação — emissão do JWT da API.
 *
 * POST /auth/login (PÚBLICO)
 *   1. Supabase Auth confere e-mail/senha      (lib/identity.ts)
 *   2. API busca role + concessionária          (lib/identity.ts)
 *   3. API assina o JWT com essas claims        (lib/jwt.ts)
 *   4. Cliente usa: Authorization: Bearer <access_token>
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticateWithPassword, findUserProfile } from '../lib/identity.js';
import { signAccessToken } from '../lib/jwt.js';
import { logAudit } from '../lib/audit.js';
import { unauthorized } from '../lib/api-error.js';
import { ProblemDetailsSchema } from '../lib/problem-details.js';

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});

const LoginResponse = z.object({
  access_token: z.string().describe('JWT assinado (HS256)'),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().describe('Validade do token em segundos'),
});

export async function authRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/auth/login', {
    config: {
      public: true, // única forma de obter o token — não pode exigir token
      // Limite mais rígido que o global: dificulta força bruta de senha.
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
    schema: {
      tags: ['auth'],
      summary: 'Autentica com e-mail/senha e devolve o JWT da API',
      security: [], // rota pública — não exige Bearer
      body: LoginBody,
      response: {
        200: LoginResponse,
        401: ProblemDetailsSchema,
      },
    },
  }, async (req, reply) => {
    const { email, password } = req.body;
    const auditContext = { ip: req.ip, user_agent: req.headers['user-agent'] ?? null };

    const identity = await authenticateWithPassword(email, password);
    if (!identity) {
      await logAudit({ action: 'auth.login_failed', entity: 'auth', metadata: { email }, ...auditContext }, req.log);
      // Mensagem genérica: não revela se o e-mail existe.
      throw unauthorized('e-mail ou senha inválidos', 'invalid_credentials');
    }

    const profile = await findUserProfile(identity.id);
    const { accessToken, expiresIn } = await signAccessToken({
      id: identity.id,
      email: identity.email,
      role: profile.role,
      dealershipId: profile.dealershipId,
    });

    await logAudit({ actor_id: identity.id, action: 'auth.login', entity: 'auth', entity_id: identity.id, ...auditContext }, req.log);

    return reply.code(200).send({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
    });
  });
}
