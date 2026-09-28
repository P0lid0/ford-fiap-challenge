/**
 * Gerenciamento de chaves de API e modelos por função.
 *
 * Autorização:
 *   - /admin/ai-keys/**           → só perfil admin (segredos do sistema)
 *   - /admin/ai-models            → qualquer usuário autenticado (catálogo)
 *   - /admin/ai-function-models/** → qualquer usuário autenticado
 *                                   (preferência do PRÓPRIO usuário, filtrada por user_id)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authorize, requireUser } from '../plugins/auth.js';
import { adminClient } from '../lib/supabase.js';
import { AVAILABLE_MODELS, clearKeyCache, getApiKey, type Provider } from '../lib/ai.js';
import { logAudit } from '../lib/audit.js';

const PROVIDERS = [
  'openai', 'anthropic', 'gemini',     // LLMs
  'fipe', 'vehicle411',                // Dados de veículos
  'resend', 'email_from',              // E-mail real pras ações de retenção (D2)
] as const;

export async function aiConfigRoutes(app: FastifyInstance) {
  // === Status das chaves (não retorna os valores!) ===
  app.get('/admin/ai-keys', {
    onRequest: [authorize('admin')],
    schema: { tags: ['Admin · IA'], summary: 'Status de cada provedor (configurado?) — admin' },
  }, async () => {

    const status: Record<string, { configured: boolean; source: 'env' | 'db' | 'none' }> = {};
    // Providers "não-IA" (FIPE, 411) usam env var dedicada + lookup direto no DB.
    const nonAiEnvMap: Record<string, string> = {
      fipe: 'FIPE_API_TOKEN',
      vehicle411: 'VEHICLE411_API_KEY',
    };
    for (const p of PROVIDERS) {
      let k = '';
      let fromEnv = false;
      if (p in nonAiEnvMap) {
        const { adminClient } = await import('../lib/supabase.js');
        const envTok = process.env[nonAiEnvMap[p]!] || '';
        if (envTok) { k = envTok; fromEnv = true; }
        else {
          const { data } = await adminClient().from('ai_keys').select('api_key').eq('provider', p).maybeSingle();
          k = data?.api_key ?? '';
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
      };
    }
    return status;
  });

  // === Definir/atualizar chave de um provedor ===
  app.put('/admin/ai-keys/:provider', {
    onRequest: [authorize('admin')],
    schema: {
      tags: ['Admin · IA'],
      summary: 'Define ou atualiza a chave de API de um provedor — admin',
      params: z.object({ provider: z.enum(PROVIDERS) }),
      body: z.object({ api_key: z.string().min(10) }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { provider } = req.params as any;
    const { api_key } = req.body as any;
    const { error } = await adminClient().from('ai_keys').upsert({
      provider, api_key, updated_by: u.id, updated_at: new Date().toISOString(),
    });
    if (error) throw error; // falha de banco → 500 (detalhe só no log)
    clearKeyCache();
    if (provider === 'fipe') {
      const { clearFipeTokenCache } = await import('../lib/data-sources/fipe.js');
      clearFipeTokenCache();
    }
    if (provider === 'vehicle411') {
      const { clear411TokenCache } = await import('../lib/data-sources/vehicle-411.js');
      clear411TokenCache();
    }
    await logAudit({
      actor_id: u.id, action: 'ai_key.updated', entity: 'ai_keys', entity_id: provider,
      metadata: { provider }, ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);
    return { ok: true, provider };
  });

  // === Remover chave ===
  app.delete('/admin/ai-keys/:provider', {
    onRequest: [authorize('admin')],
    schema: {
      tags: ['Admin · IA'],
      summary: 'Remove a chave armazenada no DB (env continua se houver) — admin',
      params: z.object({ provider: z.enum(PROVIDERS) }),
    },
  }, async (req, reply) => {
    const { provider } = req.params as any;
    const { error } = await adminClient().from('ai_keys').delete().eq('provider', provider);
    if (error) {
      req.log.error({ err: error, provider }, 'failed to delete AI provider key');
      reply.code(400);
      return { error: 'delete_failed' };
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
    return reply.code(204).send();
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
  }, async (req) => {
    const u = requireUser(req);
    const { fn } = req.params as any;
    const { model_id } = req.body as any;
    const { error } = await adminClient().from('ai_function_models').upsert({
      user_id: u.id, function_name: fn, model_id, updated_at: new Date().toISOString(),
    });
    if (error) throw error; // falha de banco → 500 (detalhe só no log)
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
    return reply.code(204).send();
  });
}
