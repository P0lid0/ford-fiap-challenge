import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config.js';

// Cliente público: usa anon key. Respeita RLS conforme o JWT do usuário.
export function publicClient(userJwt?: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: userJwt ? { headers: { Authorization: `Bearer ${userJwt}` } } : undefined,
  });
}

// Cliente de backend: service_role ignora RLS. Use após checar papel e escopo
// do usuário, ou para tarefas internas sem usuário interativo.
let _admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
