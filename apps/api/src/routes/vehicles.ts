import type { FastifyInstance } from 'fastify';
import { requireUser } from '../plugins/auth.js';
import { z } from 'zod';
import { adminClient, publicClient } from '../lib/supabase.js';
import { compareVehicles, type Vehicle, COMPARABLE_FIELDS } from '../modules/competitive/compare.js';
import { aggregateVehicle } from '../lib/data-sources/aggregator.js';
import { chat } from '../lib/ai.js';

/**
 * Rotas do Desafio 1 — Inteligência Competitiva.
 *
 * Pontos-chave:
 *   - `?fields=motor.potencia_cv,desempenho.consumo_cidade_kml` permite o
 *     usuário escolher livremente quais campos retornar (requisito Ford).
 *   - Campo ausente vem como `null` explícito.
 *   - Comparação computa winner_index por critério (max/min/none).
 */
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
    const u = requireUser(req);
    const { marca, modelo, categoria, limit } = req.query as any;

    let q = publicClient(u.jwt).from('vehicles').select('*').order('marca').limit(limit);
    if (marca) q = q.ilike('marca', marca);
    if (modelo) q = q.ilike('modelo', modelo);
    if (categoria) q = q.eq('categoria', categoria);

    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
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
  }, async (req, reply) => {
    const u = requireUser(req);
    const { marca, modelo, versao, ano, fields } = req.query as any;

    let q = publicClient(u.jwt)
      .from('vehicles')
      .select('*')
      .ilike('marca', marca)
      .ilike('modelo', modelo);
    if (versao) q = q.ilike('versao', versao);
    if (ano) q = q.eq('ano', ano);

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) {
      reply.code(404);
      return { error: 'not_found', message: 'nenhum veículo combina com a query' };
    }

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
  }, async (req, reply) => {
    const u = requireUser(req);
    const { vehicle_ids, fields } = req.body as any;

    const { data, error } = await publicClient(u.jwt)
      .from('vehicles')
      .select('*')
      .in('id', vehicle_ids);
    if (error) throw error;
    if (!data || data.length < 2) {
      reply.code(400);
      return { error: 'bad_request', message: 'necessário 2 ou mais veículos válidos' };
    }

    return compareVehicles(data as Vehicle[], fields);
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
  }, async (req, reply) => {
    requireUser(req);
    const { marca, modelo, versao, ano, force_refresh } = req.body as any;
    const sb = adminClient();

    // 1. Tenta cache primeiro (a menos que force_refresh)
    if (!force_refresh) {
      let q = sb.from('vehicles').select('*').ilike('marca', marca).ilike('modelo', modelo);
      if (versao) q = q.ilike('versao', `%${versao}%`);
      if (ano) q = q.eq('ano', ano);
      const { data: existing } = await q;
      if (existing && existing.length > 0) {
        return { source: 'cache', vehicle: existing[0] };
      }
    }

    // 2. Agrega de fontes externas
    req.log.info({ marca, modelo, versao, ano }, '[search] aggregating from external sources');
    const aggregated = await aggregateVehicle({ marca, modelo, versao, ano });
    if (!aggregated) {
      reply.code(404);
      return { error: 'not_found', message: 'veículo não encontrado em nenhuma fonte (FIPE, NHTSA, IA)' };
    }

    // 3. Upsert no banco
    const { data, error } = await sb.from('vehicles').upsert({
      marca: aggregated.marca,
      modelo: aggregated.modelo,
      versao: aggregated.versao,
      ano: aggregated.ano,
      categoria: aggregated.categoria,
      motor: aggregated.motor,
      dimensoes: aggregated.dimensoes,
      transmissao: aggregated.transmissao,
      desempenho: aggregated.desempenho,
      equipamentos: aggregated.equipamentos,
      preco_brl: aggregated.preco_brl,
      pais_origem: aggregated.pais_origem,
      fontes: aggregated.fontes,
      data_sources: aggregated.data_sources,
      fipe_codigo: aggregated.fipe_codigo,
      fipe_mes_referencia: aggregated.fipe_mes_referencia,
      confianca_geral: aggregated.confianca_geral,
    }, { onConflict: 'hash_dedupe', ignoreDuplicates: false }).select().single();

    if (error) {
      req.log.error({ error }, '[search] upsert failed');
      throw error;
    }
    return { source: 'fresh', vehicle: data };
  });

  // === ANÁLISE IA do comparativo ===
  app.post('/competitive/compare/analyze', {
    schema: {
      tags: ['Desafio 1 — Inteligência Competitiva'],
      summary: 'Gera análise textual do comparativo com gpt-4o',
      body: z.object({ vehicle_ids: z.array(z.string().uuid()).min(2).max(5) }),
    },
  }, async (req, reply) => {
    requireUser(req);
    const { vehicle_ids } = req.body as any;
    const { data: vehicles, error } = await adminClient()
      .from('vehicles').select('*').in('id', vehicle_ids);
    if (error || !vehicles || vehicles.length < 2) {
      reply.code(400);
      return { error: 'bad_request', message: 'mínimo 2 veículos válidos' };
    }

    const ficha = vehicles.map((v: any) => {
      const motor = v.motor ?? {};
      const dim = v.dimensoes ?? {};
      const trans = v.transmissao ?? {};
      const desemp = v.desempenho ?? {};
      return `**${v.marca} ${v.modelo} ${v.versao} ${v.ano}**
- Categoria: ${v.categoria}
- Motor: ${motor.cilindrada_cc ?? '?'} cc, ${motor.potencia_cv ?? '?'} cv, ${motor.torque_nm ?? '?'} Nm, ${motor.combustivel ?? '?'}, aspiração ${motor.aspiracao ?? '?'}
- Transmissão: ${trans.tipo ?? '?'} ${trans.marchas ?? '?'} marchas, tração ${trans.tracao ?? '?'}
- Desempenho: 0-100 em ${desemp.aceleracao_0_100_s ?? '?'} s, máx ${desemp.velocidade_max_kmh ?? '?'} km/h
- Consumo: ${desemp.consumo_cidade_kml ?? '?'} kml cidade / ${desemp.consumo_estrada_kml ?? '?'} kml estrada
- Dimensões: ${dim.comprimento_mm ?? '?'} x ${dim.largura_mm ?? '?'} x ${dim.altura_mm ?? '?'} mm, entre-eixos ${dim.entre_eixos_mm ?? '?'} mm, vão livre ${dim.vao_livre_mm ?? '?'} mm
- Capacidade reboque: ${dim.capacidade_reboque_kg ?? '?'} kg | carga: ${dim.capacidade_carga_kg ?? '?'} kg
- Preço FIPE (BR): ${v.preco_brl ? `R$ ${v.preco_brl.toLocaleString('pt-BR')}` : '—'} ${v.fipe_mes_referencia ? `(ref ${v.fipe_mes_referencia})` : ''}
- Equipamentos: ${(v.equipamentos ?? []).slice(0, 10).join(', ') || '—'}
- Fontes: ${(v.fontes ?? []).join(' + ')}`;
    }).join('\n\n');

    const prompt = `Analise o COMPARATIVO COMPETITIVO destes veículos no mercado BRASILEIRO.
Use SEU CONHECIMENTO SOBRE O MERCADO AUTOMOTIVO BR (vendas Fenabrave, posicionamento, percepção do consumidor brasileiro).

Veículos:

${ficha}

Produza uma análise EXECUTIVA em PT-BR estruturada exatamente assim (use Markdown):

## Vencedores por dimensão
- **Desempenho**: <vencedor> e por quê
- **Custo-benefício**: <vencedor> e por quê
- **Off-road / robustez**: <vencedor> e por quê
- **Conforto / equipamentos**: <vencedor> e por quê
- **Eficiência / consumo**: <vencedor> e por quê

## Ranking estimado de vendas no Brasil
Liste os veículos da maior para a menor venda anual no BR (use seu conhecimento de Fenabrave 2024-2025).
Inclua VOLUME ESTIMADO de unidades/ano e POSIÇÃO no segmento.

## Por que um vende mais que o outro
Em 3-5 frases curtas, explique a razão competitiva REAL — não slogan. Considere:
- Preço-base e financiamento típico
- Rede de pós-venda no Brasil
- Confiabilidade percebida da marca
- Valor de revenda
- Custo de manutenção/peças

## Recomendação Ford
1 parágrafo curto: qual posicionamento a Ford deveria adotar para ganhar share contra os concorrentes listados.

SEJA OBJETIVO. Sem "depende", sem "talvez". Posicione.`;

    const aiModel = req.headers['x-ai-model'] as string | undefined;
    const r = await chat(prompt, 'smart', {
      systemOverride: 'Você é um analista sênior de inteligência competitiva da indústria automotiva brasileira. ' +
        'Tem acesso a dados de vendas Fenabrave 2024-2025 e conhece bem o comportamento do consumidor BR.',
      modelOverride: aiModel,
    });

    return {
      vehicles: vehicles.map((v: any) => ({ id: v.id, marca: v.marca, modelo: v.modelo, versao: v.versao })),
      model: `${r.provider}:${r.model}`,
      analise: r.output,
    };
  });
}

