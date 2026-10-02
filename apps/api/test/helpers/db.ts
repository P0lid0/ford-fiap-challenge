/**
 * Acesso ao PostgreSQL de teste (`faroai_test`) — o MESMO driver e o mesmo `sql`
 * que a API usa, então o que o teste grava é exatamente o que a rota enxerga.
 *
 *   useTestDatabase()          → registra o reset do banco antes de cada teste
 *   resetDb()                  → apaga os dados e semeia concessionárias A/B + usuários
 *   insertClient / insertVehicle / insertAcao / insertPrediction → semeadores
 *   rows(tabela) / auditRows(action?) → estado final para as asserções
 *   failOn(...)                → faz uma operação REAL falhar (gatilho que levanta exceção)
 *   comTabelaIndisponivel(...) → simula banco/tabela fora do ar (renomeia a tabela por instantes)
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach } from 'vitest';
import type postgres from 'postgres';
import { sql } from '../../src/lib/db.js';
import { BCRYPT_COST } from '../../src/lib/identity.js';
import type { UserRole } from '../../src/lib/jwt.js';

export { sql };

export const DEALERSHIP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const DEALERSHIP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Senha de todos os usuários semeados. */
export const TEST_PASSWORD = 'Senha#123';

type Row = Record<string, any>;

// ----- usuários padrão: 1 por (perfil × concessionária) ---------------------------------

export const ROLES: UserRole[] = ['analista', 'gestor', 'admin'];
const DEALERSHIPS: Record<string, string | null> = { a: DEALERSHIP_A, b: DEALERSHIP_B, sem: null };

function dealershipLabel(dealershipId: string | null): string {
  const label = Object.entries(DEALERSHIPS).find(([, id]) => id === dealershipId)?.[0];
  if (!label) throw new Error(`concessionária desconhecida nos testes: ${dealershipId}`);
  return label;
}

export type TestUser = { id: string; email: string; role: UserRole; dealershipId: string | null };

/** Usuário padrão do perfil/concessionária informados (existe em TODO teste, após o reset). */
export function testUser(role: UserRole, dealershipId: string | null = DEALERSHIP_A): TestUser {
  const label = dealershipLabel(dealershipId);
  const index = ROLES.indexOf(role) * 10 + Object.keys(DEALERSHIPS).indexOf(label) + 1;
  return {
    id: `11111111-1111-4111-8111-${index.toString(16).padStart(12, '0')}`,
    email: `${role}.${label}@faroai.test`,
    role,
    dealershipId,
  };
}

let hashCache: Promise<string> | undefined;
/** Hash bcrypt (custo de produção) da senha de teste — calculado uma vez por arquivo. */
export function testPasswordHash(): Promise<string> {
  hashCache ??= bcrypt.hash(TEST_PASSWORD, BCRYPT_COST);
  return hashCache;
}

/**
 * Cria um usuário em public.profiles (perfil analista, sem concessionária, com a senha de
 * teste — a menos que `password_hash` seja informado, inclusive `null` = usuário sem senha).
 */
export async function insertUser(over: Row & { email: string }): Promise<Row> {
  const row = { id: randomUUID(), password_hash: await testPasswordHash(), ...over };
  const [user] = await sql`insert into public.profiles ${sql(row)} returning *`;
  return user!;
}

// ----- reset ---------------------------------------------------------------------------

const DATA_TABLES = [
  'audit_log', 'email_logs', 'acoes_retencao', 'client_history', 'predictions', 'clients',
  'vehicle_catalog_values', 'vehicles', 'catalog_items', 'ai_insights', 'ai_function_models',
  'ai_keys', 'profiles',
];

/**
 * Deixa o banco no estado inicial de todo teste: tabelas de dados vazias (filhas antes das mães),
 * duas concessionárias (A e B) e os 9 usuários padrão. `dealerships` e
 * `schema_migrations` NÃO são apagadas (vêm das migrations).
 */
export async function resetDb(): Promise<void> {
  // DELETE em ordem de dependência, numa única transação (simple query): ~10x mais rápido que TRUNCATE.
  await sql.unsafe(DATA_TABLES.map((t) => `delete from public.${t}`).join('; '));

  await sql`
    insert into public.dealerships (id, codigo, nome, regiao, cidade, uf) values
      (${DEALERSHIP_A}, 'TST-A', 'Concessionária de teste A', 'sudeste', 'São Paulo', 'SP'),
      (${DEALERSHIP_B}, 'TST-B', 'Concessionária de teste B', 'sul', 'Curitiba', 'PR')
    on conflict (id) do nothing
  `;

  const passwordHash = await testPasswordHash();
  const users = ROLES.flatMap((role) => Object.values(DEALERSHIPS).map((d) => testUser(role, d)));
  await sql`insert into public.profiles ${sql(users.map((u) => ({
    id: u.id, email: u.email, role: u.role, dealership_id: u.dealershipId, password_hash: passwordHash,
  })))}`;
}

