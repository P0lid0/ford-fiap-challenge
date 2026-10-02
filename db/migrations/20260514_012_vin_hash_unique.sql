-- ============================================================
-- Substitui o índice parcial em vin_hash por unique completo,
-- pra permitir uso em ON CONFLICT (vin_hash) nos upserts da API/scripts.
--
-- Postgres por padrão permite múltiplos NULLs em UNIQUE (NULLS DISTINCT),
-- então isso não bloqueia clientes sintéticos sem vin_hash.
-- ============================================================
drop index if exists public.clients_vin_hash_unique;
create unique index clients_vin_hash_unique on public.clients(vin_hash);
