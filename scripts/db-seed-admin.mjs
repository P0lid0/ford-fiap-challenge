#!/usr/bin/env node
/**
 * Cria/atualiza o usuário admin de demo direto em public.profiles
 * (autenticação própria da API — sem Supabase Auth).
 *
 * Upsert por e-mail. Env opcionais:
 *   ADMIN_EMAIL     (default admin@faroai.com.br)
 *   ADMIN_PASSWORD  (default Ford2026!)
 *   ADMIN_NAME      (default Administrador)
 *   ADMIN_DEALERSHIP_CODIGO (default FD001; se a dealership existir, vincula)
 *
 * Uso: pnpm db:seed:admin   (depois de pnpm db:migrate)
 */
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { databaseUrl } from './lib/env.mjs';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@faroai.com.br').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Ford2026!';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
const ADMIN_DEALERSHIP_CODIGO = process.env.ADMIN_DEALERSHIP_CODIGO || 'FD001';
const BCRYPT_COST = 12; // mesmo custo de apps/api/src/lib/identity.ts

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

try {
  console.log(`🔑 preparando admin ${ADMIN_EMAIL}...`);
  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST);

  // Dealership de demo (seed 003) — vincula se existir, senão fica null.
  const [deal] = await sql`select id from public.dealerships where codigo = ${ADMIN_DEALERSHIP_CODIGO}`;
  const dealership_id = deal?.id ?? null;

  const [row] = await sql`
    insert into public.profiles ${sql({ email: ADMIN_EMAIL, full_name: ADMIN_NAME, role: 'admin', password_hash, dealership_id })}
    on conflict (email) do update set
      full_name     = excluded.full_name,
      role          = 'admin',
      password_hash = excluded.password_hash,
      dealership_id = coalesce(excluded.dealership_id, public.profiles.dealership_id)
    returning id, email, role, dealership_id, (xmax = 0) as inserted
  `;

  console.log(`✅ admin ${row.inserted ? 'criado' : 'atualizado'}:`);
  console.log(`   id: ${row.id}`);
  console.log(`   email: ${row.email}`);
  // Só ecoa a senha padrão de demonstração; uma senha vinda de ADMIN_PASSWORD não vai pro log.
  console.log(`   senha: ${process.env.ADMIN_PASSWORD ? '(a definida em ADMIN_PASSWORD)' : ADMIN_PASSWORD}`);
  console.log(`   role: ${row.role}`);
  console.log(`   dealership: ${dealership_id ? `${ADMIN_DEALERSHIP_CODIGO} (${dealership_id})` : '(nenhuma)'}`);
} catch (err) {
  console.error('❌ erro ao criar admin:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
