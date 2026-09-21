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
import { sql } from '../lib/db.js';
import type { Fragment } from '../lib/scope.js';
import { fipe } from '../lib/data-sources/fipe.js';
import { SUPPORTED_MANUFACTURER_BRANDS, fetchManufacturerSpecs } from '../lib/data-sources/manufacturer.js';
import { aggregateVehicle } from '../lib/data-sources/aggregator.js';
import { extractFromFile } from '../lib/ai-vision.js';

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

/**
 * Colunas de `vehicles` que o upsert manual/lote envia. No `on conflict`
 * atualizamos todas as colunas do payload (exceto `hash_dedupe`, que é gerada) —
 * mesmo comportamento do antigo `upsert(..., { onConflict: 'hash_dedupe' })`.
 */
function excludedSet(cols: string[]): Fragment {
  return cols.reduce<Fragment>(
    (acc, c, i) => (i === 0 ? sql`${sql(c)} = excluded.${sql(c)}` : sql`${acc}, ${sql(c)} = excluded.${sql(c)}`),
    sql``,
  );
}

/** Mensagem que o PostgREST devolvia quando `.single()` não encontrava exatamente 1 linha. */
const SINGLE_ROW_MSG = 'JSON object requested, multiple (or no) rows returned';

/** Remove chaves `undefined` (o driver recusa undefined como parâmetro). */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

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
    // Catálogo é leitura livre pra qualquer autenticado (sem filtro de dealership).
    let data;
    try {
      [data] = await sql`select * from public.vehicles where id = ${id}`;
    } catch (err) {
      req.log.warn({ err }, '[get vehicle] query failed');
    }
    if (!data) { reply.code(404); return { error: 'not_found' }; }
    return data;
  });

  // === DELETE veículo ===
  app.delete('/competitive/vehicles/:id', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Remove veículo do catálogo (apenas admin/gestor)',
      params: z.object({ id: z.string().uuid() }),
    },
  }, async (req, reply) => {
    const u = requireUser(req);
    if (u.role !== 'admin' && u.role !== 'gestor') {
      reply.code(403);
      return { error: 'forbidden', message: `role '${u.role}' não pode excluir (precisa admin ou gestor)` };
    }
    const { id } = req.params as any;
    let count: number;
    try {
      const deleted = await sql`delete from public.vehicles where id = ${id} returning 1`;
      count = deleted.length;
    } catch (error: any) {
      req.log.error({ err: error }, '[delete vehicle] db error');
      reply.code(400);
      return { error: 'delete_failed', message: error.message, hint: error.hint, code: error.code };
    }
    if (count === 0) {
      reply.code(404);
      return { error: 'not_found', message: 'veículo já não existe' };
    }
    return { ok: true, deleted: id };
  });

  // === REFRESH: re-roda agregador, atualiza tudo no banco ===
  app.post('/competitive/vehicles/:id/refresh', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Reanalisa o veículo (re-busca FIPE + e-book + site oficial + IA)',
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        ebook_url: z.string().url().optional(), // URL custom do PDF do e-book oficial
        skip_ebook: z.boolean().optional(),     // pula extração ($) mesmo se houver registry
      }).optional(),
    },
  }, async (req, reply) => {
    requireUser(req);
    const { id } = req.params as any;
    const body = (req.body ?? {}) as any;
    // O antigo `.single()` ignorava o erro e caía no 404; mantemos isso.
    let existing;
    try {
      [existing] = await sql`select * from public.vehicles where id = ${id}`;
    } catch (err) {
      req.log.warn({ err }, '[refresh] query failed');
    }
    if (!existing) { reply.code(404); return { error: 'not_found' }; }

    const aggregated = await aggregateVehicle({
      marca: existing.marca, modelo: existing.modelo,
      versao: existing.versao, ano: existing.ano,
      ebookUrl: body.ebook_url,
      skipEbook: body.skip_ebook,
    });
    if (!aggregated) { reply.code(404); return { error: 'no_data', message: 'nenhuma fonte retornou dados' }; }

    // Mantém verificações manuais — só sobrescreve campos NÃO marcados como manual.
    const oldSources = (existing.data_sources ?? {}) as Record<string, string>;
    const keepManual = (path: string) => oldSources[path] === 'manual';

    const mergeKeep = (oldVal: any, newVal: any, group: string, key: string) =>
      keepManual(`${group}.${key}`) ? oldVal : newVal;

    const motor = Object.fromEntries(
      Object.entries(aggregated.motor).map(([k, v]) => [k, mergeKeep(existing.motor?.[k], v, 'motor', k)])
    );
    const dimensoes = Object.fromEntries(
      Object.entries(aggregated.dimensoes).map(([k, v]) => [k, mergeKeep(existing.dimensoes?.[k], v, 'dimensoes', k)])
    );
    const transmissao = Object.fromEntries(
      Object.entries(aggregated.transmissao).map(([k, v]) => [k, mergeKeep(existing.transmissao?.[k], v, 'transmissao', k)])
    );
    const desempenho = Object.fromEntries(
      Object.entries(aggregated.desempenho).map(([k, v]) => [k, mergeKeep(existing.desempenho?.[k], v, 'desempenho', k)])
    );

    // Preserva data_sources manuais
    const newSources = { ...aggregated.data_sources };
    for (const [k, v] of Object.entries(oldSources)) if (v === 'manual') newSources[k] = 'manual';

    const patch = compact({
      categoria: aggregated.categoria,
      motor, dimensoes, transmissao, desempenho,
      equipamentos: aggregated.equipamentos,
      preco_brl: aggregated.preco_brl,
      pais_origem: aggregated.pais_origem,
      fontes: aggregated.fontes,
      data_sources: newSources,
      fipe_codigo: aggregated.fipe_codigo,
      fipe_mes_referencia: aggregated.fipe_mes_referencia,
      confianca_geral: aggregated.confianca_geral,
    });

    let data;
    try {
      [data] = await sql`
        update public.vehicles set ${sql(patch)}
        where id = ${id}
        returning *
      `;
    } catch (err: any) {
      reply.code(400); return { error: 'update_failed', message: err.message };
    }
    // `.single()` sem linha (veículo sumiu entre o select e o update) era 400.
    if (!data) { reply.code(400); return { error: 'update_failed', message: SINGLE_ROW_MSG }; }
    return data;
  });

  // === FIPE DRILLDOWN — escolha em cascata ===
  app.get('/competitive/fipe/modelos-agrupados/:marcaCodigo', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Lista modelos FIPE agrupados por nome base (Ranger, Corolla, etc.)',
      params: z.object({ marcaCodigo: z.string() }),
    },
  }, async (req) => {
    requireUser(req);
    const { marcaCodigo } = req.params as any;
    const modelos = await fipe.modelos(marcaCodigo);
    // Agrupa por primeira palavra do nome (ex: "Ranger Raptor 3.0..." → "Ranger")
    const groups = new Map<string, { base: string; versoes: { codigo: number; nome: string }[] }>();
    for (const m of modelos) {
      const base = m.nome.split(/\s+/)[0]!.trim();
      const existing = groups.get(base.toLowerCase()) ?? { base, versoes: [] };
      existing.versoes.push(m);
      groups.set(base.toLowerCase(), existing);
    }
    return Array.from(groups.values())
      .map(g => ({ ...g, count: g.versoes.length }))
      .sort((a, b) => a.base.localeCompare(b.base));
  });

  app.get('/competitive/fipe/anos', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Lista anos disponíveis para um modelo FIPE específico (>= 2010)',
      querystring: z.object({ marcaCodigo: z.string(), modeloCodigo: z.string() }),
    },
  }, async (req) => {
    requireUser(req);
    const { marcaCodigo, modeloCodigo } = req.query as any;
    const anos = await fipe.anos(marcaCodigo, modeloCodigo);
    return anos
      .filter(a => /^\d{4}-\d$/.test(a.codigo))
      .filter(a => parseInt(a.codigo.slice(0, 4)) >= 2010)
      .sort((a, b) => b.codigo.localeCompare(a.codigo));
  });

  // ====================================================================
  // REFRESH SÓ DO PREÇO — só FIPE, rápido, barato, sem mexer em mais nada
  // Endpoint dedicado pra "atualizar preço": muitos veículos vêm sem preço
  // ou com preço de meses atrás. Esta rota só busca o valor FIPE atual
  // e atualiza preco_brl + fipe_codigo + fipe_mes_referencia.
  // ====================================================================
  app.post('/competitive/vehicles/:id/refresh-price', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Atualiza apenas o preço (FIPE) do veículo — sem mexer em specs',
      params: z.object({ id: z.string().uuid() }),
    },
  }, async (req, reply) => {
    requireUser(req);
    const { id } = req.params as any;

    // Erro de banco propaga (antes era `throw vErr`); 0 linhas → 404.
    const [vehicle] = await sql`
      select id, marca, modelo, versao, ano, preco_brl, fipe_codigo, fipe_mes_referencia, data_sources
      from public.vehicles
      where id = ${id}
    `;
    if (!vehicle) { reply.code(404); return { error: 'not_found' }; }

    // 1. Tenta a busca completa FIPE (marca + modelo+versao + ano)
    let fipeResult;
    try {
      const query = `${vehicle.modelo} ${vehicle.versao}`.trim();
      fipeResult = await fipe.findVehicle(vehicle.marca, query, vehicle.ano);
    } catch (e: any) {
      req.log.warn({ err: e, vehicle: vehicle.id }, '[refresh-price] FIPE lookup failed');
      reply.code(502);
      return {
        error: 'fipe_unavailable',
        message: `Não consegui consultar FIPE: ${e.message}`,
      };
    }

    if (!fipeResult) {
      reply.code(404);
      return {
        error: 'not_in_fipe',
        message: `FIPE não tem essa combinação cadastrada (${vehicle.marca} ${vehicle.modelo} ${vehicle.versao} ${vehicle.ano}).`,
      };
    }

    const novoPreco = fipe.parseValor(fipeResult.Valor);
    const precoAntigo = vehicle.preco_brl;

    // 2. Atualiza só os campos relacionados a preço/FIPE
    const novasFontes = { ...(vehicle.data_sources ?? {}) };
    novasFontes.preco_brl = 'fipe';

    const patch = {
      preco_brl: novoPreco,
      fipe_codigo: fipeResult.CodigoFipe,
      fipe_mes_referencia: fipeResult.MesReferencia,
      data_sources: novasFontes,
    };
    let data;
    try {
      [data] = await sql`
        update public.vehicles set ${sql(patch)}
        where id = ${id}
        returning id, marca, modelo, versao, ano, preco_brl, fipe_codigo, fipe_mes_referencia, data_sources
      `;
    } catch (err: any) {
      reply.code(400); return { error: 'update_failed', message: err.message };
    }
    if (!data) { reply.code(400); return { error: 'update_failed', message: SINGLE_ROW_MSG }; }

    return {
      ok: true,
      preco_antigo: precoAntigo,
      preco_novo: novoPreco,
      diff: precoAntigo != null ? novoPreco - precoAntigo : null,
      mes_referencia: fipeResult.MesReferencia,
      fipe_codigo: fipeResult.CodigoFipe,
      vehicle: data,
    };
  });

  // === SEARCH via códigos FIPE diretos — confiabilidade máxima ===
  app.post('/competitive/search/fipe', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Busca com códigos FIPE específicos (sem fuzzy match)',
      body: z.object({
        marca_codigo: z.string(),
        modelo_codigo: z.coerce.string(),
        ano_codigo: z.string().regex(/^\d{4}-\d$/),
      }),
    },
  }, async (req, reply) => {
    requireUser(req);
    const { marca_codigo, modelo_codigo, ano_codigo } = req.body as any;

    // 1. Busca preço FIPE direto pelos códigos (100% determinístico)
    let fipeData;
    try {
      fipeData = await fipe.preco(marca_codigo, modelo_codigo, ano_codigo);
    } catch (e: any) {
      reply.code(404); return { error: 'fipe_failed', message: e.message };
    }

    const anoInt = parseInt(ano_codigo.slice(0, 4));
    // Parse modelo: "Ranger Raptor 3.0 V6 Bi-Turbo 4WD AUT." → modelo="Ranger", versao="Raptor 3.0 V6 Bi-Turbo 4WD AUT."
    const modeloPartes = fipeData.Modelo.split(/\s+/);
    const modeloBase = modeloPartes[0] ?? fipeData.Modelo;
    const versao = modeloPartes.slice(1).join(' ') || 'Padrão';

    // 2. Verifica cache — o antigo `.maybeSingle()` só devolvia dado com
    // exatamente 1 linha (2+ virava erro ignorado → seguia pro agregador).
    const cached = await sql`
      select * from public.vehicles
      where fipe_codigo = ${fipeData.CodigoFipe} and ano = ${anoInt}
      limit 2
    `;
    const existing = cached.length === 1 ? cached[0] : undefined;
    if (existing) return { source: 'cache', vehicle: existing };

    // 3. Roda agregador com dados FIPE já em mãos (manufacturer + IA pra gaps)
    const u = requireUser(req);
    let aiModel = req.headers['x-ai-model'] as string | undefined;
    if (!aiModel) {
      // PK (user_id, function_name) → no máximo 1 linha.
      const [pref] = await sql<{ model_id: string }[]>`
        select model_id from public.ai_function_models
        where user_id = ${u.id} and function_name = 'vehicle_search'
      `;
      aiModel = pref?.model_id;
    }
    const [prefExtract] = await sql<{ model_id: string }[]>`
      select model_id from public.ai_function_models
      where user_id = ${u.id} and function_name = 'manufacturer_extract'
    `;
    const aggregated = await aggregateVehicle({
      marca: fipeData.Marca, modelo: modeloBase, versao, ano: anoInt,
      aiModel, manufacturerAiModel: prefExtract?.model_id,
    });
    if (!aggregated) {
      reply.code(404); return { error: 'no_data' };
    }

    const row = compact({
      marca: aggregated.marca, modelo: aggregated.modelo, versao: aggregated.versao,
      ano: aggregated.ano, categoria: aggregated.categoria,
      motor: aggregated.motor, dimensoes: aggregated.dimensoes,
      transmissao: aggregated.transmissao, desempenho: aggregated.desempenho,
      equipamentos: aggregated.equipamentos,
      preco_brl: aggregated.preco_brl, pais_origem: aggregated.pais_origem,
      fontes: aggregated.fontes, data_sources: aggregated.data_sources,
      fipe_codigo: aggregated.fipe_codigo, fipe_mes_referencia: aggregated.fipe_mes_referencia,
      confianca_geral: aggregated.confianca_geral,
    });
    const cols = Object.keys(row);

    let data;
    try {
      [data] = await sql`
        insert into public.vehicles ${sql(row)}
        on conflict (hash_dedupe) do update set ${excludedSet(cols)}
        returning *
      `;
    } catch (err: any) {
      reply.code(400); return { error: 'upsert_failed', message: err.message };
    }
    return { source: 'fresh', vehicle: data };
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

    const row = {
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
    };
    const cols = Object.keys(row);

    let data;
    try {
      [data] = await sql`
        insert into public.vehicles ${sql(row)}
        on conflict (hash_dedupe) do update set ${excludedSet(cols)}
        returning *
      `;
    } catch (error: any) {
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
    const updates = compact(req.body as Record<string, unknown>) as any;

    // Marca campos modificados como `manual` em data_sources
    // (antes o erro/ausência era ignorado aqui e o update abaixo é que falhava).
    let current;
    try {
      [current] = await sql`select data_sources from public.vehicles where id = ${id}`;
    } catch (err) {
      req.log.warn({ err }, '[patch vehicle] query failed');
    }
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

    const patch = {
      ...updates,
      data_sources: newSources,
      verificado_manualmente: true,
      verificado_por: u.id,
      verificado_em: new Date().toISOString(),
      editado_por: u.id,
      editado_em: new Date().toISOString(),
      confianca_geral: 'alta',
    };

    let data;
    try {
      [data] = await sql`
        update public.vehicles set ${sql(patch)}
        where id = ${id}
        returning *
      `;
    } catch (err: any) {
      reply.code(400);
      return { error: 'update_failed', message: err.message };
    }
    // `.single()` sem linha (id inexistente) era 400 update_failed, não 404.
    if (!data) { reply.code(400); return { error: 'update_failed', message: SINGLE_ROW_MSG }; }
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
              if (!g || !k) return;
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

    // marca/modelo ausentes viram null (como o PostgREST fazia) → not-null do banco → 400.
    const rows = items.map((it: any) => ({
      marca: it.marca ?? null,
      modelo: it.modelo ?? null,
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
      // Preserva fontes/data_sources se o payload trouxer (ex: import oficial Ford);
      // senão marca como import genérico.
      fontes: Array.isArray(it.fontes) && it.fontes.length ? it.fontes : ['import'],
      data_sources: it.data_sources ?? { _all: 'import' },
      notas: it.notas ?? null,
      verificado_manualmente: it.verificado_manualmente ?? true,
      verificado_por: u.id,
      verificado_em: new Date().toISOString(),
      confianca_geral: it.confianca_geral ?? 'alta',
    }));

    // Upsert em lote: todas as linhas têm as mesmas chaves (montadas acima).
    const cols = Object.keys(rows[0]!);
    let data: any[];
    try {
      data = await sql`
        insert into public.vehicles ${sql(rows)}
        on conflict (hash_dedupe) do update set ${excludedSet(cols)}
        returning *
      `;
    } catch (err: any) {
      reply.code(400);
      return { error: 'import_failed', message: err.message };
    }
    return { inserted: data?.length ?? 0, vehicles: data ?? [] };
  });

  // === EXTRAÇÃO de PDF/imagem via IA multimodal (e-books, brochuras, fichas) ===
  // Aceita multipart upload de PDF/PNG/JPG, manda pro Anthropic/OpenAI vision,
  // retorna preview de veículos detectados. Front decide quais persistir.
  app.post('/competitive/import/file', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Upload PDF/imagem (e-book de carro) → IA extrai veículos + specs',
      consumes: ['multipart/form-data'],
    },
  }, async (req, reply) => {
    requireUser(req);
    const file = await (req as any).file();
    if (!file) {
      reply.code(400);
      return { error: 'no_file', message: 'envie um arquivo via multipart/form-data' };
    }

    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      reply.code(400);
      return { error: 'unsupported_type', message: `tipo ${file.mimetype} não suportado. Use PDF, PNG, JPG ou WEBP.` };
    }

    const buf = await file.toBuffer();
    if (buf.length === 0) {
      reply.code(400);
      return { error: 'empty_file', message: 'arquivo vazio' };
    }

    const EXTRACT_SYSTEM = `Você é EXTRATOR LITERAL de specs automotivos a partir de e-books, brochuras
e fichas técnicas em PT-BR ou EN. Os dados vão pro cliente final tomar DECISÃO DE COMPRA —
informação errada quebra a confiança e custa venda.

REGRA DE OURO: **PREFIRA null A CHUTAR.** Se não vê literalmente no documento, valor = null.

REGRAS:
- Responda APENAS com JSON válido. Sem markdown.
- Múltiplas versões/trims (ex: F-150 XL, XLT, Lariat) → UM ITEM POR VERSÃO no array.
- Para cada versão: SÓ equipamentos de SÉRIE. Marcações "opcional" → fora.
- Itens listados pra OUTRA versão → não atribua a esta versão.
- NÃO use conhecimento prévio do modelo. Você é PARSER, não analista.
- Equipamentos: liste APENAS o que está literalmente mencionado pra essa versão.
  Quantidade = o que tiver no documento. 10 reais > 30 inventados.
- Unidades: cc, cv, Nm, mm, kg, km/h, km/l, L.
- combustivel ∈ [gasolina, etanol, flex, diesel, diesel_s10, eletrico, hibrido, hibrido_plugin, gnv]
- categoria ∈ [hatch, sedan, suv, picape_compacta, picape_media, picape_grande, minivan, cupe, conversivel, comercial]

EQUIPAMENTOS — formato "categoria:item_snake_case":
Categorias: seguranca, conforto, tecnologia, assistencia, interior, exterior, cargo (picape), offroad (4x4)

Formato da resposta:
{
  "veiculos": [
    {
      "marca": str,
      "modelo": str,
      "versao": str,
      "ano": int|null,
      "categoria": str|null,
      "motor": { "cilindrada_cc": int|null, "potencia_cv": int|null, "torque_nm": int|null,
                 "combustivel": str|null, "aspiracao": str|null, "cilindros": int|null },
      "dimensoes": { "comprimento_mm": int|null, "largura_mm": int|null, "altura_mm": int|null,
                     "entre_eixos_mm": int|null, "vao_livre_mm": int|null, "peso_kg": int|null,
                     "capacidade_porta_malas_l": int|null, "capacidade_cacamba_l": int|null,
                     "capacidade_carga_kg": int|null, "capacidade_reboque_kg": int|null },
      "transmissao": { "tipo": str|null, "marchas": int|null, "tracao": str|null },
      "desempenho": { "aceleracao_0_100_s": float|null, "velocidade_max_kmh": int|null,
                      "consumo_cidade_kml": float|null, "consumo_estrada_kml": float|null,
                      "autonomia_km": int|null },
      "equipamentos": ["categoria:item_snake_case", ...],
      "preco_brl": int|null,
      "pais_origem": str|null
    }
  ]
}`;

    const userPrompt = `Analise este documento e extraia TODAS as versões/trims presentes.
- 1 item por versão em "veiculos[]"
- Equipamentos: SÓ os que aparecem listados pra essa versão como SÉRIE
- "Opcional" → fora
- Dúvida → null ou lista vazia
- O cliente vai usar isso pra DECIDIR COMPRA: dado inventado quebra a confiança`;

    let extracted: any;
    let provider: string;
    let model: string;
    try {
      const r = await extractFromFile(
        { mediaType: file.mimetype as any, data: buf, filename: file.filename },
        EXTRACT_SYSTEM,
        userPrompt,
        { maxTokens: 8000 }, // documentos com muitas versões precisam de espaço
      );
      provider = r.provider;
      model = r.model;
      const cleaned = r.output.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      extracted = JSON.parse(cleaned);
    } catch (e: any) {
      req.log.error({ err: e }, '[import/file] extraction failed');
      reply.code(502);
      return { error: 'extraction_failed', message: e.message };
    }

    const veiculos = Array.isArray(extracted?.veiculos) ? extracted.veiculos : [];
    if (veiculos.length === 0) {
      reply.code(422);
      return { error: 'no_vehicles_found', message: 'A IA não encontrou veículos no documento.' };
    }

    return {
      filename: file.filename,
      mime: file.mimetype,
      size_bytes: buf.length,
      extracted_by: `${provider}:${model}`,
      count: veiculos.length,
      veiculos, // o front mostra preview e o user escolhe quais persistir via /competitive/vehicles/import
    };
  });
}
