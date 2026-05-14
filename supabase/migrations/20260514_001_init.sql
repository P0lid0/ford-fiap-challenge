-- =====================================================================
-- Ford FIAP Challenge — Schema inicial
-- =====================================================================
-- Princípios:
-- 1. RLS habilitada em TODAS as tabelas. Sem exceção.
-- 2. Foreign keys com ON DELETE explícito.
-- 3. Timestamps em UTC.
-- 4. Cada tabela documenta a qual desafio pertence.
-- =====================================================================

-- ============== Extensões ==============
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============== Enums =================
create type user_role as enum ('analista', 'gestor', 'admin');
create type cliente_perfil as enum ('fiel', 'abandono', 'esquecido', 'economico');
create type cliente_regiao as enum ('sul', 'sudeste', 'centro_oeste', 'nordeste', 'norte');
create type cliente_financiamento as enum ('a_vista', 'financiado', 'leasing', 'consorcio');
create type cliente_canal as enum ('concessionaria', 'online', 'frota', 'indicacao');
create type cliente_genero as enum ('M', 'F', 'outro');
create type cliente_estado_civil as enum ('solteiro', 'casado', 'divorciado', 'viuvo');

-- ============== profiles ==============
-- 1:1 com auth.users. Carrega papel (RBAC) e dealership do usuário.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'analista',
  dealership_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_dealership_idx on public.profiles(dealership_id);
create index profiles_role_idx on public.profiles(role);

-- ============== dealerships ==============
-- Rede de concessionárias Ford.
create table public.dealerships (
  id uuid primary key default uuid_generate_v4(),
  codigo text not null unique,
  nome text not null,
  regiao cliente_regiao not null,
  cidade text not null,
  uf text not null check (length(uf) = 2),
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create index dealerships_regiao_idx on public.dealerships(regiao);

-- FK depois que ambas existem
alter table public.profiles
  add constraint profiles_dealership_fk
  foreign key (dealership_id) references public.dealerships(id) on delete set null;

-- ============== clients (Desafio 2) ==============
-- Cada compra de veículo gera um cliente. Features de Base 2 (pré-compra) aqui.
-- Pós-compra fica em client_history.
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  dealership_id uuid not null references public.dealerships(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,

  -- ===== Base 2: dados disponíveis no momento da compra =====
  idade smallint not null check (idade between 18 and 95),
  genero cliente_genero not null,
  regiao cliente_regiao not null,
  renda_mensal_brl integer not null check (renda_mensal_brl >= 0),
  estado_civil cliente_estado_civil not null,
  score_credito smallint not null check (score_credito between 0 and 1000),

  modelo_comprado text not null,
  versao_comprada text not null,
  preco_pago_brl integer not null check (preco_pago_brl >= 0),
  financiamento cliente_financiamento not null,
  parcelas smallint not null check (parcelas between 0 and 84),
  canal_aquisicao cliente_canal not null,
  primeiro_carro boolean not null default false,
  test_drive_realizado boolean not null default false,

  -- Anonimização: dados pessoais ficam separados, hash do CPF como pseudonimo
  cpf_hash text,
  nome_cliente text,

  data_compra date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_dealership_idx on public.clients(dealership_id);
create index clients_modelo_idx on public.clients(modelo_comprado);
create index clients_data_compra_idx on public.clients(data_compra);

-- ============== client_history (Base 1) ==============
-- Comportamento pós-compra. NUNCA usado em classificação.
create table public.client_history (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,

  num_revisoes_realizadas smallint not null default 0 check (num_revisoes_realizadas >= 0),
  num_revisoes_esperadas smallint not null default 0 check (num_revisoes_esperadas >= 0),
  gasto_total_servicos_brl integer not null default 0 check (gasto_total_servicos_brl >= 0),
  dias_desde_ultima_visita integer not null default 0 check (dias_desde_ultima_visita >= 0),
  seguiu_recomendacoes_pct numeric(4,3) not null default 0 check (seguiu_recomendacoes_pct between 0 and 1),
  reclamacoes_abertas smallint not null default 0,
  garantia_ativa boolean not null default true,
  nps_ultima_visita smallint check (nps_ultima_visita between 0 and 10),

  observado_em timestamptz not null default now()
);

create index client_history_client_idx on public.client_history(client_id);

-- ============== predictions ==============
-- Saída do classificador ML para cada cliente.
create table public.predictions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  model_version text not null,

  perfil_predito cliente_perfil not null,
  prob_fiel numeric(4,3) not null check (prob_fiel between 0 and 1),
  prob_abandono numeric(4,3) not null check (prob_abandono between 0 and 1),
  prob_esquecido numeric(4,3) not null check (prob_esquecido between 0 and 1),
  prob_economico numeric(4,3) not null check (prob_economico between 0 and 1),
  risco_evasao numeric(4,3) not null check (risco_evasao between 0 and 1),
  confianca numeric(4,3) not null check (confianca between 0 and 1),

  recomendacoes_acao text[] not null default '{}',

  created_at timestamptz not null default now()
);

create index predictions_client_idx on public.predictions(client_id);
create index predictions_perfil_idx on public.predictions(perfil_predito);
create index predictions_risco_idx on public.predictions(risco_evasao desc);

-- ============== vehicles (Desafio 1) ==============
-- Catálogo de veículos da concorrência. Cache de scraping/LLM.
create table public.vehicles (
  id uuid primary key default uuid_generate_v4(),
  schema_version text not null default '1.0.0',

  marca text not null,
  modelo text not null,
  versao text not null,
  ano smallint not null,
  categoria text not null,

  -- Specs canônicos em JSONB para flexibilidade.
  motor jsonb not null default '{}'::jsonb,
  dimensoes jsonb not null default '{}'::jsonb,
  transmissao jsonb not null default '{}'::jsonb,
  desempenho jsonb not null default '{}'::jsonb,
  equipamentos text[] not null default '{}',

  preco_brl integer,
  pais_origem text,

  fontes text[] not null default '{}',
  hash_dedupe text generated always as (
    lower(marca) || '|' || lower(modelo) || '|' || lower(versao) || '|' || ano::text
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index vehicles_dedupe_uidx on public.vehicles(hash_dedupe);
create index vehicles_marca_modelo_idx on public.vehicles(lower(marca), lower(modelo));
create index vehicles_categoria_idx on public.vehicles(categoria);

-- ============== ai_insights ==============
-- Cache de respostas Claude (XAI por cliente, portfolio por analista).
create table public.ai_insights (
  id uuid primary key default uuid_generate_v4(),
  scope text not null check (scope in ('client', 'portfolio', 'vehicle_summary')),
  resource_id text not null,
  payload_hash text not null,
  model_used text not null,
  output text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index ai_insights_hash_uidx on public.ai_insights(scope, resource_id, payload_hash);
create index ai_insights_expires_idx on public.ai_insights(expires_at) where expires_at is not null;

-- ============== audit_log ==============
-- Eventos críticos: criação de cliente, predições, exports, mudanças de role.
create table public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index audit_log_actor_idx on public.audit_log(actor_id);
create index audit_log_action_idx on public.audit_log(action);
create index audit_log_occurred_at_idx on public.audit_log(occurred_at desc);

-- ============== updated_at triggers ==============
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function set_updated_at();
create trigger clients_updated_at before update on public.clients
  for each row execute function set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function set_updated_at();

-- ============== Auto-criação de profile ==============
-- Quando um auth.users é criado, automaticamente cria um profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
