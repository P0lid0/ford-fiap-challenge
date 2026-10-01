#!/usr/bin/env node
/**
 * Cria ou atualiza um usuário da aplicação em public.profiles
 * (autenticação local da API — não existe rota de cadastro).
 *
 * Upsert por e-mail. Argumentos:
 *   --email <e-mail>            (obrigatório)
 *   --password <senha>          (obrigatório; ou env USER_PASSWORD para não ir no histórico do shell)
 *   --role <analista|gestor|admin>   (default: analista)
 *   --dealership <codigo>       código da concessionária (ex.: FD001); obrigatório para
 *                               analista e gestor, opcional para admin
 *   --name <nome completo>      (opcional)
 *
 * Exemplo:
 *   node scripts/db-create-user.mjs --email ana@faroai.com.br --password 'Troque#123' --role analista --dealership FD001
 */
import { parseArgs } from 'node:util';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { databaseUrl } from './lib/env.mjs';

const BCRYPT_COST = 12; // mesmo custo de apps/api/src/lib/identity.ts
const ROLES = ['analista', 'gestor', 'admin'];

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    role: { type: 'string', default: 'analista' },
    dealership: { type: 'string' },
    name: { type: 'string' },
  },
});

function fail(message) {
  console.error(`❌ ${message}`);
  console.error('   uso: node scripts/db-create-user.mjs --email <e-mail> --password <senha> [--role analista|gestor|admin] [--dealership <codigo>] [--name <nome>]');
  process.exit(1);
}

const email = (values.email ?? '').trim().toLowerCase();
const password = values.password ?? process.env.USER_PASSWORD ?? '';
const role = values.role;

if (!email || !email.includes('@')) fail('informe --email com um e-mail válido');
if (password.length < 8) fail('informe --password (ou USER_PASSWORD) com pelo menos 8 caracteres');
if (!ROLES.includes(role)) fail(`--role inválido: ${role} (use ${ROLES.join(', ')})`);
if (role !== 'admin' && !values.dealership) fail(`perfil '${role}' precisa de --dealership <codigo>`);

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

try {
  let dealership_id = null;
  if (values.dealership) {
    const [deal] = await sql`select id from public.dealerships where codigo = ${values.dealership}`;
    if (!deal) throw new Error(`concessionária '${values.dealership}' não encontrada`);
    dealership_id = deal.id;
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_COST);
  const full_name = values.name ?? null;

  const [row] = await sql`
    insert into public.profiles ${sql({ email, full_name, role, password_hash, dealership_id })}
    on conflict (email) do update set
      full_name     = coalesce(excluded.full_name, public.profiles.full_name),
      role          = excluded.role,
      password_hash = excluded.password_hash,
      dealership_id = excluded.dealership_id
    returning id, email, role, dealership_id, (xmax = 0) as inserted
  `;

  console.log(`✅ usuário ${row.inserted ? 'criado' : 'atualizado'}:`);
  console.log(`   id: ${row.id}`);
  console.log(`   email: ${row.email}`);
  console.log(`   role: ${row.role}`);
  console.log(`   dealership: ${values.dealership ? `${values.dealership} (${row.dealership_id})` : '(nenhuma)'}`);
} catch (err) {
  console.error('❌ erro ao criar usuário:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
