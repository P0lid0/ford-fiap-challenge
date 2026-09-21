/**
 * Autenticação própria — substitui o Supabase Auth (GoTrue).
 *
 *   POST /auth/login    {email, password}            → 200 {token, user}
 *   POST /auth/register {email, password, full_name?} → 201 {token, user}
 *
 * O token é um JWT HS256 (lib/auth.ts) que o web/mobile mandam em
 * `Authorization: Bearer` — plugins/auth.ts valida e popula req.user.
 * GET /me continua em server.ts.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../lib/db.js';
import { hashPassword, verifyPassword, signToken, type UserRole } from '../lib/auth.js';
import { logAudit } from '../lib/audit.js';

const LoginBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

const RegisterBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  full_name: z.string().min(1).max(200).optional(),
});

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  dealership_id: string | null;
  password_hash: string | null;
};

async function sessionFor(p: Omit<ProfileRow, 'password_hash'>) {
  const user = { id: p.id, email: p.email, full_name: p.full_name, role: p.role, dealership_id: p.dealership_id };
  const token = await signToken(user);
  return { token, user };
}

export async function authRoutes(app: FastifyInstance) {

  // ===== LOGIN =====
  app.post('/auth/login', {
    schema: {
      tags: ['auth'],
      summary: 'Autentica com e-mail e senha; devolve JWT + dados do usuário',
      body: LoginBody,
    },
    // Rota pública: não exige Bearer.
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { email, password } = req.body as z.infer<typeof LoginBody>;
    const normalized = email.trim().toLowerCase();

    const [profile] = await sql<ProfileRow[]>`
      select id, email, full_name, role, dealership_id, password_hash
      from public.profiles
      where lower(email) = ${normalized}
    `;

    // verifyPassword sempre executa bcrypt.compare — contra um hash dummy
    // quando o e-mail não existe ou o usuário não tem senha — para não vazar
    // por timing quais e-mails estão cadastrados. Mensagem genérica nos dois casos.
    const ok = await verifyPassword(password, profile?.password_hash ?? null);
    if (!profile || !ok) {
      reply.code(401);
      return { error: 'Unauthorized', message: 'invalid credentials' };
    }

    await logAudit({
      actor_id: profile.id, action: 'auth.login', entity: 'profile', entity_id: profile.id,
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    });
    return sessionFor(profile);
  });

  // ===== REGISTER =====
  app.post('/auth/register', {
    schema: {
      tags: ['auth'],
      summary: 'Cria usuário (role analista) e já devolve a sessão',
      body: RegisterBody,
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const body = req.body as z.infer<typeof RegisterBody>;
    const email = body.email.trim().toLowerCase();
    // Mesmo default do antigo trigger handle_new_user: parte antes do @.
    const full_name = body.full_name?.trim() || email.split('@')[0]!;

    const [exists] = await sql`select 1 from public.profiles where lower(email) = ${email}`;
    if (exists) {
      reply.code(409);
      return { error: 'Conflict', message: 'e-mail já cadastrado' };
    }

    const password_hash = await hashPassword(body.password);
    let profile: Omit<ProfileRow, 'password_hash'> | undefined;
    try {
      [profile] = await sql<Omit<ProfileRow, 'password_hash'>[]>`
        insert into public.profiles ${sql({ email, full_name, role: 'analista', password_hash })}
        returning id, email, full_name, role, dealership_id
      `;
    } catch (err) {
      // Corrida entre o select e o insert: unique_violation em profiles.email.
      if ((err as { code?: string }).code === '23505') {
        reply.code(409);
        return { error: 'Conflict', message: 'e-mail já cadastrado' };
      }
      throw err;
    }
    if (!profile) throw new Error('insert em profiles não retornou linha');

    await logAudit({
      actor_id: profile.id, action: 'auth.register', entity: 'profile', entity_id: profile.id,
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    });
    reply.code(201);
    return sessionFor(profile);
  });
}
