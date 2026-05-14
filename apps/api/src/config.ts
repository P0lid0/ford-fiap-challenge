import 'dotenv/config';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Carrega .env.local da raiz do monorepo se existir (override do .env padrão).
const rootEnv = resolve(process.cwd(), '../../.env.local');
if (existsSync(rootEnv)) {
  const content = readFileSync(rootEnv, 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
  }
}

const Env = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1).optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1).optional().default(''),

  ANTHROPIC_API_KEY: z.string().optional().default(''),
  CLAUDE_MODEL_FAST: z.string().default('claude-haiku-4-5-20251001'),
  CLAUDE_MODEL_SMART: z.string().default('claude-sonnet-4-6'),

  API_PORT: z.coerce.number().default(3333),
  API_HOST: z.string().default('127.0.0.1'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8081,http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  ML_SERVICE_URL: z.string().url().default('http://127.0.0.1:8001'),
  ML_SERVICE_TOKEN: z.string().min(8),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = Env.parse(process.env);

export const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
