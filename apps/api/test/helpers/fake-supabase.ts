/**
 * Banco simulado em memória com a mesma interface do cliente Supabase usada pela API
 * (`from(...).select/insert/update/upsert/delete` + filtros + `single/maybeSingle` + `rpc`).
 *
 * Permite testar as rotas sem Supabase real:
 *   - `seed(tabela, linhas)`         → dados iniciais do cenário
 *   - `rows(tabela)`                 → estado final para asserções
 *   - `failNext(tabela, op, erro)`   → simula falha do Postgres na próxima operação
 *   - `filtersOn(tabela)`            → quais filtros a rota aplicou (ex.: dealership_id)
 */
import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;
type Operation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
type Filter = { kind: 'eq' | 'in' | 'ilike'; column: string; value: any };

export type DbError = { message: string; code?: string; details?: string; hint?: string };
export type RecordedQuery = { table: string; operation: Operation; filters: Filter[] };
type QueryResult = { data: any; error: DbError | null; count: number | null };

const NOT_SINGLE_ROW: DbError = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' };

function matches(row: Row, filter: Filter): boolean {
  const actual = row[filter.column];
  switch (filter.kind) {
    case 'eq':
      return actual !== undefined && actual !== null && String(actual) === String(filter.value);
    case 'in':
      return (filter.value as unknown[]).some((v) => String(v) === String(actual));
    case 'ilike': {
      const value = String(actual ?? '').toLowerCase();
      const parts = String(filter.value).toLowerCase().split('%');
      const prefix = parts.at(0) ?? '';
      const suffix = parts.at(-1) ?? '';
      if (!value.startsWith(prefix) || !value.endsWith(suffix)) return false;
      if (parts.length === 1) return value === prefix;

      const suffixStart = value.length - suffix.length;
      let position = prefix.length;
      for (const part of parts.slice(1, -1)) {
        const found = value.indexOf(part, position);
        if (found < 0 || found + part.length > suffixStart) return false;
        position = found + part.length;
      }
      return position <= suffixStart;
    }
  }
}

export class FakeSupabase {
  private readonly tables = new Map<string, Row[]>();
  private failures: { table: string; operation: Operation; error: DbError }[] = [];
  readonly queries: RecordedQuery[] = [];
  /** Resultado devolvido por qualquer `rpc(...)`. */
  rpcResult: unknown[] = [];

  /** Cliente compatível com `adminClient()` / `publicClient()`. */
  readonly client = {
    from: (table: string) => this.from(table),
    rpc: async (_fn: string, _args?: unknown) => ({ data: this.rpcResult, error: null }),
  };

  reset(): void {
    this.tables.clear();
    this.failures = [];
    this.queries.length = 0;
    this.rpcResult = [];
  }

  seed(table: string, rows: Row[]): void {
    this.tables.set(table, rows.map((r) => structuredClone(r)));
  }

  rows(table: string): Row[] {
    return this.tableRows(table);
  }

  failNext(table: string, operation: Operation, error: DbError): void {
    this.failures.push({ table, operation, error });
  }

  /** Filtros `coluna=valor` aplicados pela rota numa tabela (para verificar escopo). */
  filtersOn(table: string, operation: Operation = 'select'): string[] {
    return this.queries
      .filter((q) => q.table === table && q.operation === operation)
      .flatMap((q) => q.filters.map((f) => `${f.column}=${Array.isArray(f.value) ? f.value.join('|') : f.value}`));
  }

  from(table: string): FakeQuery {
    return new FakeQuery(this, table);
  }

  /** @internal */
  tableRows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  /** @internal */
  takeFailure(table: string, operation: Operation): DbError | undefined {
    const index = this.failures.findIndex((f) => f.table === table && f.operation === operation);
    if (index < 0) return undefined;
    return this.failures.splice(index, 1)[0]!.error;
  }
}