/** Liga o reset do banco antes de cada teste e fecha o pool ao final do arquivo. */
export function useTestDatabase(): void {
  beforeEach(resetDb);
  afterAll(async () => { await sql.end({ timeout: 5 }); });
}

// ----- semeadores ----------------------------------------------------------------------

export async function insertClient(over: Row = {}): Promise<Row> {
  const row = {
    dealership_id: DEALERSHIP_A, model_name: 'RANGER', model_year: 2024, sales_date: '2024-03-10',
    nome_cliente: 'Cliente de teste', ...over,
  };
  const [client] = await sql`insert into public.clients ${sql(row)} returning *`;
  return client!;
}

export async function insertPrediction(clientId: string, over: Row = {}): Promise<Row> {
  const row = {
    client_id: clientId, model_version: 'teste-1', perfil_predito: 'fiel',
    prob_fiel: 0.7, prob_abandono: 0.1, prob_esquecido: 0.1, prob_economico: 0.1,
    risco_evasao: 0.2, confianca: 0.7, ...over,
  };
  const [prediction] = await sql`insert into public.predictions ${sql(row)} returning *`;
  return prediction!;
}

export async function insertAcao(over: Row & { client_id: string }): Promise<Row> {
  const row = { dealership_id: DEALERSHIP_A, tipo: 'ligacao', titulo: 'Ação de teste', status: 'planejada', ...over };
  const [acao] = await sql`insert into public.acoes_retencao ${sql(row)} returning *`;
  return acao!;
}

/** Veículo do catálogo. As colunas jsonb (motor, dimensoes, transmissao, desempenho) podem ser objetos comuns. */
export async function insertVehicle(over: Row): Promise<Row> {
  const row: Row = { categoria: 'picape', ...over };
  for (const key of ['motor', 'dimensoes', 'transmissao', 'desempenho']) {
    row[key] = sql.json((row[key] ?? {}) as postgres.JSONValue);
  }
  const [vehicle] = await sql`insert into public.vehicles ${sql(row)} returning *`;
  return vehicle!;
}

// ----- leitura -------------------------------------------------------------------------

/** Linhas de uma tabela, para as asserções de estado final. */
export async function rows(table: string, orderBy = 'created_at'): Promise<Row[]> {
  return sql.unsafe(`select * from public.${table} order by ${orderBy}`);
}

/** Eventos gravados no audit_log (opcionalmente só de uma ação). */
export async function auditRows(action?: string): Promise<Row[]> {
  return action
    ? sql`select * from public.audit_log where action = ${action} order by id`
    : sql`select * from public.audit_log order by id`;
}

// ----- falhas reais de banco -----------------------------------------------------------

const literal = (text: string) => `'${text.replaceAll("'", "''")}'`;

/**
 * Faz a PRÓXIMA operação (insert/update/delete) na tabela falhar de verdade, com o
 * erro do Postgres informado, via gatilho que levanta exceção. Devolve a função que
 * remove o gatilho — chame num `finally`.
 */
export async function failOn(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  error: { code: string; message: string; hint?: string },
): Promise<() => Promise<void>> {
  const name = `zz_teste_falha_${table}_${operation}`;
  const hint = error.hint ? `, hint = ${literal(error.hint)}` : '';
  await sql.unsafe(`
    create or replace function public.${name}() returns trigger language plpgsql as $f$
    begin
      raise exception ${literal(error.message)} using errcode = ${literal(error.code)}${hint};
    end $f$;
  `);
  await sql.unsafe(`create trigger ${name} before ${operation} on public.${table} for each statement execute function public.${name}()`);
  return async () => {
    await sql.unsafe(`drop trigger if exists ${name} on public.${table}`);
    await sql.unsafe(`drop function if exists public.${name}()`);
  };
}

/**
 * Executa `acao` com a tabela fora do ar (renomeada) — qualquer query a ela falha com
 * "relation does not exist" (42P01). Restaura SEMPRE ao final. Os testes rodam em série
 * (fileParallelism: false), então nenhum outro arquivo enxerga a tabela renomeada.
 */
export async function comTabelaIndisponivel<T>(table: string, acao: () => Promise<T>): Promise<T> {
  await sql.unsafe(`alter table public.${table} rename to ${table}__indisponivel`);
  try {
    return await acao();
  } finally {
    await sql.unsafe(`alter table public.${table}__indisponivel rename to ${table}`);
  }
}
