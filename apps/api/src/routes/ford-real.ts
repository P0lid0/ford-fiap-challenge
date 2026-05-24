/**
 * Endpoint que serve o resumo agregado da base real Ford BR (vin_share_Desafio_02).
 *
 * O JSON é pré-computado por scripts/generate-ford-real-summary.py rodando
 * sobre o parquet em services/ml/data/. Aqui apenas lemos do filesystem
 * e servimos — zero processamento em runtime.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { requireUser } from '../plugins/auth.js';

const SUMMARY_PATH = resolve(process.cwd(), '../../services/ml/data/ford-real-summary.json');

let _cache: { data: any; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function loadSummary() {
  if (_cache && Date.now() - _cache.loadedAt < CACHE_TTL_MS) return _cache.data;
  try {
    const raw = await readFile(SUMMARY_PATH, 'utf-8');
    _cache = { data: JSON.parse(raw), loadedAt: Date.now() };
    return _cache.data;
  } catch (err: any) {
    throw new Error(`Resumo Ford real não encontrado em ${SUMMARY_PATH}: ${err.message}. ` +
      'Rode scripts/generate-ford-real-summary.py primeiro.');
  }
}

export async function fordRealRoutes(app: FastifyInstance) {
  app.get('/metrics/ford-real', {
    schema: {
      tags: ['Desafio 2 — Retenção'],
      summary: 'KPIs agregados da base real Ford BR (175k VINs, 600k serviços, 435 dealers)',
    },
  }, async (req, reply) => {
    requireUser(req);
    try {
      return await loadSummary();
    } catch (err: any) {
      reply.code(503);
      return { error: 'not_available', message: err.message };
    }
  });
}
