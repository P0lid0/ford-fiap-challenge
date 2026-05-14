#!/usr/bin/env node
/** Cria usuário admin de demo + linka ele à dealership FD001. */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = join(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = 'admin@3amit.com.br';
const ADMIN_PASSWORD = 'Ford2026!';

// 1. Cria usuário
console.log(`🔑 criando ${ADMIN_EMAIL}...`);
const { data: existing } = await sb.auth.admin.listUsers();
const found = existing.users.find(u => u.email === ADMIN_EMAIL);
let userId;
if (found) {
  userId = found.id;
  console.log(`   já existe (${userId})`);
} else {
  const { data, error } = await sb.auth.admin.createUser({
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Admin 3am IT' },
  });
  if (error) throw error;
  userId = data.user.id;
  console.log(`   criado (${userId})`);
}

// 2. Pega FD001
const { data: deal } = await sb.from('dealerships').select('id').eq('codigo', 'FD001').single();
if (!deal) throw new Error('dealership FD001 não encontrada');

// 3. Update profile (trigger handle_new_user já criou)
const { error: upErr } = await sb.from('profiles').update({
  role: 'admin',
  dealership_id: deal.id,
  full_name: 'Admin 3am IT',
}).eq('id', userId);
if (upErr) throw upErr;

console.log(`✅ admin pronto:`);
console.log(`   email: ${ADMIN_EMAIL}`);
console.log(`   senha: ${ADMIN_PASSWORD}`);
console.log(`   role: admin`);
console.log(`   dealership: FD001 (${deal.id})`);
