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
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.trim();
  }
}

const Env = z.object({
  // PostgreSQL padrão — a API conecta com um único role e aplica o isolamento
  // por dealership em código (lib/scope.ts).
  DATABASE_URL: z.string().url(),

  // Auth própria: JWT HS256 assinado pela API (lib/auth.ts).
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('12h'),

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

  // Proxy reverso confiável. Default false: a API só confia em X-Forwarded-*
  // quando explicitamente configurado, senão qualquer cliente que alcança a
  // porta diretamente forjaria req.ip e zeraria o rate-limit do /auth/login.
  // Valores: 'false' | 'true' (confia em tudo — só atrás de proxy que
  // sobrescreve o header) | número de hops | lista de IPs/CIDRs separados
  // por vírgula (ex.: '127.0.0.1,10.0.0.0/8' ou 'loopback').
  TRUST_PROXY: z.string().default('false').transform((raw): boolean | number | string => {
    const v = raw.trim();
    if (v === '' || v.toLowerCase() === 'false' || v === '0') return false;
    if (v.toLowerCase() === 'true') return true;
    if (/^\d+$/.test(v)) return Number(v);
    return v;
  }),

  ML_SERVICE_URL: z.string().url().default('http://127.0.0.1:8001'),
  ML_SERVICE_TOKEN: z.string().min(8).default('local-dev-shared-secret-please-change'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = Env.parse(process.env);

export const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
