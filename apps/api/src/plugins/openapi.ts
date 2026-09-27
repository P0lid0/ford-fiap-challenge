/**
 * Documentação OpenAPI automática de ACESSO e ERROS de cada rota.
 *
 * Em vez de repetir as respostas de erro em ~50 rotas, um hook `onRoute`
 * completa o schema de cada rota no momento do registro:
 *
 *   - 400 → rota com body/querystring/params validados (Zod)
 *   - 401 → rota protegida (sem `config.public`)
 *   - 403 → rota com `authorize(...)` ou restrita por concessionária
 *   - 429 / 500 → todas as rotas
 *   - 404 / 409 / 415 / 422 / 502 / 503 → conforme ROUTE_ERRORS (abaixo)
 *
 * Também acrescenta à descrição da rota quem pode acessá-la
 * (público · qualquer usuário autenticado · perfis específicos).
 *
 * Todas as respostas de erro usam o mesmo schema ProblemDetails (RFC 7807),
 * publicado uma única vez em `components.schemas` e referenciado por `$ref`.
 */
import type { FastifyInstance, RouteOptions } from 'fastify';
import fp from 'fastify-plugin';
import { createJsonSchemaTransformObject } from 'fastify-type-provider-zod';
import { ProblemDetailsSchema, PROBLEM_CONTENT_TYPE } from '../lib/problem-details.js';
import { allowedRolesOf } from './auth.js';

/** Texto de abertura do Swagger UI (Markdown). */
export const API_DESCRIPTION = `
API REST do **Faro AI** (Ford × FIAP Challenge 2026) — atende o Desafio 1 (Inteligência Competitiva)
e o Desafio 2 (Retenção / VIN Share).

## Como autenticar
1. Chame \`POST /auth/login\` com \`{ "email", "password" }\`.
2. Copie o \`access_token\` da resposta.
3. Clique em **Authorize** e cole o token. As chamadas seguintes enviam \`Authorization: Bearer <token>\`.

O token é um **JWT HS256** emitido pela própria API, válido por \`expires_in\` segundos (padrão: 1 hora).
Claims: \`sub\`, \`email\`, \`role\`, \`dealership_id\`, \`iss\`, \`aud\`, \`iat\`, \`exp\`, \`jti\`.
Tokens do Supabase (usados pelo web/mobile) continuam aceitos.

## Perfis de acesso
| Perfil | Leitura | Alteração |
|---|---|---|
| \`analista\` | só a própria concessionária | só a própria concessionária |
| \`gestor\` | rede inteira | só a própria concessionária · cadastro de veículos · campanhas |
| \`admin\` | rede inteira | tudo, inclusive chaves de IA (\`/admin/ai-keys\`) |

Toda rota é **protegida por padrão**; cada operação informa na descrição quem pode acessá-la.
Registros de outra concessionária respondem **404** (a API não revela que existem).

## Formato de erro
Todos os erros seguem **Problem Details (RFC 7807)** com \`Content-Type: application/problem+json\` —
veja o schema \`ProblemDetails\`. O campo \`code\` é estável e pode ser usado pelo cliente para tratar cada caso.
`.trim();

/** Erros específicos de cada rota, além dos automáticos. Chave: "MÉTODO /url". */
export const ROUTE_ERRORS: Record<string, number[]> = {
  // ----- Autenticação -----
  'POST /auth/login': [502], // Supabase Auth indisponível
  // ----- Desafio 2: clientes (escopo de concessionária → 403 no_dealership) -----
  'POST /clients': [403, 409],
  'GET /clients': [403],
  'GET /clients/:id': [403, 404],
  'PATCH /clients/:id/notas': [403, 404],
  'POST /clients/:id/reclassify': [403, 404],
  // ----- Desafio 2: ações de retenção -----
  'POST /acoes': [403, 404],
  'GET /acoes': [403],
  'PATCH /acoes/:id': [403, 404],
  'GET /acoes/kpis': [403],
  'POST /acoes/email-send': [403, 404, 422],
  'GET /acoes/email-templates/:client_id': [403, 404],
  // ----- Desafio 2: insights e métricas -----
  'GET /insights/client/:id': [403, 404],
  'GET /insights/portfolio': [403],
  'GET /metrics/ford-real': [503],
  // ----- Desafio 1: catálogo competitivo -----
  'GET /competitive/lookup': [404],
  'POST /competitive/compare': [422],
  'POST /competitive/compare/canonico': [422],
  'POST /competitive/compare/analyze': [422],
  'POST /competitive/search': [404],
  'GET /competitive/vehicles/:id': [404],
  'DELETE /competitive/vehicles/:id': [404],
  'POST /competitive/vehicles/:id/refresh': [404],
  'POST /competitive/vehicles/:id/refresh-price': [404, 502],
  'POST /competitive/search/fipe': [404, 502],
  'PATCH /competitive/vehicles/:id': [404],
  'POST /competitive/vehicles/import': [422],
  'POST /competitive/import/file': [400, 415, 422, 502], // multipart: 400 vem da própria rota
  'GET /competitive/vehicles/:id/catalog-values': [404],
  'PATCH /competitive/vehicles/:id/catalog-values': [404],
  'POST /competitive/vehicles/:id/catalog-values/auto-fill': [404, 502, 503],
};

