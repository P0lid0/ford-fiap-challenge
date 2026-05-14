-- Permite edição manual + verificação humana + auditoria de alterações.
alter table public.vehicles
  add column if not exists verificado_manualmente boolean not null default false,
  add column if not exists verificado_por uuid references public.profiles(id) on delete set null,
  add column if not exists verificado_em timestamptz,
  add column if not exists editado_por uuid references public.profiles(id) on delete set null,
  add column if not exists editado_em timestamptz,
  add column if not exists notas text;

create index if not exists vehicles_verificado_idx on public.vehicles(verificado_manualmente);

-- Policy de UPDATE/INSERT/DELETE para admin (analista pode propor, admin/gestor edita)
create policy vehicles_admin_write on public.vehicles
  for all using (public.is_admin() or public.current_user_role() = 'gestor')
  with check (public.is_admin() or public.current_user_role() = 'gestor');

-- Permite analista inserir (criar carro novo manualmente)
create policy vehicles_authenticated_insert on public.vehicles
  for insert with check (auth.role() = 'authenticated');

-- Marca os seeds iniciais como verified (eles foram inseridos por nós, são autoritativos)
update public.vehicles
  set verificado_manualmente = true, verificado_em = now()
  where fontes && array['seed']::text[];