class FakeQuery implements PromiseLike<QueryResult> {
  private operation: Operation = 'select';
  private readonly filters: Filter[] = [];
  private payload: any;
  private cardinality: 'many' | 'single' | 'maybeSingle' = 'many';
  private rangeFrom?: number;
  private rangeTo?: number;
  private limitCount?: number;

  constructor(private readonly db: FakeSupabase, private readonly table: string) {}

  // ----- operações -----
  select(_columns?: string, _options?: { count?: string }): this { return this; }
  insert(rows: Row | Row[]): this { this.operation = 'insert'; this.payload = rows; return this; }
  upsert(rows: Row | Row[], _options?: unknown): this { this.operation = 'upsert'; this.payload = rows; return this; }
  update(patch: Row): this { this.operation = 'update'; this.payload = patch; return this; }
  delete(_options?: { count?: string }): this { this.operation = 'delete'; return this; }

  // ----- filtros e modificadores -----
  eq(column: string, value: unknown): this { this.filters.push({ kind: 'eq', column, value }); return this; }
  in(column: string, values: unknown[]): this { this.filters.push({ kind: 'in', column, value: values }); return this; }
  ilike(column: string, pattern: string): this { this.filters.push({ kind: 'ilike', column, value: pattern }); return this; }
  or(_expression: string): this { return this; }
  order(_column: string, _options?: unknown): this { return this; }
  range(from: number, to: number): this { this.rangeFrom = from; this.rangeTo = to; return this; }
  limit(count: number): this { this.limitCount = count; return this; }
  single(): this { this.cardinality = 'single'; return this; }
  maybeSingle(): this { this.cardinality = 'maybeSingle'; return this; }

  then<R1 = QueryResult, R2 = never>(
    onFulfilled?: ((value: QueryResult) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve().then(() => this.execute()).then(onFulfilled, onRejected);
  }

  private execute(): QueryResult {
    this.db.queries.push({ table: this.table, operation: this.operation, filters: [...this.filters] });

    const failure = this.db.takeFailure(this.table, this.operation);
    if (failure) return { data: null, error: failure, count: null };

    const table = this.db.tableRows(this.table);
    const selected = () => table.filter((row) => this.filters.every((f) => matches(row, f)));

    switch (this.operation) {
      case 'select': {
        const all = selected();
        let page = all;
        if (this.rangeFrom !== undefined) page = page.slice(this.rangeFrom, (this.rangeTo ?? page.length) + 1);
        if (this.limitCount !== undefined) page = page.slice(0, this.limitCount);
        return this.shape(page.map((r) => structuredClone(r)), all.length);
      }
      case 'insert': {
        const inserted = this.asArray(this.payload).map((r) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...r }));
        table.push(...inserted);
        return this.shape(inserted.map((r) => structuredClone(r)), inserted.length);
      }
      case 'upsert': {
        const result = this.asArray(this.payload).map((r) => {
          const existing = r.id ? table.find((row) => row.id === r.id) : undefined;
          if (existing) return Object.assign(existing, r);
          const created = { id: randomUUID(), created_at: new Date().toISOString(), ...r };
          table.push(created);
          return created;
        });
        return this.shape(result.map((r) => structuredClone(r)), result.length);
      }
      case 'update': {
        const updated = selected().map((row) => Object.assign(row, this.payload));
        return this.shape(updated.map((r) => structuredClone(r)), updated.length);
      }
      case 'delete': {
        const removed = selected();
        for (const row of removed) table.splice(table.indexOf(row), 1);
        return this.shape(removed, removed.length);
      }
    }
  }

  /** Aplica a semântica de `single()` / `maybeSingle()` do PostgREST. */
  private shape(rows: Row[], count: number): QueryResult {
    if (this.cardinality === 'many') return { data: rows, error: null, count };
    if (rows.length === 1) return { data: rows[0], error: null, count };
    if (rows.length === 0 && this.cardinality === 'maybeSingle') return { data: null, error: null, count };
    return { data: null, error: NOT_SINGLE_ROW, count };
  }

  private asArray(value: Row | Row[]): Row[] {
    return Array.isArray(value) ? value : [value];
  }
}
