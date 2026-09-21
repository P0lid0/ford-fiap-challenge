#!/usr/bin/env node
/**
 * Limpa o catálogo de veículos pra deixar APENAS as 3 versões da Ford Ranger 26MY
 * que vieram do datasheet oficial Ford (D1).
 *
 * Ranger que ficam:
 *   - Ford Ranger XLT 3.0L V6 AT 26MY
 *   - Ford Ranger Limited 3.0L V6 26MY
 *   - Ford Ranger Limited + 3.0L V6 26MY
 *
 * Cascata automática:
 *   - vehicle_catalog_values (FK ON DELETE CASCADE) → some junto
 *
 * Conecta direto no PostgreSQL (DATABASE_URL do ambiente ou de .env.local).
 * IMPORTANTE: ação destrutiva e autorizada explicitamente pelo usuário.
 */
import postgres from 'postgres';
import { databaseUrl } from './lib/env.mjs';

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });

try {
  // === auditoria antes ===
  const [before] = await sql`select count(*)::int as n from public.vehicles`;
  const keep = await sql`
    select id, versao
    from public.vehicles
    where lower(marca)='ford' and lower(modelo)='ranger' and ano=2026
    order by versao
  `;
  console.log('📊 Antes:', before.n, 'veículos');
  console.log('🛡  Vou MANTER:');
  for (const r of keep) console.log(`   - ${r.id.slice(0,8)}…  ${r.versao}`);
  console.log(`🗑  Vou APAGAR: ${before.n - keep.length} veículos`);

  if (keep.length !== 3) {
    throw new Error(`Esperava 3 Ranger 26MY. Achei ${keep.length} — abortando.`);
  }

  // === delete ===
  const keepIds = keep.map(r => r.id);
  console.log('\n🚀 Executando DELETE…');
  await sql`delete from public.vehicles where id <> all(${keepIds}::uuid[])`;

  // === auditoria depois ===
  const [after] = await sql`select count(*)::int as n from public.vehicles`;
  const [afterValues] = await sql`select count(*)::int as n from public.vehicle_catalog_values`;
  console.log(`✅ Restam ${after.n} veículos no catálogo`);
  console.log(`✅ ${afterValues.n} valores canônicos (esperado: ${3 * 262} = 786)`);
} catch (err) {
  console.error('\n❌', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
