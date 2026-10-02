/**
 * Entrada serverless da API na Vercel.
 *
 * Reaproveita buildApp() (src/app.ts, compilado em dist/ pelo `pnpm build`) e
 * entrega cada requisição ao servidor HTTP interno do Fastify. A instância é
 * criada uma vez por processo e reaproveitada entre invocações (Fluid compute).
 * Localmente nada muda: `pnpm dev` / src/server.ts continuam abrindo a porta.
 */
import { buildApp } from '../dist/app.js';

const appReady = buildApp().then(async (app) => {
  await app.ready();
  return app;
});

export default async function handler(req, res) {
  const app = await appReady;
  app.server.emit('request', req, res);
}
