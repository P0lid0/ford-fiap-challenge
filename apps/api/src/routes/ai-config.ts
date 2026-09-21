/**
 * Gerenciamento de chaves de API e modelos por função.
 * Admin only — a API acessa o banco diretamente (sem RLS); o papel é checado
 * no handler.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../plugins/auth.js';
import { sql } from '../lib/db.js';
import { AVAILABLE_MODELS, clearKeyCache, getApiKey, type Provider } from '../lib/ai.js';

const PROVIDERS = [
  'openai', 'anthropic', 'gemini',     // LLMs
  'fipe', 'vehicle411',                // Dados de veículos
  'resend', 'email_from',              // E-mail real pras ações de retenção (D2)
] as const;

export async function aiConfigRoutes(app: FastifyInstance) {
  // === Status das chaves (não retorna os valores!) ===
  app.get('/admin/ai-keys', {
    schema: { tags: ['Admin · IA'], summary: 'Status de cada provedor (configurado?)' },
  }, async (req) => {
    const u = requireUser(req);
    if (u.role !== 'admin') { (req as any).reply.code(403); return { error: 'forbidden' }; }

    const status: Record<string, { configured: boolean; source: 'env' | 'db' | 'none'; preview?: string }> = {};
    // Providers "não-IA" (FIPE, 411) usam env var dedicada + lookup direto no DB.
    const nonAiEnvMap: Record<string, string> = {
      fipe: 'FIPE_API_TOKEN',
      vehicle411: 'VEHICLE411_API_KEY',
    };
    for (const p of PROVIDERS) {
      let k = '';
      let fromEnv = false;
      if (p in nonAiEnvMap) {
        const envTok = process.env[nonAiEnvMap[p]!] || '';
        if (envTok) { k = envTok; fromEnv = true; }
        else {
          // provider é PK → no máximo 1 linha (equivale ao antigo maybeSingle).
          const [row] = await sql<{ api_key: string }[]>`
            select api_key from public.ai_keys where provider = ${p}
          `;
          k = row?.api_key ?? '';
        }
      } else {
        k = await getApiKey(p as 'openai' | 'anthropic' | 'gemini');
        fromEnv = p === 'openai' ? !!process.env.OPENAI_API_KEY
                : p === 'anthropic' ? !!process.env.ANTHROPIC_API_KEY
                : !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      }
      status[p] = {
        configured: !!k,
        source: fromEnv ? 'env' : (k ? 'db' : 'none'),
        preview: k ? `${k.slice(0, 7)}…${k.slice(-4)}` : undefined,
      };
    }
    return status;
  });

  // === Definir/atualizar chave de um provedor ===
  app.put('/admin/ai-keys/:provider', {
    schema: {
      tags: ['Admin · IA'],
      summary: 'Define ou atualiza a chave de API de um provedor',
      params: z.object({ provider: z.enum(PROVIDERS) }),
      body: z.object({ api_key: z.string().min(10) }),
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    if (u.role !== 'admin') { reply.code(403); return { error: 'forbidden' }; }
    const { provider } = req.params as any;
    const { api_key } = req.body as any;
    // Upsert pela PK (provider): atualiza todas as colunas do payload exceto a de conflito.
    const row = { provider, api_key, updated_by: u.id, updated_at: new Date().toISOString() };
    try {
      await sql`
        insert into public.ai_keys ${sql(row)}
        on conflict (provider) do update set
          api_key = excluded.api_key,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
      `;
    } catch (err) {
      reply.code(400); return { error: (err as Error).message };
    }
    clearKeyCache();
    if (provider === 'fipe') {
      const { clearFipeTokenCache } = await import('../lib/data-sources/fipe.js');
      clearFipeTokenCache();
    }
    if (provider === 'vehicle411') {
      const { clear411TokenCache } = await import('../lib/data-sources/vehicle-411.js');
      clear411TokenCache();
    }
    return { ok: true, provider, preview: `${api_key.slice(0, 7)}…${api_key.slice(-4)}` };
  });

  // === Remover chave ===
  app.delete('/admin/ai-keys/:provider', {
    schema: {
      tags: ['Admin · IA'],
      summary: 'Remove a chave armazenada no DB (env continua se houver)',
      params: z.object({ provider: z.enum(PROVIDERS) }),
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    if (u.role !== 'admin') { reply.code(403); return { error: 'forbidden' }; }
    const { provider } = req.params as any;
    await sql`delete from public.ai_keys where provider = ${provider}`;
    clearKeyCache();
    if (provider === 'fipe') {
      const { clearFipeTokenCache } = await import('../lib/data-sources/fipe.js');
      clearFipeTokenCache();
    }
    if (provider === 'vehicle411') {
      const { clear411TokenCache } = await import('../lib/data-sources/vehicle-411.js');
      clear411TokenCache();
    }
    reply.code(204);
  });

  // === Lista de modelos disponíveis ===
  app.get('/admin/ai-models', {
    schema: { tags: ['Admin · IA'], summary: 'Catálogo de modelos por provedor' },
  }, async () => AVAILABLE_MODELS);

  // === GET preferências de modelo por função (do user atual) ===
  app.get('/admin/ai-function-models', {
    schema: { tags: ['Admin · IA'], summary: 'Modelos preferidos por função (deste usuário)' },
  }, async (req) => {
    const u = requireUser(req);
    const rows = await sql<{ function_name: string; model_id: string }[]>`
      select function_name, model_id from public.ai_function_models where user_id = ${u.id}
    `;
    return rows;
  });

  // === PUT preferência de modelo de uma função ===
  app.put('/admin/ai-function-models/:fn', {
    schema: {
      tags: ['Admin · IA'],
      summary: 'Define qual modelo a função usa (formato provider:model)',
      params: z.object({ fn: z.enum([
        'vehicle_search', 'compare_analysis', 'client_insight',
        'portfolio_insight', 'manufacturer_extract',
      ]) }),
      body: z.object({ model_id: z.string().min(3) }),
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const { fn } = req.params as any;
    const { model_id } = req.body as any;
    // Upsert pela PK (user_id, function_name).
    const row = { user_id: u.id, function_name: fn, model_id, updated_at: new Date().toISOString() };
    try {
      await sql`
        insert into public.ai_function_models ${sql(row)}
        on conflict (user_id, function_name) do update set
          model_id = excluded.model_id,
          updated_at = excluded.updated_at
      `;
    } catch (err) {
      reply.code(400); return { error: (err as Error).message };
    }
    return { ok: true, function_name: fn, model_id };
  });

  app.delete('/admin/ai-function-models/:fn', {
    schema: {
      tags: ['Admin · IA'],
      summary: 'Remove preferência (volta ao padrão)',
      params: z.object({ fn: z.string() }),
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const { fn } = req.params as any;
    await sql`
      delete from public.ai_function_models
      where user_id = ${u.id} and function_name = ${fn}
    `;
    reply.code(204);
  });
}