/**
 * Projeta um Vehicle no subconjunto de campos solicitados.
 * Suporta dot-notation: "motor.potencia_cv" devolve só esse campo.
 * Campos top-level: "motor", "dimensoes", etc. devolvem o objeto inteiro.
 */
function projectFields(v: Vehicle, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: v.id, marca: v.marca, modelo: v.modelo, versao: v.versao, ano: v.ano,
  };

  for (const path of fields) {
    if (!path.includes('.')) {
      out[path] = (v as any)[path] ?? null;
      continue;
    }
    const [head, ...rest] = path.split('.');
    if (!head) continue;
    if (!out[head]) out[head] = {};
    let target = out[head] as Record<string, unknown>;
    const source = (v as any)[head];
    if (source == null) {
      // Constrói com null explícito (regra Ford)
      target[rest.join('.')] = null;
      continue;
    }
    let cur = source;
    for (const k of rest) {
      cur = cur?.[k];
      if (cur === undefined) cur = null;
    }
    let bucket = target;
    for (let i = 0; i < rest.length - 1; i++) {
      const k = rest[i]!;
      bucket[k] = bucket[k] ?? {};
      bucket = bucket[k] as Record<string, unknown>;
    }
    bucket[rest[rest.length - 1]!] = cur;
  }
  return out;
}
