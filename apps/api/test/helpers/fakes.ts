/**
 * Dublês das dependências EXTERNAS da API (IA, FIPE e rede). O `test/setup.ts` liga
 * cada um no lugar do módulo real; cada teste configura o comportamento que precisa.
 *
 * O banco NÃO é simulado: os testes usam o PostgreSQL real de teste (helpers/db.ts).
 * Nenhum teste acessa a internet, o serviço de ML, IA ou FIPE reais.
 */
type ChatResult = { output: string; provider: string; model: string };

/** Provedor de IA (substitui aiAvailable/chat de lib/ai.ts). */
export const fakeAi = {
  available: false,
  chat: async (..._args: unknown[]): Promise<ChatResult> => {
    throw new Error('IA desabilitada nos testes');
  },
};

/** Tabela FIPE (substitui fipe.findVehicle/fipe.preco). */
export const fakeFipe = {
  findVehicle: async (..._args: unknown[]): Promise<any> => null,
  preco: async (..._args: unknown[]): Promise<any> => {
    throw new Error('FIPE indisponível nos testes');
  },
};

type HttpHandler = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Rede HTTP (substitui fetch global). Por padrão bloqueia qualquer chamada —
 * inclusive ao serviço de ML, que fica "indisponível" como no ambiente sem o modelo no ar.
 */
export const fakeHttp: { handler: HttpHandler } = {
  handler: async (url) => {
    throw new Error(`rede bloqueada nos testes: ${url}`);
  },
};

export function resetFakes(): void {
  fakeAi.available = false;
  fakeAi.chat = async () => { throw new Error('IA desabilitada nos testes'); };
  fakeFipe.findVehicle = async () => null;
  fakeFipe.preco = async () => { throw new Error('FIPE indisponível nos testes'); };
  fakeHttp.handler = async (url) => { throw new Error(`rede bloqueada nos testes: ${url}`); };
}
