/**
 * Erro de negócio/HTTP lançado pelas rotas e hooks.
 *
 * Uso nas rotas:   throw notFound('cliente não encontrado');
 * O error handler global (plugins/error-handler.ts) converte em resposta
 * Problem Details (RFC 7807) com o status HTTP correto.
 */
export type FieldError = {
  field: string;
  message: string;
};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly errors?: FieldError[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------- 4xx: problema na requisição do cliente ----------

/** 400 — requisição malformada ou regra de negócio violada pelos dados enviados. */
export function badRequest(message: string, code = 'bad_request', errors?: FieldError[]): ApiError {
  return new ApiError(400, code, message, errors);
}

/** 401 — requisição sem credencial válida. */
export function unauthorized(message = 'autenticação necessária', code = 'unauthorized'): ApiError {
  return new ApiError(401, code, message);
}

/** 403 — usuário autenticado, mas o perfil não tem permissão. */
export function forbidden(message = 'perfil sem permissão para este recurso', code = 'forbidden'): ApiError {
  return new ApiError(403, code, message);
}

/** 404 — recurso não existe (ou não é visível para este usuário). */
export function notFound(message = 'recurso não encontrado', code = 'not_found'): ApiError {
  return new ApiError(404, code, message);
}

/** 409 — conflito com o estado atual do recurso (ex.: duplicidade). */
export function conflict(message: string, code = 'conflict'): ApiError {
  return new ApiError(409, code, message);
}

/** 422 — requisição válida, mas o conteúdo não pôde ser processado. */
export function unprocessable(message: string, code = 'unprocessable_entity'): ApiError {
  return new ApiError(422, code, message);
}

/** 415 — formato do arquivo/corpo enviado não é aceito pela rota. */
export function unsupportedMediaType(message: string, code = 'unsupported_media_type'): ApiError {
  return new ApiError(415, code, message);
}

// ---------- 5xx: problema no servidor ou em serviço externo ----------

/** 502 — serviço externo (FIPE, IA, banco de identidade…) respondeu com erro. */
export function badGateway(message: string, code = 'bad_gateway'): ApiError {
  return new ApiError(502, code, message);
}

/** 503 — recurso temporariamente indisponível (dependência fora do ar / não configurada). */
export function serviceUnavailable(message: string, code = 'service_unavailable'): ApiError {
  return new ApiError(503, code, message);
}
