/**
 * Tratamento global de erros → Problem Details (RFC 7807).
 *
 * Toda falha da API sai no MESMO formato, qualquer que seja a origem:
 *   - ApiError lançado pelas rotas/hooks (400, 401, 403, 404, 409, 422, 502, 503)
 *   - validação de entrada (Zod)                         → 400 + lista de campos
 *   - limite de requisições (@fastify/rate-limit)        → 429
 *   - erros do framework (JSON inválido, payload grande) → 4xx correspondente
 *   - qualquer erro inesperado                           → 500 genérico (sem stack)
 *   - rota inexistente                                   → 404
 */
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ApiError, type FieldError } from '../lib/api-error.js';
import { buildProblem, PROBLEM_CONTENT_TYPE, type ProblemDetails } from '../lib/problem-details.js';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  406: 'not_acceptable',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'unprocessable_entity',
  429: 'rate_limited',
};

type ValidationIssue = { instancePath?: string; message?: string };

/** Converte os erros de validação do Zod em [{ field: 'body.email', message }]. */
function toFieldErrors(err: FastifyError): FieldError[] {
  const context = err.validationContext ?? 'request';
  return ((err.validation ?? []) as ValidationIssue[]).map((issue) => {
    const path = (issue.instancePath ?? '').split('/').filter(Boolean).join('.');
    return {
      field: path ? `${context}.${path}` : context,
      message: issue.message ?? 'valor inválido',
    };
  });
}

/** Caminho da requisição sem query string (evita ecoar parâmetros sensíveis). */
function instanceOf(req: FastifyRequest): string {
  return req.url.split('?')[0] ?? req.url;
}

function toProblem(err: FastifyError | ApiError, req: FastifyRequest): ProblemDetails {
  const instance = instanceOf(req);

  if (err instanceof ApiError) {
    return buildProblem({ status: err.statusCode, code: err.code, detail: err.message, instance, errors: err.errors });
  }

  if (Array.isArray(err.validation)) {
    return buildProblem({
      status: 400,
      code: 'validation_error',
      detail: 'dados inválidos na requisição',
      instance,
      errors: toFieldErrors(err),
    });
  }

  const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;

  if (status === 429) {
    return buildProblem({ status, code: 'rate_limited', detail: 'limite de requisições excedido — tente novamente mais tarde', instance });
  }
  if (status < 500) {
    // Mensagens do framework (JSON malformado, payload grande…) são seguras de expor.
    return buildProblem({ status, code: CODE_BY_STATUS[status] ?? `http_${status}`, detail: err.message, instance });
  }
  // ⚠ Cybersec: erro inesperado — nunca vazar mensagem interna nem stack trace.
  return buildProblem({ status, code: 'internal_error', detail: 'erro interno do servidor', instance });
}

function sendProblem(reply: FastifyReply, problem: ProblemDetails): FastifyReply {
  // RFC 6750: respostas 401 indicam o esquema de autenticação esperado.
  if (problem.status === 401) {
    const tokenProblem = problem.code === 'token_expired' || problem.code === 'invalid_token';
    reply.header('WWW-Authenticate', tokenProblem ? 'Bearer error="invalid_token"' : 'Bearer');
  }
  return reply.code(problem.status).type(PROBLEM_CONTENT_TYPE).send(problem);
}

// fp() aplica o handler na instância raiz → vale para todas as rotas e plugins.
export const errorHandlerPlugin = fp(async function errorHandlerPluginImpl(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | ApiError, req, reply) => {
    const problem = toProblem(err, req);
    if (problem.status >= 500) {
      req.log.error({ err, code: problem.code }, 'request failed');
    }
    return sendProblem(reply, problem);
  });

  app.setNotFoundHandler((req, reply) => {
    return sendProblem(reply, buildProblem({
      status: 404,
      code: 'route_not_found',
      detail: `rota ${req.method} ${instanceOf(req)} não existe`,
      instance: instanceOf(req),
    }));
  });
});