/** Descrição de cada status na documentação. */
const STATUS_DESCRIPTIONS: Record<number, string> = {
  400: 'Requisição inválida (validação dos campos ou JSON malformado)',
  401: 'Token ausente, inválido ou expirado',
  403: 'Perfil sem permissão, ou usuário sem concessionária vinculada',
  404: 'Recurso não encontrado (ou não visível para este usuário)',
  409: 'Conflito com um registro existente',
  415: 'Tipo de arquivo não suportado',
  422: 'Dados válidos, mas que não puderam ser processados',
  429: 'Limite de requisições excedido',
  500: 'Erro interno do servidor',
  502: 'Serviço externo (FIPE / IA) falhou',
  503: 'Dependência indisponível ou dados ainda não carregados',
};

const ROLE_LABELS: Record<string, string> = { analista: 'analista', gestor: 'gestor', admin: 'admin' };

function routeKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function accessDescription(route: RouteOptions, roles: string[] | null): string {
  if (route.config?.public === true) return '🔓 **Acesso:** público (não exige token)';
  if (roles) return `🔒 **Acesso:** perfis ${roles.map((r) => `\`${ROLE_LABELS[r] ?? r}\``).join(', ')}`;
  return '🔒 **Acesso:** qualquer usuário autenticado';
}

export const openApiRoutesPlugin = fp(async function openApiRoutesPluginImpl(app: FastifyInstance) {
  const documented = new Set<string>();

  app.addHook('onRoute', (route) => {
    if (route.url.startsWith('/docs')) return;
    const methods = asArray(route.method).filter((m) => m !== 'HEAD');
    if (methods.length === 0) return;

    const schema = (route.schema ??= {}) as Record<string, any>;
    if (schema.hide) return;

    const roles = asArray(route.onRequest).map(allowedRolesOf).find((r) => r !== null) ?? null;

    const codes = new Set<number>([429, 500]);
    if (schema.body || schema.querystring || schema.params) codes.add(400);
    if (route.config?.public !== true) codes.add(401);
    if (roles) codes.add(403);
    for (const method of methods) {
      const key = routeKey(method, route.url);
      for (const code of ROUTE_ERRORS[key] ?? []) codes.add(code);
      documented.add(key);
    }

    const errorResponses = Object.fromEntries([...codes].map((code) => [code, ProblemDetailsSchema]));
    // Respostas declaradas na própria rota têm prioridade.
    schema.response = { ...errorResponses, ...(schema.response ?? {}) };
    schema.description = [schema.description, accessDescription(route, roles)].filter(Boolean).join('\n\n');
  });

  // Aviso de manutenção: entrada em ROUTE_ERRORS que não corresponde a nenhuma rota.
  app.addHook('onReady', async () => {
    const orphans = Object.keys(ROUTE_ERRORS).filter((key) => !documented.has(key));
    if (orphans.length) app.log.warn({ orphans }, '[openapi] ROUTE_ERRORS contém rotas inexistentes');
  });
});

/**
 * Pós-processa o documento OpenAPI:
 *  1. publica ProblemDetails em components.schemas e troca as cópias por $ref;
 *  2. usa o content-type real dos erros (application/problem+json) e
 *     uma descrição legível para cada status.
 */
const resolveComponentRefs = createJsonSchemaTransformObject({ schemas: { ProblemDetails: ProblemDetailsSchema } });
const PROBLEM_REF = '#/components/schemas/ProblemDetails';

type OpenApiResponse = { description?: string; content?: Record<string, { schema?: { $ref?: string } }> };
type OpenApiDocument = { paths?: Record<string, Record<string, { responses?: Record<string, OpenApiResponse> }>> };

export function openApiTransformObject(input: Parameters<typeof resolveComponentRefs>[0]) {
  const document = resolveComponentRefs(input) as OpenApiDocument;

  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem ?? {})) {
      for (const [status, response] of Object.entries(operation?.responses ?? {})) {
        if (response.content?.['application/json']?.schema?.$ref !== PROBLEM_REF) continue;
        response.description = STATUS_DESCRIPTIONS[Number(status)] ?? 'Erro';
        response.content = { [PROBLEM_CONTENT_TYPE]: { schema: { $ref: PROBLEM_REF } } };
      }
    }
  }
  return document;
}
