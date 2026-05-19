import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform, ZodTypeProvider } from 'fastify-type-provider-zod';
import { env, allowedOrigins } from './config.js';
import { authPlugin, requireUser } from './plugins/auth.js';
import { vehicleRoutes } from './routes/vehicles.ts';
import { adminVehicleRoutes } from './routes/admin-vehicles.ts';
import { clientRoutes } from './routes/clients.ts';
import { insightRoutes } from './routes/insights.ts';
import { metricRoutes } from './routes/metrics.ts';
import { aiConfigRoutes } from './routes/ai-config.ts';
import { acoesRoutes } from './routes/acoes.ts';

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
    // ⚠ Cybersec: nunca logar Authorization nem chaves
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, ip: req.ip }),
    },
    redact: ['req.headers.authorization', 'req.headers.cookie', '*.SUPABASE_SERVICE_ROLE_KEY', '*.ANTHROPIC_API_KEY'],
  },
  trustProxy: true,
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(sensible);

// Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, etc.).
// IMPORTANTE: defaults do helmet incluem Cross-Origin-Resource-Policy: same-origin
// que BLOQUEIA cross-origin mesmo com CORS allow. Como temos web em :3000 e API
// em :3333, desligamos COEP/CORP para permitir a integração.
await app.register(helmet, {
  contentSecurityPolicy: env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", env.SUPABASE_URL],
      frameAncestors: ["'none'"],
    },
  } : false, // dev: false (não atrapalha Swagger UI inline)
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // libera consumo cross-origin (web→api)
  crossOriginOpenerPolicy: false,
});

await app.register(multipart, {
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB — e-books e PDFs grandes
});

await app.register(cors, {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

await app.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW,
  keyGenerator: (req) => req.user?.id ?? req.ip,
});

await app.register(swagger, {
  openapi: {
    info: {
      title: 'Ford FIAP Challenge API',
      version: '0.1.0',
      description: 'API gateway que atende Desafio 1 (Inteligência Competitiva) e Desafio 2 (Retenção/VIN Share).',
    },
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearer: [] }],
    tags: [
      { name: 'meta', description: 'Health / introspection' },
      { name: 'Desafio 1 — Inteligência Competitiva', description: 'Catálogo + comparação' },
      { name: 'Desafio 2 — Retenção', description: 'Clientes, predições, leads, KPIs' },
      { name: 'Diferencial — Insights de IA', description: 'Claude API: XAI e portfolio' },
    ],
  },
  transform: jsonSchemaTransform,
});
await app.register(swaggerUi, { routePrefix: '/docs' });

// Handlers globais
app.setErrorHandler((err, req, reply) => {
  const status = (err as any).statusCode ?? 500;
  if (status >= 500) req.log.error({ err }, 'unhandled');
  // ⚠ Cybersec: não vazar stack pro cliente
  reply.code(status).send({
    error: err.name ?? 'error',
    message: status >= 500 ? 'internal error' : err.message,
  });
});

// ===== Rotas =====
await app.register(authPlugin);

app.get('/health', { schema: { tags: ['meta'] } }, async () => ({
  status: 'ok',
  service: 'ford-fiap-api',
  version: '0.1.0',
  ts: new Date().toISOString(),
}));

app.get('/me', { schema: { tags: ['meta'] } }, async (req) => {
  const u = requireUser(req);
  return { id: u.id, email: u.email, role: u.role, dealership_id: u.dealership_id };
});

await app.register(vehicleRoutes);
await app.register(adminVehicleRoutes);
await app.register(clientRoutes);
await app.register(insightRoutes);
await app.register(metricRoutes);
await app.register(aiConfigRoutes);
await app.register(acoesRoutes);

await app.listen({ port: env.API_PORT, host: env.API_HOST });
app.log.info(`📘 Swagger: http://${env.API_HOST}:${env.API_PORT}/docs`);
