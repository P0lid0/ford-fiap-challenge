/**
 * Formato único de resposta de erro da API — Problem Details (RFC 7807).
 *
 * Exemplo:
 *   HTTP/1.1 404 Not Found
 *   Content-Type: application/problem+json
 *   {
 *     "type": "about:blank",
 *     "title": "Not Found",
 *     "status": 404,
 *     "detail": "cliente não encontrado",
 *     "instance": "/clients/5f1c…",
 *     "code": "not_found",
 *     "timestamp": "2026-09-27T20:30:00.000Z",
 *     "error": "not_found",            ← compatibilidade com web/mobile
 *     "message": "cliente não encontrado"
 *   }
 */
import { STATUS_CODES } from 'node:http';
import { z } from 'zod';
import type { FieldError } from './api-error.js';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const ProblemDetailsSchema = z.object({
  type: z.string().describe('URI do tipo de problema (about:blank = semântica do status HTTP)'),
  title: z.string().describe('Resumo do status HTTP'),
  status: z.number().int().describe('Status HTTP'),
  detail: z.string().describe('Explicação legível desta ocorrência'),
  instance: z.string().describe('Caminho da requisição que gerou o erro'),
  code: z.string().describe('Código estável do erro, para tratamento no cliente'),
  timestamp: z.string().describe('Momento do erro (ISO 8601)'),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional()
    .describe('Campos inválidos (apenas em erros de validação)'),
  error: z.string().describe('[compatibilidade] mesmo valor de `code`'),
  message: z.string().describe('[compatibilidade] mesmo valor de `detail`'),
}).describe('Problem Details (RFC 7807)');

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export function buildProblem(params: {
  status: number;
  code: string;
  detail: string;
  instance: string;
  errors?: FieldError[];
}): ProblemDetails {
  return {
    type: 'about:blank',
    title: STATUS_CODES[params.status] ?? 'Error',
    status: params.status,
    detail: params.detail,
    instance: params.instance,
    code: params.code,
    timestamp: new Date().toISOString(),
    ...(params.errors?.length ? { errors: params.errors } : {}),
    error: params.code,
    message: params.detail,
  };
}
