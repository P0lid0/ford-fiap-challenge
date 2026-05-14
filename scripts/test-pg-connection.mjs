#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = join(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
const sbSecret = process.env.SUPABASE_SECRET;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

const candidates = [
  { name: 'DATABASE_URL', url: process.env.DATABASE_URL },
  // Direct connection
  { name: 'direct + DB_PASSWORD', url: dbPassword && `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${ref}.supabase.co:5432/postgres` },
  { name: 'direct + sb_secret', url: sbSecret && `postgresql://postgres:${encodeURIComponent(sbSecret)}@db.${ref}.supabase.co:5432/postgres` },
  // Pooler in known SA regions
  ...['sa-east-1', 'us-east-1', 'us-east-2', 'us-west-1', 'eu-west-1', 'ap-southeast-1'].flatMap(reg => [
    sbSecret && { name: `pooler ${reg} + sb_secret`, url: `postgresql://postgres.${ref}:${encodeURIComponent(sbSecret)}@aws-0-${reg}.pooler.supabase.com:6543/postgres` },
    dbPassword && { name: `pooler ${reg} + DB_PASSWORD`, url: `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-${reg}.pooler.supabase.com:6543/postgres` },
  ]).filter(Boolean),
];

for (const c of candidates) {
  if (!c?.url) continue;
  process.stdout.write(`[try] ${c.name} ... `);
  try {
    const sql = postgres(c.url, { ssl: 'require', max: 1, prepare: false, idle_timeout: 2, connect_timeout: 6 });
    const r = await sql`select current_user, current_database()`;
    console.log('✅', r[0]);
    console.log('\n>>> CONNECTION_STRING_THAT_WORKED: name=' + c.name);
    await sql.end();
    process.exit(0);
  } catch (e) {
    console.log('❌', e.message?.split('\n')[0]?.slice(0, 90));
  }
}
console.log('\n❌ Nenhuma combinação funcionou.');
process.exit(1);
