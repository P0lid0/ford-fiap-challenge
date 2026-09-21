-- Permite edição manual + verificação humana + auditoria de alterações.
alter table public.vehicles
  add column if not exists verificado_manualmente boolean not null default false,
  add column if not exists verificado_por uuid references public.profiles(id) on delete set null,
  add column if not exists verificado_em timestamptz,
  add column if not exists editado_por uuid references public.profiles(id) on delete set null,
  add column if not exists editado_em timestamptz,
  add column if not exists notas text;

create index if not exists vehicles_verificado_idx on public.vehicles(verificado_manualmente);

-- Regra de escrita (analista pode propor/inserir, admin/gestor edita) é
-- aplicada pela API (requireRole nas rotas de admin-vehicles).

-- Marca os seeds iniciais como verified (eles foram inseridos por nós, são autoritativos)
update public.vehicles
  set verificado_manualmente = true, verificado_em = now()
  where fontes && array['seed']::text[];
