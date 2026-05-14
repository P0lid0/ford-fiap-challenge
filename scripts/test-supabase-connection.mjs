#!/usr/bin/env node
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

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('URL:', url);
console.log('Key length:', key?.length);

const sb = createClient(url, key);

// Tenta acessar uma tabela do schema padrão (vai falhar se schema vazio, mas mostra que conecta)
const { data, error } = await sb.from('profiles').select('*').limit(1);
console.log('profiles query:', { error: error?.message, hasData: !!data });

// Vamos tentar usar a função de execução de SQL via PostgREST (não existe por default)
const { data: authData, error: authErr } = await sb.auth.admin.listUsers();
console.log('auth admin:', { error: authErr?.message, userCount: authData?.users?.length });
