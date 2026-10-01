import type { FastifyInstance } from 'fastify';
import { authorize, requireUser } from '../plugins/auth.js';
import { z } from 'zod';
import type postgres from 'postgres';
import { sql } from '../lib/db.js';
import { badGateway, notFound, serviceUnavailable, unprocessable } from '../lib/api-error.js';
import { compareVehicles, type Vehicle, COMPARABLE_FIELDS } from '../modules/competitive/compare.js';
import { aggregateVehicle } from '../lib/data-sources/aggregator.js';
import { chat } from '../lib/ai.js';
import { logAudit } from '../lib/audit.js';

/**
 * Rotas do Desafio 1 — Inteligência Competitiva.
 *
 * Pontos-chave:
 *   - `?fields=motor.potencia_cv,desempenho.consumo_cidade_kml` permite o
 *     usuário escolher livremente quais campos retornar (requisito Ford).
 *   - Campo ausente vem como `null` explícito.
 *   - Comparação computa winner_index por critério (max/min/none).
 *
 * Autorização: leitura/comparação → qualquer usuário autenticado (catálogo é
 * compartilhado pela rede). Editar/preencher com IA o catálogo canônico → gestor ou admin.
 *
 * Tenancy: `vehicles`, `catalog_items` e `vehicle_catalog_values` são catálogo
 * compartilhado da rede (não têm `dealership_id`), então não há filtro de escopo
 * por concessionária — a barreira é a autenticação (e `authorize` nas escritas).
 * Todas as queries são parametrizadas.
 */

/** Linha completa de `vehicles` (select *) — colunas extras além do tipo Vehicle. */
type VehicleRow = Vehicle & Record<string, any>;

/** Item do schema canônico (`catalog_items`) nas colunas usadas pelas rotas. */
type CatalogItemRow = {
  id: string;
  secao: string;
  ordem: number;
  ordem_global: number;
  nome: string;
  tipo: string;
  unidade: string | null;
  descricao?: string | null;
};

/** Linha a gravar em `vehicle_catalog_values`. */
type CatalogValueUpsert = {
  vehicle_id: string;
  item_id: string;
  valor: string;
  confianca: string;
  fonte: string;
  updated_at: string;
};

/** Padrão ILIKE como o PostgREST interpretava: `*` vira `%` (e `%`/`_` seguem como curingas). */
function likePattern(s: string): string {
  return s.replace(/\*/g, '%');
}

/**
 * Upsert em lote de `vehicle_catalog_values` (chave: vehicle_id + item_id).
 * Em conflito atualiza as colunas do payload, exceto as da chave.
 */
