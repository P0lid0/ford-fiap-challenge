/**
 * Gerenciamento de chaves de API e modelos por função.
 * Admin only — usa service_role no backend pra ler/escrever.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../plugins/auth.js';
import { adminClient } from '../lib/supabase.js';
import { AVAILABLE_MODELS, clearKeyCache, getApiKey, type Provider } from '../lib/ai.js';

const PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;

export async function aiConfigRoutes(app: FastifyInstance) {
  // === Status das chaves (não retorna os valores!) ===
  app.get('/admin/ai-keys', {
    schema: { tags: ['Admin · IA'], summary: 'Status de cada provedor (configurado?)' },
  }, async (req) => {
    const u = requireUser(req);
    if (u.role !== 'admin') { (req as any).reply.code(403); return { error: 'forbidden' }; }

    const status: Record<string, { configured: boolean; source: 'env' | 'db' | 'none'; preview?: string }> = {};
    for (const p of PROVIDERS) {
      const k = await getApiKey(p);
      const fromEnv = p === 'openai' ? !!process.env.OPENAI_API_KEY
                   : p === 'anthropic' ? !!process.env.ANTHROPIC_API_KEY
                   : !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
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
    const { error } = await adminClient().from('ai_keys').upsert({
      provider, api_key, updated_by: u.id, updated_at: new Date().toISOString(),
    });
    if (error) { reply.code(400); return { error: error.message }; }
    clearKeyCache();
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
    await adminClient().from('ai_keys').delete().eq('provider', provider);
    clearKeyCache();
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
    const { data } = await adminClient()
      .from('ai_function_models').select('function_name, model_id').eq('user_id', u.id);
    return data ?? [];
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
    const { error } = await adminClient().from('ai_function_models').upsert({
      user_id: u.id, function_name: fn, model_id, updated_at: new Date().toISOString(),
    });
    if (error) { reply.code(400); return { error: error.message }; }
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
    await adminClient().from('ai_function_models').delete().eq('user_id', u.id).eq('function_name', fn);
    reply.code(204);
  });
}
