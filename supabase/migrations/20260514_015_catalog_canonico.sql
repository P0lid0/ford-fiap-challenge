-- =====================================================================
-- Ford D1 — Schema canônico de comparação de veículos (262 itens)
-- =====================================================================
-- A Ford forneceu uma planilha "Vehicle Data" com 262 atributos
-- distribuídos em 14 seções (Wheels, Connectivity, Ice Line Up,
-- Air conditioning, Safety, High tech, Global Closing, Trim, SunRoof,
-- Seats, Lights, 4X4, Others, + grupo sem seção com motorização).
-- Esta migration cria:
--
--   catalog_items           — schema fixo: 262 linhas, uma por atributo
--   vehicle_catalog_values  — bridge (vehicle × item) com o valor preenchido
--
-- Cada veículo da concorrência precisa preencher os 262 valores pra
-- permitir comparação 1:1 (X / 0 / numérico / texto curto), exatamente
-- como o template pede.
-- =====================================================================

-- ============== Enum do tipo de campo ==============
do $$ begin
  create type catalog_item_type as enum (
    'flag',     -- X (tem) / 0 (não tem)
    'numeric',  -- número (cilindrada, polegadas, torque...)
    'text',     -- texto curto (cor, material...)
    'choice'    -- valor discreto pré-definido
  );
exception when duplicate_object then null; end $$;

-- ============== catalog_items ==============
-- Schema canônico. Read-mostly: populado uma vez via script,
-- raramente alterado.
create table if not exists public.catalog_items (
  id uuid primary key default uuid_generate_v4(),
  secao text not null,            -- "Wheels", "Connectivity", "Safety"...
  ordem smallint not null,        -- ordem dentro da seção (1, 2, 3...)
  ordem_global smallint not null, -- ordem global no schema (1..262)
  nome text not null,             -- "Liga leve", "Pneus ATR (50/50)"...
  tipo catalog_item_type not null default 'flag',
  unidade text,                   -- "kg", "cv", "Nm", "polegadas"...
  descricao text,                 -- contexto/ajuda opcional
  created_at timestamptz not null default now()
);

create unique index if not exists catalog_items_nome_uidx
  on public.catalog_items(secao, nome);
create unique index if not exists catalog_items_ordem_uidx
  on public.catalog_items(ordem_global);
create index if not exists catalog_items_secao_idx
  on public.catalog_items(secao, ordem);

-- ============== vehicle_catalog_values ==============
-- Valor preenchido pra cada (veículo, atributo).
-- O valor é text pra acomodar "X", "0", "250", "9.55" etc.
-- A interpretação fica a cargo do front + do tipo declarado em catalog_items.
create table if not exists public.vehicle_catalog_values (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  item_id uuid not null references public.catalog_items(id) on delete cascade,
  valor text,                     -- "X" | "0" | "250" | "Couro" | null
  confianca text not null default 'media'
    check (confianca in ('alta', 'media', 'baixa')),
  fonte text,                     -- "Ford D1 26MY" | "411 Vehicle Data" | "manual"
  updated_at timestamptz not null default now(),
  primary key (vehicle_id, item_id)
);

create index if not exists vehicle_catalog_values_vehicle_idx
  on public.vehicle_catalog_values(vehicle_id);
create index if not exists vehicle_catalog_values_item_idx
  on public.vehicle_catalog_values(item_id);

-- ============== RLS ==============
alter table public.catalog_items enable row level security;
alter table public.vehicle_catalog_values enable row level security;

-- Leitura livre pra usuários autenticados (catálogo público).
drop policy if exists catalog_items_read on public.catalog_items;
create policy catalog_items_read on public.catalog_items
  for select to authenticated using (true);

drop policy if exists vehicle_catalog_values_read on public.vehicle_catalog_values;
create policy vehicle_catalog_values_read on public.vehicle_catalog_values
  for select to authenticated using (true);

-- Escrita: só via service_role (scripts ETL e API server-side).
-- Sem policies de INSERT/UPDATE/DELETE pra authenticated → bloqueado por padrão.

-- ============== Comentários ==============
comment on table public.catalog_items is
  'Schema canônico Ford D1: 262 atributos em 14 seções pra comparação fixa de veículos.';
comment on table public.vehicle_catalog_values is
  'Bridge veículo × atributo: valor preenchido (X/0/numérico/texto) por veículo.';
comment on column public.catalog_items.tipo is
  'flag = X/0; numeric = número puro; text = string curta; choice = discreto.';