async function upsertCatalogValues(rows: CatalogValueUpsert[]): Promise<void> {
  await sql`
    insert into public.vehicle_catalog_values ${sql(rows, 'vehicle_id', 'item_id', 'valor', 'confianca', 'fonte', 'updated_at')}
    on conflict (vehicle_id, item_id) do update set
      valor = excluded.valor,
      confianca = excluded.confianca,
      fonte = excluded.fonte,
      updated_at = excluded.updated_at
  `;
}
export async function vehicleRoutes(app: FastifyInstance) {
  // Listagem com filtros
  app.get('/competitive/vehicles', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Lista veículos cadastrados',
      querystring: z.object({
        marca: z.string().optional(),
        modelo: z.string().optional(),
        categoria: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
    },
  }, async (req) => {
    requireUser(req);
    const { marca, modelo, categoria, limit } = req.query as any;

    const rows = await sql<VehicleRow[]>`
      select * from public.vehicles
      where true
        ${marca ? sql`and marca ilike ${likePattern(marca)}` : sql``}
        ${modelo ? sql`and modelo ilike ${likePattern(modelo)}` : sql``}
        ${categoria ? sql`and categoria = ${categoria}` : sql``}
      order by marca asc
      limit ${limit}
    `;
    return rows;
  });

  // Lookup com fields dinâmicos — requisito explícito Ford
  app.get('/competitive/lookup', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Busca veículo por (marca, modelo, versão) com seleção dinâmica de campos',
      querystring: z.object({
        marca: z.string().min(2),
        modelo: z.string().min(1),
        versao: z.string().optional(),
        ano: z.coerce.number().int().optional(),
        // Lista de campos separados por vírgula. Suporta dot-notation:
        // "motor.potencia_cv,desempenho.consumo_cidade_kml,equipamentos"
        fields: z.string().optional(),
      }),
    },
  }, async (req) => {
    requireUser(req);
    const { marca, modelo, versao, ano, fields } = req.query as any;

    const data = await sql<VehicleRow[]>`
      select * from public.vehicles
      where marca ilike ${likePattern(marca)}
        and modelo ilike ${likePattern(modelo)}
        ${versao ? sql`and versao ilike ${likePattern(versao)}` : sql``}
        ${ano ? sql`and ano = ${ano}` : sql``}
    `;
    if (data.length === 0) throw notFound('nenhum veículo combina com a busca');

    if (!fields) return data;

    const requested = fields.split(',').map((s: string) => s.trim()).filter(Boolean);
    return data.map((v: Vehicle) => projectFields(v, requested));
  });

  // Comparação 2-5 veículos
  app.post('/competitive/compare', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Compara 2-5 veículos campo a campo, com vencedor por critério',
      body: z.object({
        vehicle_ids: z.array(z.string().uuid()).min(2).max(5),
        fields: z.array(z.string()).optional(),
      }),
    },
  }, async (req) => {
    requireUser(req);
    const { vehicle_ids, fields } = req.body as any;

    const data = await sql<VehicleRow[]>`
      select * from public.vehicles where id = any(${vehicle_ids}::uuid[])
    `;
    // ids bem formados, mas que não existem no catálogo → 422
    if (data.length < 2) throw unprocessable('necessário 2 ou mais veículos existentes no catálogo', 'vehicles_not_found');

    return compareVehicles(data, fields);
  });

  // Catálogo de campos disponíveis para construir UI dinâmica
  app.get('/competitive/fields', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Lista os campos comparáveis e seus critérios',
    },
  }, async () => {
    return COMPARABLE_FIELDS.map(([label, path, criterion]) => ({ label, path, criterion }));
  });

  // ====================================================================
  // SCHEMA CANÔNICO Ford D1 (262 itens × 14 seções)
  // Endpoint pra UI montar a tabela fixa pedida no Desafio 1.
  // ====================================================================
  app.get('/competitive/catalog-items', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Schema canônico Ford D1 — 262 atributos agrupados em 14 seções',
    },
  }, async (req) => {
    requireUser(req);
    const data = await sql<CatalogItemRow[]>`
      select id, secao, ordem, ordem_global, nome, tipo, unidade, descricao
      from public.catalog_items
      order by ordem_global asc
    `;
    // agrupa por seção pra o front consumir mais fácil
    const bySection: Record<string, any[]> = {};
    for (const r of data) {
      const sec = r.secao || '(sem secao)';
      bySection[sec] ??= [];
      bySection[sec].push(r);
    }
    return {
      total: data.length,
      sections: Object.entries(bySection).map(([secao, items]) => ({
        secao,
        count: items.length,
        items,
      })),
      flat: data,
    };
  });

  // Comparativo canônico: retorna a matriz 262×N pra os IDs informados
  app.post('/competitive/compare/canonico', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Comparação canônica Ford D1 — matriz 262 atributos × N veículos',
      body: z.object({
        vehicle_ids: z.array(z.string().uuid()).min(1).max(6),
      }),
    },
  }, async (req) => {
    requireUser(req);
    const { vehicle_ids } = req.body as any;

    // 1. veículos (header)
    const vehicles = await sql<{
      id: string; marca: string; modelo: string; versao: string; ano: number;
      categoria: string; preco_brl: number | null;
    }[]>`
      select id, marca, modelo, versao, ano, categoria, preco_brl
      from public.vehicles
      where id = any(${vehicle_ids}::uuid[])
    `;
    if (vehicles.length === 0) throw unprocessable('nenhum dos veículos informados existe no catálogo', 'vehicles_not_found');

    // 2. catalog_items (linhas)
    const items = await sql<CatalogItemRow[]>`
      select id, secao, ordem, ordem_global, nome, tipo, unidade
      from public.catalog_items
      order by ordem_global asc
    `;

    // 3. valores preenchidos
    const values = await sql<{
      vehicle_id: string; item_id: string; valor: string | null; confianca: string; fonte: string | null;
    }[]>`
      select vehicle_id, item_id, valor, confianca, fonte
      from public.vehicle_catalog_values
      where vehicle_id = any(${vehicle_ids}::uuid[])
    `;

    // index: itemId -> vehicleId -> valor
    const byItem: Record<string, Record<string, { valor: string | null; confianca: string; fonte: string | null }>> = {};
    for (const v of values) {
      const bucket = byItem[v.item_id] ?? (byItem[v.item_id] = {});
      bucket[v.vehicle_id] = {
        valor: v.valor,
        confianca: v.confianca,
        fonte: v.fonte,
      };
    }

    // monta rows agrupados por seção
    const sections: Record<string, any[]> = {};
    for (const it of items) {
      const sec = it.secao || '(sem secao)';
      sections[sec] ??= [];
      // valores ordenados conforme vehicle_ids do pedido
      const row = vehicle_ids.map((vid: string) => byItem[it.id]?.[vid] ?? { valor: null, confianca: 'baixa', fonte: null });
      sections[sec].push({
        item_id: it.id,
        nome: it.nome,
        ordem: it.ordem,
        ordem_global: it.ordem_global,
        tipo: it.tipo,
        unidade: it.unidade,
        valores: row,
      });
    }

    return {
      vehicles,
      total_items: items.length,
      sections: Object.entries(sections).map(([secao, rows]) => ({
        secao,
        count: rows.length,
        items: rows,
      })),
    };
  });

  // ====================================================================
  // VALORES CANÔNICOS DE UM VEÍCULO (262 atributos com X/0/numérico)
  // ====================================================================

  // GET — devolve todos os 262 atributos + valor preenchido (null se vazio)
  app.get('/competitive/vehicles/:id/catalog-values', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Devolve o schema canônico (262 itens) preenchido pra um veículo',
      params: z.object({ id: z.string().uuid() }),
    },
  }, async (req) => {
    requireUser(req);
    const { id } = req.params as any;

    // id é PK → no máximo 1 linha (equivale ao antigo maybeSingle).
    const [vehicle] = await sql<{ id: string; marca: string; modelo: string; versao: string; ano: number }[]>`
      select id, marca, modelo, versao, ano from public.vehicles where id = ${id}
    `;
    if (!vehicle) throw notFound('veículo não encontrado');

    const items = await sql<CatalogItemRow[]>`
      select id, secao, ordem, ordem_global, nome, tipo, unidade
      from public.catalog_items
      order by ordem_global asc
    `;

    const values = await sql<{
      item_id: string; valor: string | null; confianca: string; fonte: string | null; updated_at: Date;
    }[]>`
      select item_id, valor, confianca, fonte, updated_at
      from public.vehicle_catalog_values
      where vehicle_id = ${id}
    `;

    const valueByItem = new Map(values.map(v => [v.item_id, v]));

    const sections: Record<string, any[]> = {};
    let filled = 0;
    for (const it of items) {
      const sec = it.secao || '(sem secao)';
      const val = valueByItem.get(it.id);
      sections[sec] ??= [];
      const valor = val?.valor ?? null;
      if (valor != null && String(valor).trim() !== '') filled++;
      sections[sec].push({
        item_id: it.id,
        nome: it.nome,
        ordem: it.ordem,
        ordem_global: it.ordem_global,
        tipo: it.tipo,
        unidade: it.unidade,
        valor,
        confianca: val?.confianca ?? null,
        fonte: val?.fonte ?? null,
        updated_at: val?.updated_at ?? null,
      });
    }

    return {
      vehicle,
      total_items: items.length,
      filled,
      sections: Object.entries(sections).map(([secao, rows]) => ({
        secao,
        count: rows.length,
        filled: rows.filter((r: any) => r.valor != null && String(r.valor).trim() !== '').length,
        items: rows,
      })),
    };
  });

  // PATCH — atualiza vários valores de uma vez
  app.patch('/competitive/vehicles/:id/catalog-values', {
    onRequest: [authorize('gestor', 'admin')],
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Atualiza valores canônicos de um veículo (X / 0 / numérico / null)',
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        values: z.array(z.object({
          item_id: z.string().uuid(),
          valor: z.string().nullable(),
          confianca: z.enum(['alta', 'media', 'baixa']).optional(),
          fonte: z.string().optional(),
        })).min(1).max(300),
      }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const { values } = req.body as any;

    const [vehicle] = await sql<{ id: string }[]>`
      select id from public.vehicles where id = ${id}
    `;
    if (!vehicle) throw notFound('veículo não encontrado');

    // Upsert em lote — valor null deleta o registro
    const toDelete: string[] = [];
    const toUpsert: CatalogValueUpsert[] = [];
    for (const v of values) {
      if (v.valor == null || String(v.valor).trim() === '') {
        toDelete.push(v.item_id);
      } else {
        toUpsert.push({
          vehicle_id: id,
          item_id: v.item_id,
          valor: String(v.valor).trim(),
          confianca: v.confianca ?? 'media',
          fonte: v.fonte ?? 'manual',
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (toDelete.length > 0) {
      await sql`
        delete from public.vehicle_catalog_values
        where vehicle_id = ${id} and item_id = any(${toDelete}::uuid[])
      `;
    }
    if (toUpsert.length > 0) await upsertCatalogValues(toUpsert);
    await logAudit({
      actor_id: u.id, action: 'vehicle.catalog_values_updated', entity: 'vehicles', entity_id: id,
      metadata: { upserted: toUpsert.length, deleted: toDelete.length },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);
    return { ok: true, upserted: toUpsert.length, deleted: toDelete.length };
  });

  // POST — auto-popula os 262 valores via IA a partir do veículo cadastrado
  app.post('/competitive/vehicles/:id/catalog-values/auto-fill', {
    onRequest: [authorize('gestor', 'admin')],
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'IA preenche o schema canônico (262 atributos) usando metadados do veículo',
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        overwrite: z.boolean().optional().default(false),
      }).optional(),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { id } = req.params as any;
    const overwrite = (req.body as any)?.overwrite ?? false;

    const [vehicle] = await sql<Record<string, any>[]>`
      select id, marca, modelo, versao, ano, categoria, motor, dimensoes, transmissao, desempenho,
             equipamentos, preco_brl, pais_origem, notas, fontes
      from public.vehicles
      where id = ${id}
    `;
    if (!vehicle) throw notFound('veículo não encontrado');

    const items = await sql<Pick<CatalogItemRow, 'id' | 'secao' | 'nome' | 'tipo' | 'unidade' | 'ordem_global'>[]>`
      select id, secao, nome, tipo, unidade, ordem_global
      from public.catalog_items
      order by ordem_global asc
    `;
    // Dependência de dados ainda não populada → serviço indisponível (não é bug do servidor).
    if (items.length === 0) throw serviceUnavailable('catálogo canônico ainda não foi carregado', 'catalog_not_loaded');

    // Quais itens já estão preenchidos? Se overwrite=false, mantém.
    const existingValues = new Map<string, string | null>();
    if (!overwrite) {
      const existing = await sql<{ item_id: string; valor: string | null }[]>`
        select item_id, valor from public.vehicle_catalog_values where vehicle_id = ${id}
      `;
      for (const r of existing) existingValues.set(r.item_id, r.valor);
    }

    // Monta prompt: peça à IA pra preencher TODOS os 262 atributos com X/0/numérico/null
    const itemsForPrompt = items.map((it) => ({
      id: it.id,
      secao: it.secao,
      nome: it.nome,
      tipo: it.tipo,
      unidade: it.unidade,
    }));

    const prompt = `Você é uma IA especializada em ficha técnica automotiva no Brasil.

VEÍCULO: ${vehicle.marca} ${vehicle.modelo} ${vehicle.versao} ${vehicle.ano} (${vehicle.categoria ?? '?'})

DADOS JÁ CONHECIDOS:
${JSON.stringify({
  motor: vehicle.motor,
  dimensoes: vehicle.dimensoes,
  transmissao: vehicle.transmissao,
  desempenho: vehicle.desempenho,
  equipamentos: vehicle.equipamentos,
  preco_brl: vehicle.preco_brl,
}, null, 2)}

TAREFA: para CADA um dos ${itemsForPrompt.length} atributos do schema Ford abaixo, devolva um valor:
- Se for tipo "flag" → "X" (tem) ou "0" (não tem)
- Se for tipo "numeric" → número puro (ex: "250", "18", "9.5")
- Se for tipo "text" → string curta
- Se você NÃO TIVER CERTEZA → use null (NÃO chute)

Responda APENAS um JSON no formato:
{"values":[{"id":"<uuid>","valor":"X"|"0"|"<numero>"|"<texto>"|null}, ...]}

Schema dos ${itemsForPrompt.length} atributos:
${JSON.stringify(itemsForPrompt)}`;

    let aiResp: string;
    try {
      const userId = (req as any).user?.id;
      const aiModel = (req.headers['x-ai-model'] as string)
        ?? (userId ? await getFunctionAiModel(userId, 'catalog_autofill') : undefined);
      const r = await chat(prompt, 'smart', {
        systemOverride: 'Devolva APENAS JSON válido. Sem markdown, sem comentários.',
        modelOverride: aiModel,
        maxTokens: 16384,
        jsonObjectMode: true,
      });
      aiResp = r.output;
    } catch (e: any) {
      req.log.warn({ err: e?.message }, '[auto-fill] falha no provedor de IA');
      throw badGateway('o provedor de IA falhou ao processar a solicitação', 'ai_failed');
    }
    if (!aiResp) throw badGateway('o provedor de IA não retornou resposta', 'ai_empty');

    // parse robusto
    let parsed: any;
    try {
      const m = aiResp.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : aiResp);
    } catch (e: any) {
      // Resposta crua da IA só no log — nunca devolvida ao cliente.
      req.log.warn({ err: e?.message, raw: aiResp.slice(0, 500) }, '[auto-fill] IA devolveu JSON inválido');
      throw badGateway('o provedor de IA devolveu uma resposta em formato inválido', 'invalid_ai_json');
    }

    const itemValidIds = new Set(items.map((it) => it.id));
    const toUpsert: CatalogValueUpsert[] = [];
    const skipped: string[] = [];
    for (const row of parsed.values ?? []) {
      if (!itemValidIds.has(row.id)) continue;
      if (row.valor == null) continue;
      // Não sobrescreve manuais já preenchidos a menos que overwrite=true
      if (existingValues.has(row.id) && !overwrite) {
        skipped.push(row.id);
        continue;
      }
      const s = String(row.valor).trim();
      if (s === '') continue;
      toUpsert.push({
        vehicle_id: id,
        item_id: row.id,
        valor: s,
        confianca: 'baixa',
        fonte: 'ai:auto-fill',
        updated_at: new Date().toISOString(),
      });
    }

    if (toUpsert.length > 0) await upsertCatalogValues(toUpsert);
    await logAudit({
      actor_id: u.id, action: 'vehicle.catalog_values_auto_filled', entity: 'vehicles', entity_id: id,
      metadata: { filled: toUpsert.length, skipped: skipped.length, overwritten: overwrite },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);

    return {
      ok: true,
      filled: toUpsert.length,
      skipped_existing: skipped.length,
      total_items: items.length,
    };
  });

  // Helper: pega modelo de IA preferido do user para uma função
  async function getFunctionAiModel(userId: string, fn: string): Promise<string | undefined> {
    // (user_id, function_name) é a PK → no máximo 1 linha. Falha de leitura
    // não derruba a rota: cai no modelo padrão, como antes.
    try {
      const [row] = await sql<{ model_id: string }[]>`
        select model_id from public.ai_function_models
        where user_id = ${userId} and function_name = ${fn}
      `;
      return row?.model_id ?? undefined;
    } catch {
      return undefined;
    }
  }

  // === BUSCA com fontes verificáveis (FIPE + NHTSA + OpenAI) ===
  app.post('/competitive/search', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Busca veículo em fontes externas (FIPE + NHTSA + IA) e cacheia',
      body: z.object({
        marca: z.string().min(2),
        modelo: z.string().min(1),
        versao: z.string().optional(),
        ano: z.number().int().min(1990).max(2030).optional(),
        force_refresh: z.boolean().optional().default(false),
      }),
    },
  }, async (req) => {
    const u = requireUser(req);
    const { marca, modelo, versao, ano, force_refresh } = req.body as any;

    // 1. Tenta cache primeiro (a menos que force_refresh)
    if (!force_refresh) {
      // Erro na leitura do cache não é fatal: segue para as fontes externas, como antes.
      const existing = await sql<VehicleRow[]>`
        select * from public.vehicles
        where marca ilike ${likePattern(marca)}
          and modelo ilike ${likePattern(modelo)}
          ${versao ? sql`and versao ilike ${likePattern(`%${versao}%`)}` : sql``}
          ${ano ? sql`and ano = ${ano}` : sql``}
      `.catch(() => [] as VehicleRow[]);
      if (existing.length > 0) {
        return { source: 'cache', vehicle: existing[0] };
      }
    }

    // 2. Agrega de fontes externas
    req.log.info({ marca, modelo, versao, ano }, '[search] aggregating from external sources');
    const aiModel = (req.headers['x-ai-model'] as string) ?? await getFunctionAiModel(u.id, 'vehicle_search');
    const manufacturerAiModel = await getFunctionAiModel(u.id, 'manufacturer_extract');
    const aggregated = await aggregateVehicle({ marca, modelo, versao, ano, aiModel, manufacturerAiModel });
    if (!aggregated) throw notFound('veículo não encontrado em nenhuma fonte (FIPE, NHTSA, IA)', 'vehicle_data_not_found');

    // 3. Upsert no banco
    // Chave de conflito: `hash_dedupe` (coluna gerada = marca|modelo|versão|ano em minúsculas).
    // Em conflito atualiza todas as colunas do payload.
    let data: VehicleRow;
    try {
      const [row] = await sql<VehicleRow[]>`
        insert into public.vehicles (
          marca, modelo, versao, ano, categoria, motor, dimensoes, transmissao, desempenho,
          equipamentos, preco_brl, pais_origem, fontes, data_sources, fipe_codigo,
          fipe_mes_referencia, confianca_geral
        ) values (
          ${aggregated.marca},
          ${aggregated.modelo},
          ${aggregated.versao},
          ${aggregated.ano},
          ${aggregated.categoria},
          ${sql.json(aggregated.motor as postgres.JSONValue)},
          ${sql.json(aggregated.dimensoes as postgres.JSONValue)},
          ${sql.json(aggregated.transmissao as postgres.JSONValue)},
          ${sql.json(aggregated.desempenho as postgres.JSONValue)},
          ${aggregated.equipamentos}::text[],
          ${aggregated.preco_brl},
          ${aggregated.pais_origem},
          ${aggregated.fontes}::text[],
          ${sql.json(aggregated.data_sources as postgres.JSONValue)},
          ${aggregated.fipe_codigo},
          ${aggregated.fipe_mes_referencia},
          ${aggregated.confianca_geral}
        )
        on conflict (hash_dedupe) do update set
          marca = excluded.marca,
          modelo = excluded.modelo,
          versao = excluded.versao,
          ano = excluded.ano,
          categoria = excluded.categoria,
          motor = excluded.motor,
          dimensoes = excluded.dimensoes,
          transmissao = excluded.transmissao,
          desempenho = excluded.desempenho,
          equipamentos = excluded.equipamentos,
          preco_brl = excluded.preco_brl,
          pais_origem = excluded.pais_origem,
          fontes = excluded.fontes,
          data_sources = excluded.data_sources,
          fipe_codigo = excluded.fipe_codigo,
          fipe_mes_referencia = excluded.fipe_mes_referencia,
          confianca_geral = excluded.confianca_geral
        returning *
      `;
      data = row!;
    } catch (error) {
      req.log.error({ error }, '[search] upsert failed');
      throw error;
    }
    await logAudit({
      actor_id: u.id, action: 'vehicle.imported_from_search', entity: 'vehicles', entity_id: data.id,
      metadata: { marca, ano: aggregated.ano },
      ip: req.ip, user_agent: req.headers['user-agent'] ?? null,
    }, req.log);
    return { source: 'fresh', vehicle: data };
  });

  // === ANÁLISE IA do comparativo ===
  app.post('/competitive/compare/analyze', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Gera análise textual do comparativo com gpt-4o',
      body: z.object({ vehicle_ids: z.array(z.string().uuid()).min(2).max(5) }),
    },
  }, async (req) => {
    requireUser(req);
    const { vehicle_ids } = req.body as any;
    const vehicles = await sql<VehicleRow[]>`
      select * from public.vehicles where id = any(${vehicle_ids}::uuid[])
    `;
    if (vehicles.length < 2) throw unprocessable('necessário 2 ou mais veículos existentes no catálogo', 'vehicles_not_found');

    // Agrupa equipamentos por categoria pra apresentar diff estruturado
    const eqByCat = (items: string[]) => {
      const out: Record<string, string[]> = {};
      for (const raw of items ?? []) {
        const m = raw.match(/^([a-z_]+):(.+)$/);
        if (m) (out[m[1]!] ??= []).push(m[2]!);
        else (out['geral'] ??= []).push(raw);
      }
      return out;
    };

    const fichas = vehicles.map((v: any) => {
      const motor = v.motor ?? {};
      const dim = v.dimensoes ?? {};
      const trans = v.transmissao ?? {};
      const desemp = v.desempenho ?? {};
      const grouped = eqByCat(v.equipamentos);
      const eqList = Object.entries(grouped)
        .map(([cat, items]) => `  • ${cat}: ${items.join(', ')}`)
        .join('\n') || '  • —';
      return `**${v.marca} ${v.modelo} ${v.versao} ${v.ano}**
- Categoria: ${v.categoria}
- Motor: ${motor.cilindrada_cc ?? '?'} cc, ${motor.potencia_cv ?? '?'} cv, ${motor.torque_nm ?? '?'} Nm, ${motor.combustivel ?? '?'}, aspiração ${motor.aspiracao ?? '?'}
- Transmissão: ${trans.tipo ?? '?'} ${trans.marchas ?? '?'} marchas, tração ${trans.tracao ?? '?'}
- Desempenho: 0-100 em ${desemp.aceleracao_0_100_s ?? '?'} s, máx ${desemp.velocidade_max_kmh ?? '?'} km/h
- Consumo: ${desemp.consumo_cidade_kml ?? '?'} kml cidade / ${desemp.consumo_estrada_kml ?? '?'} kml estrada
- Dimensões: ${dim.comprimento_mm ?? '?'} x ${dim.largura_mm ?? '?'} x ${dim.altura_mm ?? '?'} mm, entre-eixos ${dim.entre_eixos_mm ?? '?'} mm, vão livre ${dim.vao_livre_mm ?? '?'} mm
- Capacidade reboque: ${dim.capacidade_reboque_kg ?? '?'} kg | carga: ${dim.capacidade_carga_kg ?? '?'} kg
- Preço FIPE (BR): ${v.preco_brl ? `R$ ${v.preco_brl.toLocaleString('pt-BR')}` : '—'} ${v.fipe_mes_referencia ? `(ref ${v.fipe_mes_referencia})` : ''}
- Equipamentos (por categoria):
${eqList}
- Fontes: ${(v.fontes ?? []).join(' + ')}`;
    }).join('\n\n');

    // Lista de marca+modelo únicos (pra detectar cenário)
    const marcasModelos = vehicles
      .map((v: any) => `${v.marca} ${v.modelo}`)
      .filter((m: string, i: number, a: string[]) => a.indexOf(m) === i);

    // Cenário A: todos do MESMO modelo (comparando trims) → buscar mix de versão
    // Cenário B: modelos DIFERENTES → buscar emplacamento por modelo
    const isMesmoModelo = marcasModelos.length === 1;

    // Lista completa de ESTES veículos específicos (nome cheio)
    const veiculosEspecificos = vehicles
      .map((v: any) => `${v.marca} ${v.modelo} ${v.versao} (${v.ano})`)
      .join(' · ');

    // Cabeçalho da seção de vendas adapta ao cenário
    const vendasIntro = isMesmoModelo ? `
**CENÁRIO: você está comparando ${vehicles.length} VERSÕES/TRIMS do mesmo modelo
(${marcasModelos[0]}).** A pergunta NÃO é "Hilux vs Ranger" — é "dentro do ${marcasModelos[0]},
qual versão vende mais?".

Busque na web (Webmotors, AutoPapo, Quatro Rodas, fóruns, MotorTrend BR, blogs
oficiais Ford, releases de imprensa) dados sobre:
- **Mix de vendas por versão** do ${marcasModelos[0]} no Brasil — qual trim domina (entry, intermediária, top)
- Volume estimado/percentual de cada uma dessas versões: ${veiculosEspecificos}
- Padrão de público que escolhe cada uma (frotista vs particular vs PJ)

Se não houver dado público por trim, **estime baseado em padrão de mercado**:
geralmente versões intermediárias dominam o volume (50-70%), top-de-linha fica
em 15-25%, e base fica em 10-20%. Diga claramente "estimativa baseada em padrão
de mercado" quando não tiver dado oficial.

Estruture assim:

| Versão | Mix estimado | Público típico | Posição |
|---|---|---|---|
| ${marcasModelos[0]} {versão} | ~XX% das vendas do modelo | frotista / particular / PJ | mais vendida / intermediária / nicho |
| ... | ... | ... | ... |

Em seguida, **frase direta**: qual dessas versões específicas é a mais popular E POR QUÊ.
Ex: *"A Limited domina ~45% das vendas da Ranger no varejo, enquanto a XLT
predomina em frota PJ por melhor relação custo-feature."*` : `
**CENÁRIO: você está comparando ${vehicles.length} MODELOS DIFERENTES** (${marcasModelos.join(' vs ')}).
A pergunta é: ENTRE ESTES MODELOS ESPECÍFICOS, qual vende mais no Brasil?

**PRIMEIRO PASSO: busque emplacamentos atualizados no Brasil pra ESTES modelos**
(FENABRAVE, Anfavea, Webmotors Insights, AutoPapo, Quatro Rodas, ranking mensal de
emplacamentos). Cite sempre o mês de referência.

Estruture assim:

| Modelo | Vendas 12m (BR) | Tendência | Posição entre os comparados |
|---|---|---|---|
| {Marca Modelo} | ~XX.XXX un. | ↗ subindo / ↘ caindo / → estável | 1º/2º/3º DESTE comparativo |
| ... | ... | ... | ... |

Em seguida, **frase direta**: dos ${vehicles.length} modelos sendo comparados,
qual vende MAIS e por quanto. Ex: *"Entre Hilux e Ranger, a Hilux vende 2,3×
mais no Brasil em 2025 (87k vs 38k unidades)"*.`;

    const prompt = `Você está fazendo uma análise COMPETITIVA pra ajudar um vendedor/gerente Ford
a entender DOIS pontos: (1) o que cada veículo TEM/NÃO TEM no dia a dia, e
(2) entre OS VEÍCULOS ESPECÍFICOS sendo comparados, qual é o mais vendido/desejado
no Brasil e POR QUÊ.

**IMPORTANTE: a análise é entre ESTES veículos**:
${veiculosEspecificos}

Não generalize para "o segmento de picapes" — foque NESTES carros específicos.

Veículos a comparar (ficha completa):

${fichas}

## TAREFA — busque na web e devolva PT-BR Markdown estruturado EXATAMENTE assim:

## 📊 Vendas no mercado BR (últimos 12 meses)
${vendasIntro}

## 🧠 Por que o líder vende mais (cruzando dados ENTRE ESTES VEÍCULOS)

Em 4-6 bullets, **explique a vantagem do líder DENTRO DESTE COMPARATIVO**,
usando equipamentos do schema canônico que você viu acima:
${isMesmoModelo ? `- Equipamentos exclusivos da versão líder que justificam o preço maior (ou estratégia oposta: versão base barata vence em volume)
- Mix de preço/equipamento que casa com o público típico daquela versão
- Recompra: clientes do trim X tendem a subir pro trim Y na próxima compra?
- Estratégia da Ford no posicionamento dessa versão (entry, value, top)
- Diferencial percebido pelo cliente (status do "+" vs praticidade do "XLT")` : `- Equipamento específico que o líder TEM e os outros comparados NÃO TÊM
- Preço/posicionamento (mais caro mas equipado, ou mais barato e estratégico)
- Reputação histórica DESSE modelo específico no segmento
- Rede de concessionárias, valor de revenda, custo de manutenção COMPARADOS
- Fator emocional / heritage de cada modelo (off-road, conforto, status)`}

Seja específico — NÃO escreva "tem boa reputação"; cite anos, mercados, números.

## 🎯 Diferenciais EXCLUSIVOS por veículo
Para CADA veículo, liste em bullets concretos o que ELE TEM e os concorrentes NÃO TÊM:

### {Marca Modelo Versão}
- **Conforto/Conveniência**: <item> — *por que importa pro dia a dia*
- **Segurança/Assistência**: <item> — *valor real, não marketing*
- **Tecnologia**: <item> — *o que muda na experiência*
- **Robustez/Cargo/Off-road** (se aplicável): <item> — *uso prático*
- **Exterior/Design**: <item> — *percepção de valor*

NÃO ESCREVA item que esteja em mais de um veículo nessa seção. Foque no que é EXCLUSIVO.

## ⚖️ Onde empatam (commodities)
Lista curta dos itens que TODOS têm de série.

## 💸 Custo do diferencial
Compare o preço FIPE com o pacote de equipamentos. Quem entrega MAIS feature por real?
Cruze com os números de venda: o "campeão custo-feature" é também o líder de venda?
Se não, **por que** o cliente paga mais pelo concorrente?

## 🚨 Pontos cegos por veículo
1 bullet por veículo: qual feature CRÍTICA o concorrente líder TEM e ele NÃO?
Ex: *"Ranger XLT: sem câmera 360 — perde pra Hilux SRV nesse aspecto, e câmera 360 é
top-3 fator de decisão segundo pesquisas de pós-venda Webmotors 2024"*.

## 🎬 Recomendação ao vendedor Ford
3-4 frases focadas EXCLUSIVAMENTE nos ${vehicles.length} veículos comparados:
${isMesmoModelo
  ? `- Cliente entrou querendo "uma ${marcasModelos[0]}" — em qual desses trims o vendedor deve focar?
- Como qualificar pra entender qual versão casa com o uso (frota? família? off-road?)
- Quando vale empurrar pro trim de cima (upgrade) e quando aceitar o trim de baixo
- Argumento de upgrade da entry pra intermediária OU da intermediária pra top: qual feature é o gatilho de decisão?`
  : `- Contra qual desses concorrentes o vendedor Ford está disputando esse cliente especifico?
- O que DESTACAR no pitch da Ford CONTRA esses concorrentes específicos?
- O que EVITAR mencionar (porque o concorrente comparado ganha nisso)?
- Tem alguma feature exclusiva da Ford que pode VIRAR a decisão neste comparativo?`}

REGRAS DE OURO:
- A análise é APENAS entre os ${vehicles.length} veículos listados acima.
  ${isMesmoModelo
    ? `NÃO compare com Hilux/Amarok/SW4 — todos os comparados são ${marcasModelos[0]}.`
    : `NÃO traga modelos fora dessa lista (${marcasModelos.join(', ')}). Não cite "outros do segmento" como referência.`}
- Use dados REAIS de venda quando achar (cite a fonte). Se não achar, escreva
  "estimativa baseada em padrão de mercado" em vez de inventar números.
- Cite NOMES específicos de equipamentos, não generalidades ("multimídia 10\"" e não "boa tela")
- PT-BR informal de showroom, não academiquês
- Sem "talvez", "depende", "em alguns casos" — POSICIONE
- Se um veículo tem dado faltando (—), assuma que NÃO TEM e mencione no Pontos cegos`;

    let aiModel = req.headers['x-ai-model'] as string | undefined;
    if (!aiModel) aiModel = await getFunctionAiModel(requireUser(req).id, 'compare_analysis');
    const r = await chat(prompt, 'smart', {
      systemOverride: 'Você é um analista de inteligência competitiva da Ford. Foca em ' +
        'cruzar (a) números reais de venda no mercado BR (FENABRAVE/Anfavea/Webmotors) ' +
        'com (b) diferenças de equipamento entre versões — pra explicar AO VENDEDOR ' +
        'por que um carro vende mais que outro. Use a web pra buscar dados de emplacamento ' +
        'recentes. Escreva PT-BR objetivo de showroom, transformando especificação técnica ' +
        'em valor prático pro cliente final.',
      modelOverride: aiModel,
      maxTokens: 4000, // análise mais rica + dados de venda + raciocínio
      webSearch: true,  // ⚡ FENABRAVE/Anfavea via OpenAI search-preview
      searchContextSize: 'high',
    });

    return {
      vehicles: vehicles.map((v: any) => ({ id: v.id, marca: v.marca, modelo: v.modelo, versao: v.versao })),
      model: `${r.provider}:${r.model}`,
      analise: r.output,
      citations: r.citations ?? [],  // fontes consultadas pela busca
    };
  });
}

