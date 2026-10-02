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

// Segredo padrão SÓ para desenvolvimento/testes locais. Em produção o refine abaixo
// impede a API de subir com ele — obriga a definir JWT_SECRET no ambiente.
const DEV_ONLY_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me-0000';

const Env = z.object({
  // PostgreSQL padrão (ex.: postgres://usuario:senha@127.0.0.1:5432/faroai)
  DATABASE_URL: z.string().url(),
  CLIENT_CPF_PEPPER: z.string().min(32),

  ANTHROPIC_API_KEY: z.string().optional().default(''),
  CLAUDE_MODEL_FAST: z.string().default('claude-haiku-4-5-20251001'),
  CLAUDE_MODEL_SMART: z.string().default('claude-sonnet-4-6'),

  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL_FAST: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_SMART: z.string().default('gpt-4o'),

  API_PORT: z.coerce.number().default(3333),
  API_HOST: z.string().default('127.0.0.1'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8081,http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),

  ML_SERVICE_URL: z.string().url().default('http://127.0.0.1:8001'),
  ML_SERVICE_TOKEN: z.string().min(32),

  // ----- JWT emitido pela própria API (POST /auth/login) -----
  // HS256 exige segredo com pelo menos 256 bits (32 bytes).
  JWT_SECRET: z.string().min(32).default(DEV_ONLY_JWT_SECRET),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600), // 1 hora
  JWT_ISSUER: z.string().min(1).default('faro-ai-api'),
  JWT_AUDIENCE: z.string().min(1).default('faro-ai-clients'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
}).refine(
  (cfg) => cfg.NODE_ENV !== 'production' || cfg.JWT_SECRET !== DEV_ONLY_JWT_SECRET,
  { message: 'JWT_SECRET precisa ser definido em produção', path: ['JWT_SECRET'] },
);

export const env = Env.parse(process.env);

export const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
