-- ============================================================
-- Adapta clients pra suportar dados REAIS da Ford BR
-- ============================================================
-- O dataset vin_share_Desafio_02.xlsx tem campos diferentes do schema sintético
-- original. Em vez de quebrar, ADICIONAMOS colunas Ford-native e tornamos os
-- campos sintéticos opcionais (nullable). Compatibilidade preservada.
-- ============================================================

-- Identificação do veículo (Ford)
alter table public.clients
  add column if not exists vin_hash text,
  add column if not exists model_name text,
  add column if not exists model_year smallint,
  add column if not exists dealer_code_venda integer,
  add column if not exists dealer_codes_revisao integer[],
  -- Datas Ford
  add column if not exists sales_date date,
  add column if not exists invoice_date date,
  add column if not exists delivery_date date,
  add column if not exists registration_date date,
  add column if not exists warranty_start_date date,
  -- Métricas comportamentais (preenchidas pelo ETL)
  add column if not exists km_max integer,
  add column if not exists num_revisoes smallint,
  add column if not exists num_servicos_total integer,
  add column if not exists dias_ate_1a_revisao smallint,
  add column if not exists dias_desde_ultima_revisao smallint,
  add column if not exists dealer_loyalty numeric(4,3) check (dealer_loyalty between 0 and 1),
  add column if not exists taxa_aderencia_km numeric(5,2),
  add column if not exists revisoes_por_ano numeric(5,2),
  add column if not exists primeiro_servico date,
  add column if not exists ultimo_servico date,
  -- Label real derivado pelo ETL (Base 1)
  add column if not exists perfil_real text check (perfil_real in ('fiel', 'abandono', 'esquecido', 'economico')),
  -- Origem
  add column if not exists is_ford_real boolean not null default false,
  add column if not exists data_source text;

-- Torna campos sintéticos opcionais (vinham do banco gerado)
alter table public.clients
  alter column idade drop not null,
  alter column genero drop not null,
  alter column regiao drop not null,
  alter column renda_mensal_brl drop not null,
  alter column estado_civil drop not null,
  alter column score_credito drop not null,
  alter column modelo_comprado drop not null,
  alter column versao_comprada drop not null,
  alter column preco_pago_brl drop not null,
  alter column financiamento drop not null,
  alter column parcelas drop not null,
  alter column canal_aquisicao drop not null;

-- Unique do VIN_Hash (impede duplicação do mesmo veículo)
create unique index if not exists clients_vin_hash_unique on public.clients(vin_hash)
  where vin_hash is not null;

-- Índices úteis pra busca/filtros
create index if not exists clients_model_name_idx on public.clients(model_name);
create index if not exists clients_dealer_code_idx on public.clients(dealer_code_venda);
create index if not exists clients_perfil_real_idx on public.clients(perfil_real);
create index if not exists clients_is_ford_real_idx on public.clients(is_ford_real);
create index if not exists clients_sales_date_idx on public.clients(sales_date);

-- Comentários para documentação
comment on column public.clients.vin_hash is 'Hash do VIN (anonimizado) - identificador único do veículo conforme dataset Ford';
comment on column public.clients.model_name is 'Nome do modelo Ford (RANGER, KA, ECOSPORT, TERRITORY, BRONCO SPORT, MAVERICK, TRANSIT, F-150, MUSTANG, EDGE, MUSTANG MACH-E, etc.)';
comment on column public.clients.dealer_code_venda is 'Código da concessionária (DealerCode) onde foi feita a venda - identificador Ford, não UUID nosso';
comment on column public.clients.perfil_real is 'Label derivado pelo ETL com base no comportamento observado (Base 1)';
comment on column public.clients.is_ford_real is 'True se importado do dataset oficial Ford BR; false se cadastrado manualmente no sistema';
comment on column public.clients.dealer_loyalty is 'Fração das revisões feitas no mesmo dealer (0-1, calculado pelo ETL)';