/**
 * Projeta um Vehicle no subconjunto de campos solicitados.
 * Suporta dot-notation: "motor.potencia_cv" devolve só esse campo.
 * Campos top-level: "motor", "dimensoes", etc. devolvem o objeto inteiro.
 */
function withNestedField(record: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const [head, ...rest] = path;
  if (!head) return record;
  const previous = Object.hasOwn(record, head) ? record[head] : null;
  const nested = rest.length
    ? withNestedField(previous && typeof previous === 'object' && !Array.isArray(previous)
      ? previous as Record<string, unknown> : Object.create(null), rest, value)
    : value;
  return Object.assign(Object.create(null), record, { [head]: nested });
}

function projectFields(v: Vehicle, fields: string[]): Record<string, unknown> {
  let out: Record<string, unknown> = Object.assign(Object.create(null), {
    id: v.id, marca: v.marca, modelo: v.modelo, versao: v.versao, ano: v.ano,
  });

  for (const path of fields) {
    const parts = path.split('.');
    if (parts.some(part => !part || part === '__proto__' || part === 'prototype' || part === 'constructor')) continue;
    if (!path.includes('.')) {
      out[path] = Object.hasOwn(v, path) ? (v as any)[path] ?? null : null;
      continue;
    }
    const head = parts[0];
    if (!head) continue;
    const source = (v as any)[head];
    if (source == null) {
      out = withNestedField(out, parts, null);
      continue;
    }
    let cur = source;
    for (const k of parts.slice(1)) {
      cur = cur && Object.hasOwn(cur, k) ? cur[k] : null;
      if (cur === undefined) cur = null;
    }
    out = withNestedField(out, parts, cur);
  }
  return out;
}
