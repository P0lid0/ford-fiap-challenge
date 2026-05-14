/**
 * Rotas administrativas para o catálogo de veículos.
 * - GET /competitive/marcas          → lista de marcas FIPE (combobox)
 * - GET /competitive/marcas/manufacturer → quais marcas têm scraping oficial
 * - POST /competitive/vehicles       → cria manualmente
 * - PATCH /competitive/vehicles/:id  → edita campo a campo (verifica humano)
 * - POST /competitive/vehicles/import → upload CSV/JSON em lote
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../plugins/auth.js';
import { adminClient } from '../lib/supabase.js';
import { fipe } from '../lib/data-sources/fipe.js';
import { SUPPORTED_MANUFACTURER_BRANDS } from '../lib/data-sources/manufacturer.js';

const VehicleUpdateSchema = z.object({
  marca: z.string().optional(),
  modelo: z.string().optional(),
  versao: z.string().optional(),
  ano: z.number().int().optional(),
  categoria: z.string().optional(),
  motor: z.record(z.any()).optional(),
  dimensoes: z.record(z.any()).optional(),
  transmissao: z.record(z.any()).optional(),
  desempenho: z.record(z.any()).optional(),
  equipamentos: z.array(z.string()).optional(),
  preco_brl: z.number().int().nullable().optional(),
  pais_origem: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  verificado_manualmente: z.boolean().optional(),
});

const VehicleCreateSchema = VehicleUpdateSchema.extend({
  marca: z.string().min(2),
  modelo: z.string().min(1),
  versao: z.string().min(1),
  ano: z.number().int().min(1990).max(2030),
  categoria: z.string().min(2),
});

export async function adminVehicleRoutes(app: FastifyInstance) {
  // === GET individual por ID ===
  app.get('/competitive/vehicles/:id', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Retorna um veículo pelo ID',
      params: z.object({ id: z.string().uuid() }),
    },
  }, async (req, reply) => {
    requireUser(req);
    const { id } = req.params as any;
    const { data, error } = await adminClient().from('vehicles').select('*').eq('id', id).single();
    if (error || !data) { reply.code(404); return { error: 'not_found' }; }
    return data;
  });

  // === Combobox de marcas — FIPE é fonte autoritativa ===
  app.get('/competitive/marcas', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Lista marcas para combobox (FIPE oficial + flag de cobertura de scraping)',
    },
  }, async () => {
    try {
      const marcasFipe = await fipe.marcas();
      const supportedSet = new Set(SUPPORTED_MANUFACTURER_BRANDS.map(s => s.toLowerCase()));
      return marcasFipe.map(m => ({
        codigo: m.codigo,
        nome: m.nome,
        tem_scraping: supportedSet.has(m.nome.toLowerCase()),
      }));
    } catch (err: any) {
      app.log.error({ err }, 'failed to fetch FIPE marcas');
      // Fallback: lista das que sabemos que existem
      return SUPPORTED_MANUFACTURER_BRANDS.map(n => ({ codigo: '', nome: n, tem_scraping: true }));
    }
  });

  // === Criação manual ===
  app.post('/competitive/vehicles', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Cria veículo manualmente (já marcado como verificado_manualmente)',
      body: VehicleCreateSchema,
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const body = req.body as z.infer<typeof VehicleCreateSchema>;
    const sb = adminClient();

    const { data, error } = await sb.from('vehicles').upsert({
      marca: body.marca,
      modelo: body.modelo,
      versao: body.versao,
      ano: body.ano,
      categoria: body.categoria,
      motor: body.motor ?? {},
      dimensoes: body.dimensoes ?? {},
      transmissao: body.transmissao ?? {},
      desempenho: body.desempenho ?? {},
      equipamentos: body.equipamentos ?? [],
      preco_brl: body.preco_brl ?? null,
      pais_origem: body.pais_origem ?? null,
      notas: body.notas ?? null,
      fontes: ['manual'],
      data_sources: { _all: 'manual' },
      verificado_manualmente: true,
      verificado_por: u.id,
      verificado_em: new Date().toISOString(),
      editado_por: u.id,
      editado_em: new Date().toISOString(),
      confianca_geral: 'alta',
    }, { onConflict: 'hash_dedupe', ignoreDuplicates: false }).select().single();

    if (error) {
      req.log.error({ error }, 'create vehicle failed');
      reply.code(400);
      return { error: 'create_failed', message: error.message };
    }
    reply.code(201);
    return data;
  });

  // === Edição manual ===
  app.patch('/competitive/vehicles/:id', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Edita campos do veículo manualmente (e marca como verificado)',
      params: z.object({ id: z.string().uuid() }),
      body: VehicleUpdateSchema,
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const updates = req.body as any;
    const sb = adminClient();

    // Marca campos modificados como `manual` em data_sources
    const { data: current } = await sb.from('vehicles').select('data_sources').eq('id', id).single();
    const newSources = { ...(current?.data_sources ?? {}) };
    for (const k of ['marca', 'modelo', 'versao', 'ano', 'categoria', 'preco_brl', 'pais_origem']) {
      if (k in updates) newSources[k] = 'manual';
    }
    for (const group of ['motor', 'dimensoes', 'transmissao', 'desempenho'] as const) {
      if (updates[group]) {
        for (const subkey of Object.keys(updates[group])) {
          newSources[`${group}.${subkey}`] = 'manual';
        }
      }
    }
    if (updates.equipamentos) newSources['equipamentos'] = 'manual';

    const { data, error } = await sb.from('vehicles').update({
      ...updates,
      data_sources: newSources,
      verificado_manualmente: true,
      verificado_por: u.id,
      verificado_em: new Date().toISOString(),
      editado_por: u.id,
      editado_em: new Date().toISOString(),
      confianca_geral: 'alta',
    }).eq('id', id).select().single();

    if (error) {
      reply.code(400);
      return { error: 'update_failed', message: error.message };
    }
    return data;
  });

  // === Import em lote (JSON ou CSV-as-text) ===
  app.post('/competitive/vehicles/import', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Importa lista de veículos (JSON array ou CSV-text)',
      body: z.object({
        format: z.enum(['json', 'csv']),
        content: z.string().min(10),
      }),
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    const { format, content } = req.body as any;
    const sb = adminClient();

    let items: any[] = [];
    try {
      if (format === 'json') items = JSON.parse(content);
      else {
        // CSV simples: primeira linha = headers, demais = valores. Suporta motor.potencia_cv etc.
        const lines = content.split(/\r?\n/).filter((l: string) => l.trim());
        const headers = lines[0].split(',').map((h: string) => h.trim());
        items = lines.slice(1).map((line: string) => {
          const cells = line.split(',').map((c: string) => c.trim());
          const obj: any = {};
          headers.forEach((h: string, i: number) => {
            const val = cells[i];
            if (val === '' || val === 'null' || val == null) return;
            // dot-notation: motor.potencia_cv → obj.motor.potencia_cv
            if (h.includes('.')) {
              const [g, k] = h.split('.');
              if (!obj[g]) obj[g] = {};
              obj[g][k] = isNaN(Number(val)) ? val : Number(val);
            } else if (h === 'equipamentos') {
              obj[h] = val.split(';').map((s: string) => s.trim()).filter(Boolean);
            } else {
              obj[h] = isNaN(Number(val)) ? val : Number(val);
            }
          });
          return obj;
        });
      }
    } catch (e: any) {
      reply.code(400);
      return { error: 'parse_failed', message: e.message };
    }

    if (!Array.isArray(items) || items.length === 0) {
      reply.code(400);
      return { error: 'empty', message: 'nenhum item válido' };
    }

    const rows = items.map((it: any) => ({
      marca: it.marca,
      modelo: it.modelo,
      versao: it.versao ?? 'Padrão',
      ano: it.ano ?? 2025,
      categoria: it.categoria ?? 'sedan',
      motor: it.motor ?? {},
      dimensoes: it.dimensoes ?? {},
      transmissao: it.transmissao ?? {},
      desempenho: it.desempenho ?? {},
      equipamentos: it.equipamentos ?? [],
      preco_brl: it.preco_brl ?? null,
      pais_origem: it.pais_origem ?? null,
      fontes: ['import'],
      data_sources: { _all: 'import' },
      verificado_manualmente: true,
      verificado_por: u.id,
      verificado_em: new Date().toISOString(),
      confianca_geral: 'alta',
    }));

    const { data, error } = await sb.from('vehicles').upsert(rows, { onConflict: 'hash_dedupe' }).select();
    if (error) {
      reply.code(400);
      return { error: 'import_failed', message: error.message };
    }
    return { inserted: data?.length ?? 0, vehicles: data ?? [] };
  });
}
