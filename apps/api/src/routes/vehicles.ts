import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { publicClient } from '../lib/supabase.js';
import { compareVehicles, type Vehicle, COMPARABLE_FIELDS } from '../modules/competitive/compare.js';

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
    const u = req.requireUser();
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
    const u = req.requireUser();
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
    const u = req.requireUser();
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
