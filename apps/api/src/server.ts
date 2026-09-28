import { buildApp } from './app.js';
import { env } from './config.js';

// Ponto de entrada do processo: monta a aplicação e abre a porta HTTP.
// Toda a configuração (plugins, segurança, rotas) vive em app.ts.
const app = await buildApp();

await app.listen({ port: env.API_PORT, host: env.API_HOST });
app.log.info(`📘 Swagger: http://${env.API_HOST}:${env.API_PORT}/docs`);
