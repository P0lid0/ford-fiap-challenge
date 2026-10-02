-- =====================================================================
-- Autenticação local (PostgreSQL padrão, sem Supabase Auth)
-- =====================================================================
-- profiles deixa de ser 1:1 com auth.users e passa a ser a própria tabela
-- de usuários da aplicação:
--   - password_hash: bcrypt (cost 12) gravado por scripts/db-seed-admin.mjs e
--     scripts/db-create-user.mjs. Nullable: usuário sem hash não consegue logar.
--   - id ganha default gen_random_uuid() (antes vinha de auth.users).
-- O JWT continua sendo emitido pela API (lib/jwt.ts) em POST /auth/login.
-- =====================================================================

alter table public.profiles
  add column if not exists password_hash text;

alter table public.profiles
  alter column id set default gen_random_uuid();

comment on column public.profiles.password_hash is
  'Hash bcrypt (cost 12) da senha. NULL = login desabilitado.';
