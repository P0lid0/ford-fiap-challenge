-- =====================================================================
-- Autenticação própria (PostgreSQL padrão, sem Supabase Auth)
-- =====================================================================
-- profiles deixa de ser 1:1 com auth.users e passa a ser a própria tabela
-- de usuários da aplicação:
--   - password_hash: bcrypt (cost 12) gerado pela API em /auth/register e
--     pelo scripts/db-seed-admin.mjs. Nullable: usuário sem hash não loga.
--   - id ganha default gen_random_uuid() (antes vinha de auth.users).
-- =====================================================================

alter table public.profiles
  add column if not exists password_hash text;

alter table public.profiles
  alter column id set default gen_random_uuid();

comment on column public.profiles.password_hash is
  'Hash bcrypt (cost 12) da senha. NULL = login desabilitado.';
