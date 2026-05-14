-- =====================================================================
-- RLS — Row Level Security
-- =====================================================================
-- Regra de ouro: tudo NEGADO por default; abre só o que precisa.
-- =====================================================================

-- Habilita RLS em todas as tabelas
alter table public.profiles enable row level security;
alter table public.dealerships enable row level security;
alter table public.clients enable row level security;
alter table public.client_history enable row level security;
alter table public.predictions enable row level security;
alter table public.vehicles enable row level security;
alter table public.ai_insights enable row level security;
alter table public.audit_log enable row level security;

-- ============== Helpers ==============
create or replace function public.current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_dealership() returns uuid
language sql stable security definer set search_path = public as $$
  select dealership_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- ============== profiles ==============
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ============== dealerships ==============
create policy dealerships_authenticated_read on public.dealerships
  for select using (auth.role() = 'authenticated');

create policy dealerships_admin_write on public.dealerships
  for all using (public.is_admin()) with check (public.is_admin());

-- ============== clients ==============
-- Analista vê só clientes da sua dealership. Gestor vê todos da rede.
create policy clients_select_dealership on public.clients
  for select using (
    public.is_admin()
    or public.current_user_role() = 'gestor'
    or dealership_id = public.current_user_dealership()
  );

create policy clients_insert_own_dealership on public.clients
  for insert with check (
    dealership_id = public.current_user_dealership() or public.is_admin()
  );

create policy clients_update_own_dealership on public.clients
  for update using (
    public.is_admin() or dealership_id = public.current_user_dealership()
  );

-- ============== client_history ==============
-- Espelha a permissão do client pai.
create policy client_history_select on public.client_history
  for select using (
    exists (
      select 1 from public.clients c
      where c.id = client_history.client_id
        and (
          public.is_admin()
          or public.current_user_role() = 'gestor'
          or c.dealership_id = public.current_user_dealership()
        )
    )
  );

create policy client_history_insert on public.client_history
  for insert with check (
    exists (
      select 1 from public.clients c
      where c.id = client_history.client_id
        and (public.is_admin() or c.dealership_id = public.current_user_dealership())
    )
  );

-- ============== predictions ==============
create policy predictions_select on public.predictions
  for select using (
    exists (
      select 1 from public.clients c
      where c.id = predictions.client_id
        and (
          public.is_admin()
          or public.current_user_role() = 'gestor'
          or c.dealership_id = public.current_user_dealership()
        )
    )
  );

-- predictions são escritas pela API (service role) — não há política de INSERT/UPDATE
-- para usuários normais. Apenas o service_role bypassa RLS.

-- ============== vehicles ==============
-- Catálogo competitivo: leitura para todos autenticados, escrita só backend.
create policy vehicles_authenticated_read on public.vehicles
  for select using (auth.role() = 'authenticated');

-- ============== ai_insights ==============
create policy ai_insights_authenticated_read on public.ai_insights
  for select using (auth.role() = 'authenticated');

-- ============== audit_log ==============
create policy audit_log_admin_read on public.audit_log
  for select using (public.is_admin());

-- audit_log é escrito só pelo service_role.
