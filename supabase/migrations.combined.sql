-- Source migration: 20260514_001_init.sql
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

-- Source migration: 20260514_002_rls_policies.sql
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

-- Role and dealership assignment are provisioned by an administrator only.
revoke update on table public.profiles from anon, authenticated, public;

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
  for select using (public.is_admin());

-- ============== audit_log ==============
create policy audit_log_admin_read on public.audit_log
  for select using (public.is_admin());

-- audit_log é escrito só pelo service_role.

-- Source migration: 20260514_003_seed_dealerships.sql
-- Seed mínimo de concessionárias para os testes funcionarem.
insert into public.dealerships (codigo, nome, regiao, cidade, uf) values
  ('FD001', 'Ford Premier Paulista',     'sudeste',      'São Paulo',       'SP'),
  ('FD002', 'Ford Vias do Sul',           'sul',          'Porto Alegre',    'RS'),
  ('FD003', 'Ford BH Center',             'sudeste',      'Belo Horizonte',  'MG'),
  ('FD004', 'Ford Capital Recife',        'nordeste',     'Recife',          'PE'),
  ('FD005', 'Ford Manaus Norte',          'norte',        'Manaus',          'AM'),
  ('FD006', 'Ford Brasília Asa Sul',      'centro_oeste', 'Brasília',        'DF'),
  ('FD007', 'Ford Curitiba ABC',          'sul',          'Curitiba',        'PR'),
  ('FD008', 'Ford Salvador Pituba',       'nordeste',     'Salvador',        'BA'),
  ('FD009', 'Ford Goiânia Marista',       'centro_oeste', 'Goiânia',         'GO'),
  ('FD010', 'Ford Rio Barra',             'sudeste',      'Rio de Janeiro',  'RJ')
on conflict (codigo) do nothing;

-- Source migration: 20260514_004_vehicles_provenance.sql
-- Provenance dos dados de veículos — Desafio 1 com fontes verificáveis.
alter table public.vehicles
  add column if not exists data_sources jsonb not null default '{}'::jsonb,
  add column if not exists fipe_codigo text,
  add column if not exists fipe_mes_referencia text,
  add column if not exists confianca_geral text not null default 'baixa'
    check (confianca_geral in ('alta', 'media', 'baixa'));

create index if not exists vehicles_fipe_idx on public.vehicles(fipe_codigo) where fipe_codigo is not null;

-- Source migration: 20260514_005_vehicle_editing.sql
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

-- Source migration: 20260514_006_ai_config.sql
-- Tabelas de configuração de IA: chaves de API e modelo por função.
-- Strictly admin: RLS bloqueia tudo exceto admins, e routes usam service_role.

-- ============== api_keys ==============
create table public.ai_keys (
  provider text primary key check (provider in ('openai', 'anthropic', 'gemini')),
  api_key text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.ai_keys enable row level security;

-- Apenas admin LÊ; mas o backend usa service_role (bypassa RLS).
create policy ai_keys_admin_read on public.ai_keys
  for select using (public.is_admin());

-- ============== ai_function_models ==============
-- Configurações de qual modelo usa em cada função.
-- Persistido por user (cada admin pode ter sua preferência).
create table public.ai_function_models (
  user_id uuid not null references public.profiles(id) on delete cascade,
  function_name text not null check (function_name in (
    'vehicle_search',     -- Extração + gap fill em /search e /search/fipe
    'compare_analysis',   -- Análise comparativa em /competitive/compare/analyze
    'client_insight',     -- XAI por cliente em /insights/client/:id
    'portfolio_insight',  -- Briefing de portfolio em /insights/portfolio
    'manufacturer_extract' -- Extração de specs do HTML do site oficial
  )),
  -- Formato: "provider:model" ex: "openai:gpt-4o-mini", "anthropic:claude-haiku-4-5-20251001", "gemini:gemini-2.0-flash"
  model_id text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, function_name)
);

alter table public.ai_function_models enable row level security;

create policy ai_function_models_self on public.ai_function_models
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy ai_function_models_admin on public.ai_function_models
  for all using (public.is_admin()) with check (public.is_admin());

-- Source migration: 20260514_007_fipe_secret.sql
-- Renomeia ai_keys → secret_keys e permite 'fipe' como provedor (mesma mecânica de gerenciamento).
alter table public.ai_keys drop constraint if exists ai_keys_provider_check;
alter table public.ai_keys add constraint ai_keys_provider_check
  check (provider in ('openai', 'anthropic', 'gemini', 'fipe'));

-- Source migration: 20260514_008_vehicle411_secret.sql
-- Permite 'vehicle411' (autoapi411.com) como provedor na tabela secret_keys (ai_keys).
-- Usado pra specs detalhadas de motor/transmissão/reboque, cobertura US-centric.
alter table public.ai_keys drop constraint if exists ai_keys_provider_check;
alter table public.ai_keys add constraint ai_keys_provider_check
  check (provider in ('openai', 'anthropic', 'gemini', 'fipe', 'vehicle411'));

-- Source migration: 20260514_009_acoes_retencao.sql
-- ============================================================
-- Sistema de Ações de Retenção (Desafio 2)
-- ============================================================
-- Cada ação tomada com um cliente (ligação, WhatsApp, oferta, visita)
-- é registrada aqui. Permite:
--   1) Histórico/timeline na ficha do cliente
--   2) Calibração futura do modelo (ação X → desfecho Y)
--   3) Painel de produtividade do vendedor
--   4) Campanhas em lote por perfil
-- ============================================================

create type acao_tipo as enum (
  'ligacao',
  'whatsapp',
  'email',
  'sms',
  'visita_presencial',
  'oferta_enviada',
  'agendamento_revisao',
  'outro'
);

create type acao_status as enum (
  'planejada',
  'em_andamento',
  'concluida_sucesso',  -- cliente respondeu positivamente / agendou / voltou
  'concluida_recusa',   -- cliente respondeu negativamente
  'sem_resposta',       -- não conseguiu contato
  'cancelada'
);

create table if not exists public.acoes_retencao (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  actor_id      uuid references auth.users(id) on delete set null,

  tipo          acao_tipo not null,
  status        acao_status not null default 'planejada',

  -- Texto livre + estruturado
  titulo        text not null,
  descricao     text,
  -- desfecho: preencher quando status vira concluida_*
  desfecho      text,

  -- contexto da predição que originou a ação (opcional)
  perfil_alvo   text check (perfil_alvo in ('fiel', 'abandono', 'esquecido', 'economico')),
  risco_no_disparo numeric(4,3) check (risco_no_disparo between 0 and 1),

  -- ação de campanha (em lote) tem campaign_id; ações individuais não
  campaign_id   uuid,

  created_at    timestamptz not null default now(),
  scheduled_for timestamptz,     -- quando deve ser executada (null = imediata)
  completed_at  timestamptz      -- quando virou concluida_*
);

create index if not exists idx_acoes_client on public.acoes_retencao(client_id);
create index if not exists idx_acoes_dealership on public.acoes_retencao(dealership_id);
create index if not exists idx_acoes_status on public.acoes_retencao(status);
create index if not exists idx_acoes_created on public.acoes_retencao(created_at desc);
create index if not exists idx_acoes_campaign on public.acoes_retencao(campaign_id) where campaign_id is not null;

-- ============================================================
-- RLS
-- ============================================================
alter table public.acoes_retencao enable row level security;

-- analistas/gestores veem ações da própria concessionária
create policy "acoes_read_own_dealership" on public.acoes_retencao
  for select using (
    dealership_id = (select dealership_id from public.profiles where id = auth.uid())
    or is_admin()
  );

-- mesma regra para insert
create policy "acoes_insert_own_dealership" on public.acoes_retencao
  for insert with check (
    dealership_id = (select dealership_id from public.profiles where id = auth.uid())
    or is_admin()
  );

-- update só do próprio autor, ou admin/gestor
create policy "acoes_update_owner_or_manager" on public.acoes_retencao
  for update using (
    actor_id = auth.uid()
    or current_user_role() in ('gestor', 'admin')
  );

-- ============================================================
-- View consolidada: ações por cliente com contagens por status
-- ============================================================
create or replace view public.v_acoes_por_cliente as
select
  client_id,
  count(*) as total,
  count(*) filter (where status = 'planejada') as planejadas,
  count(*) filter (where status = 'em_andamento') as em_andamento,
  count(*) filter (where status = 'concluida_sucesso') as sucesso,
  count(*) filter (where status = 'concluida_recusa') as recusa,
  count(*) filter (where status = 'sem_resposta') as sem_resposta,
  max(created_at) as ultima_acao
from public.acoes_retencao
group by client_id;

-- Source migration: 20260514_010_hybrid_classifier.sql
-- ============================================================
-- Classificação Híbrida ML + IA (Desafio 2)
-- ============================================================
-- Estende predictions pra suportar:
--   - source: distingue ML puro, IA puro, ou ensemble híbrido
--   - raciocinio: texto da IA explicando POR QUE chegou nessa classificação
--   - signals_detected: sinais textuais que pesaram (vindos das notas/ações)
--   - ml_perfil / ai_perfil: predições individuais quando híbrido (auditoria)
--   - concordancia: ML e IA concordaram no perfil?
--
-- Também adiciona `notas` ao client (já existia em vehicles) — texto livre
-- onde o vendedor anota informações qualitativas que a IA pode usar.
-- ============================================================

alter table public.clients
  add column if not exists notas text;

create type prediction_source as enum (
  'ml_only',     -- só XGBoost (baseline rápido, automático no insert)
  'ai_only',     -- só LLM (raro — quando ML não está disponível)
  'hybrid'       -- ensemble ML + IA (acionado manualmente ou em zona cinza)
);

-- Adiciona colunas em predictions (preservando dados existentes)
alter table public.predictions
  add column if not exists source prediction_source not null default 'ml_only',
  add column if not exists raciocinio text,
  add column if not exists signals_detected text[] not null default '{}',
  add column if not exists ml_perfil cliente_perfil,        -- preenche quando hybrid
  add column if not exists ai_perfil cliente_perfil,        -- preenche quando hybrid
  add column if not exists concordancia boolean,             -- true se ml_perfil == ai_perfil
  add column if not exists ai_model text;                    -- ex: 'openai:gpt-4o-mini'

create index if not exists predictions_source_idx on public.predictions(source);
create index if not exists predictions_concordancia_idx on public.predictions(concordancia)
  where source = 'hybrid';

-- Atualiza view consolidada se existir (não há por enquanto, mas deixa preparado)
comment on column public.predictions.source is
  'Origem da predição: ml_only (XGBoost), ai_only (LLM), ou hybrid (ensemble)';
comment on column public.predictions.raciocinio is
  'Explicação em PT-BR da IA sobre por que esse cliente recebeu esse perfil';
comment on column public.predictions.signals_detected is
  'Sinais qualitativos que a IA detectou nas notas/ações (ex: ["reclamacao_atendimento","interesse_upgrade"])';
comment on column public.predictions.concordancia is
  'true quando ML e IA concordaram no perfil. false → caso ambíguo, revisar.';

-- Source migration: 20260514_011_ford_real_schema.sql
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

-- Source migration: 20260514_012_vin_hash_unique.sql
-- ============================================================
-- Substitui o índice parcial em vin_hash por unique completo,
-- pra permitir uso em ON CONFLICT via PostgREST upsert.
--
-- Postgres por padrão permite múltiplos NULLs em UNIQUE (NULLS DISTINCT),
-- então isso não bloqueia clientes sintéticos sem vin_hash.
-- ============================================================
drop index if exists public.clients_vin_hash_unique;
create unique index clients_vin_hash_unique on public.clients(vin_hash);

-- Source migration: 20260514_013_msg_campanhas.sql
-- ============================================================
-- Campanhas de mensagem (WhatsApp Evolution API + Cloud API)
-- ============================================================
-- Permite criar campanhas com template de mensagem usando variáveis ({{1}}, {{2}}),
-- importar destinatários individualmente ou via planilha, e disparar em lote
-- com rate limit ajustável.
--
-- Casos de uso:
--   - Lembrete de revisão pros "esquecidos" Ford BR
--   - Oferta agressiva pros "abandono" da rede
--   - Convite ao programa de fidelidade pros "fiéis"
-- ============================================================

create type msg_provedor as enum ('evolution', 'cloud_api');
create type msg_campanha_status as enum ('rascunho', 'agendada', 'enviando', 'concluida', 'cancelada');
create type msg_destinatario_status as enum ('pendente', 'enviado', 'falhou', 'cancelado');

create table public.msg_campanhas (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  nome text not null,
  provedor msg_provedor not null default 'evolution',
  mensagem text not null,
  rate_limit_per_min smallint not null default 5 check (rate_limit_per_min between 1 and 60),
  status msg_campanha_status not null default 'rascunho',

  -- Destinatários em JSONB pra flexibilidade.
  -- Cada item: { telefone, nome, vars: { "1": "valor", "2": "outro" }, status, client_id?, error? }
  destinatarios jsonb not null default '[]'::jsonb,
  total_destinatarios integer generated always as (jsonb_array_length(destinatarios)) stored,

  -- Vínculo opcional com perfil/segmento Ford (pra disparo automatizado por critério)
  segmento_perfil text check (segmento_perfil in ('fiel', 'abandono', 'esquecido', 'economico')),
  segmento_modelo text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create index msg_campanhas_dealership_idx on public.msg_campanhas(dealership_id);
create index msg_campanhas_status_idx on public.msg_campanhas(status);
create index msg_campanhas_created_idx on public.msg_campanhas(created_at desc);

alter table public.msg_campanhas enable row level security;

create policy "campanhas_read_own_dealership" on public.msg_campanhas
  for select using (
    dealership_id = (select dealership_id from public.profiles where id = auth.uid())
    or is_admin()
  );
create policy "campanhas_write_managers" on public.msg_campanhas
  for all using (
    dealership_id = (select dealership_id from public.profiles where id = auth.uid())
    or is_admin()
  ) with check (
    dealership_id = (select dealership_id from public.profiles where id = auth.uid())
    or is_admin()
  );

-- Trigger pra updated_at automático
create or replace function public.tg_msg_campanhas_updated_at()
returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;
create trigger msg_campanhas_set_updated_at before update on public.msg_campanhas
  for each row execute function public.tg_msg_campanhas_updated_at();

comment on column public.msg_campanhas.mensagem is
  'Template com variáveis {{1}}, {{2}}, etc. Substituídas pelos vars.* de cada destinatário no envio.';
comment on column public.msg_campanhas.destinatarios is
  'JSONB array. Schema item: { telefone (E.164), nome, vars: {"1": "..."}, status, client_id?, error? }';

-- Source migration: 20260514_014_drop_msg_campanhas.sql
-- Reverte 013: feature de campanhas WhatsApp foi descartada.
drop table if exists public.msg_campanhas cascade;
drop type if exists msg_destinatario_status;
drop type if exists msg_campanha_status;
drop type if exists msg_provedor;

-- Source migration: 20260514_015_catalog_canonico.sql
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

-- Source migration: 20260514_016_dealer_anomalia_fn.sql
-- =====================================================================
-- RPC: agregação de perfil_real por dealer
-- =====================================================================
-- Postgrest tem limite default de 1000 linhas, então uma agregação manual
-- via SELECT direto não funciona com 175k VINs. Esta função roda a agregação
-- INTEIRA dentro do Postgres e devolve só o sumário por dealer (412 linhas).
-- =====================================================================

create or replace function public.dealer_perfil_stats(min_clientes integer default 50)
returns table (
  dealer_code integer,
  total_clientes bigint,
  fiel bigint,
  abandono bigint,
  esquecido bigint,
  economico bigint,
  pct_fiel numeric,
  pct_abandono numeric,
  pct_esquecido numeric,
  pct_economico numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    dealer_code_venda as dealer_code,
    count(*)::bigint as total_clientes,
    sum(case when perfil_real = 'fiel'      then 1 else 0 end)::bigint as fiel,
    sum(case when perfil_real = 'abandono'  then 1 else 0 end)::bigint as abandono,
    sum(case when perfil_real = 'esquecido' then 1 else 0 end)::bigint as esquecido,
    sum(case when perfil_real = 'economico' then 1 else 0 end)::bigint as economico,
    (sum(case when perfil_real = 'fiel'      then 1.0 else 0 end) / count(*))::numeric as pct_fiel,
    (sum(case when perfil_real = 'abandono'  then 1.0 else 0 end) / count(*))::numeric as pct_abandono,
    (sum(case when perfil_real = 'esquecido' then 1.0 else 0 end) / count(*))::numeric as pct_esquecido,
    (sum(case when perfil_real = 'economico' then 1.0 else 0 end) / count(*))::numeric as pct_economico
  from public.clients
  where dealer_code_venda is not null
    and perfil_real is not null
  group by dealer_code_venda
  having count(*) >= min_clientes
  order by count(*) desc;
$$;

comment on function public.dealer_perfil_stats(integer) is
  'Agregação de perfil_real por dealer — usado em /metrics/anomalias-dealer pra calcular z-score de retenção.';

-- Permissões: authenticated pode chamar (read-only function)
revoke all on function public.dealer_perfil_stats(integer) from public, anon;
grant execute on function public.dealer_perfil_stats(integer) to authenticated;
grant execute on function public.dealer_perfil_stats(integer) to service_role;

-- Source migration: 20260514_017_email_integration.sql
-- =====================================================================
-- Integração de e-mail real para ações de retenção (Desafio 2)
-- =====================================================================
-- O slide D2 pede "lembretes de serviço e ofertas" como otimização da
-- jornada. Antes, /acoes era só registro manual. Agora ações tipo 'email'
-- podem ser ENVIADAS DE VERDADE via provider configurado.
--
-- Adicionamos:
--   - clients.email_cliente, clients.telefone_cliente — contato do cliente
--   - email_logs — auditoria de cada envio (LGPD: rastrear quem mandou pra quem)
--   - configuração SMTP/Resend fica em ai_keys (reaproveita a tabela)
-- =====================================================================

-- ============== Contato no cliente ==============
alter table public.clients
  add column if not exists email_cliente text,
  add column if not exists telefone_cliente text;

create index if not exists clients_email_cliente_idx
  on public.clients(lower(email_cliente)) where email_cliente is not null;

comment on column public.clients.email_cliente is
  'E-mail de contato do cliente. Preenchido no cadastro/edição. Usado pra envio automático de lembretes e ofertas (ações tipo email).';

-- ============== Audit log de e-mails enviados ==============
create table if not exists public.email_logs (
  id uuid primary key default uuid_generate_v4(),
  acao_id uuid references public.acoes_retencao(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  sent_by uuid references public.profiles(id) on delete set null,
  -- Destinatário e remetente
  to_email text not null,
  from_email text not null,
  subject text not null,
  body_preview text,             -- primeiros 200 chars (LGPD: não logar corpo completo se contiver dados sensíveis)
  -- Provider / status
  provider text not null,        -- 'resend' | 'smtp' | 'mock'
  provider_message_id text,      -- ID retornado pelo provider (pra tracking)
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'bounced', 'failed')),
  error_message text,
  -- Timestamps
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz
);

create index if not exists email_logs_client_idx on public.email_logs(client_id);
create index if not exists email_logs_acao_idx on public.email_logs(acao_id);
create index if not exists email_logs_status_idx on public.email_logs(status);
create index if not exists email_logs_created_idx on public.email_logs(created_at desc);

comment on table public.email_logs is
  'Auditoria LGPD de e-mails enviados pelo sistema. Cada envio gera 1 linha com remetente, destinatário, status e ID do provider.';

-- ============== RLS ==============
alter table public.email_logs enable row level security;

-- Leitura: usuário vê os e-mails que ele mesmo mandou. Admin/gestor vê tudo.
drop policy if exists email_logs_read on public.email_logs;
create policy email_logs_read on public.email_logs
  for select to authenticated using (
    sent_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'gestor')
    )
  );

-- Inserção só via service_role (API faz auditoria ao enviar)
-- → sem policy de INSERT pra authenticated, bloqueado por padrão

-- ============== Comentários nas configurações ==============
-- Não precisa de tabela nova — reusamos public.ai_keys com providers:
--   'resend'      → API key da Resend
--   'smtp'        → JSON com {host, port, user, password, from} (futuro)
--   'email_from'  → e-mail remetente (opcional, default = e-mail do user logado)

-- Source migration: 20260514_018_leads_ranking_fn.sql
-- =====================================================================
-- RPC: ranqueamento de leads de retenção
-- =====================================================================
-- Antes, /clients/leads só olhava a tabela `predictions` (que tem ~4 linhas
-- de reclassificações manuais). Os 175k clientes Ford-real com `perfil_real`
-- preenchido pelo ETL nunca apareciam.
--
-- Esta função combina TODOS os sinais disponíveis e calcula um risco
-- composto, retornando até N leads ordenados:
--
--   risco_base por perfil_real (do ETL):
--     abandono   → 0.85
--     esquecido  → 0.65
--     economico  → 0.35
--     fiel       → 0.15
--
--   bonificações somadas ao risco_base (cap em 0.99):
--     revisão atrasada (>365d sem serviço)  → +0.10
--     garantia já vencida                    → +0.05
--     dealer_loyalty baixa (<0.4)            → +0.05
--     veículo veterano (5+ anos)             → +0.03
--     primeiro carro (proxy de aderência)    → +0.02
--
--   Também devolve os "sinais" (array de razões) pra UI explicar
--   por que cada cliente está naquela posição.
-- =====================================================================

create or replace function public.leads_ranqueados(
  risco_min numeric default 0.4,
  filtro_perfil text default null,
  filtro_modelo text default null,
  filtro_dealer integer default null,
  filtro_sinal text default null,   -- 'revisao_atrasada' | 'garantia_vencida' | 'dealer_loyalty_baixa' | null
  limite integer default 50
)
returns table (
  id uuid,
  nome_cliente text,
  vin_hash text,
  model_name text,
  model_year smallint,
  dealer_code_venda integer,
  perfil_real text,
  dias_desde_ultima_revisao smallint,
  warranty_start_date date,
  dealer_loyalty numeric,
  num_revisoes smallint,
  risco_composto numeric,
  sinais text[]
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with base as (
    select
      c.id,
      c.nome_cliente,
      c.vin_hash,
      c.model_name,
      c.model_year,
      c.dealer_code_venda,
      c.perfil_real,
      c.dias_desde_ultima_revisao,
      c.warranty_start_date,
      c.dealer_loyalty,
      c.num_revisoes,
      -- risco base pelo perfil_real
      case c.perfil_real
        when 'abandono'  then 0.85
        when 'esquecido' then 0.65
        when 'economico' then 0.35
        when 'fiel'      then 0.15
        else                  0.20
      end as risco_base,
      -- sinais (computados, retornados como array)
      array_remove(array[
        case when c.dias_desde_ultima_revisao > 365 then 'revisao_atrasada' end,
        case when c.warranty_start_date is not null
             and c.warranty_start_date + interval '3 years' < now() then 'garantia_vencida' end,
        case when c.warranty_start_date is not null
             and c.warranty_start_date + interval '3 years' >= now()
             and c.warranty_start_date + interval '3 years' < now() + interval '90 days'
             then 'garantia_vencendo' end,
        case when c.dealer_loyalty < 0.4 and c.num_revisoes > 0 then 'dealer_loyalty_baixa' end,
        case when c.model_year is not null and (extract(year from now()) - c.model_year) >= 5
             then 'veiculo_veterano' end,
        case when c.num_revisoes = 0 and c.delivery_date is not null
             and c.delivery_date < now() - interval '15 months' then 'sem_revisao_alguma' end
      ], null) as sinais
    from public.clients c
    where c.perfil_real is not null
      and (filtro_perfil is null or c.perfil_real = filtro_perfil)
      and (filtro_modelo is null or c.model_name = filtro_modelo)
      and (filtro_dealer is null or c.dealer_code_venda = filtro_dealer)
  ),
  com_risco as (
    select
      b.*,
      least(0.99,
        b.risco_base
        + case when 'revisao_atrasada'     = any(b.sinais) then 0.10 else 0 end
        + case when 'garantia_vencida'     = any(b.sinais) then 0.05 else 0 end
        + case when 'dealer_loyalty_baixa' = any(b.sinais) then 0.05 else 0 end
        + case when 'veiculo_veterano'     = any(b.sinais) then 0.03 else 0 end
        + case when 'sem_revisao_alguma'   = any(b.sinais) then 0.07 else 0 end
      ) as risco_composto
    from base b
  )
  select
    id, nome_cliente, vin_hash, model_name, model_year, dealer_code_venda,
    perfil_real, dias_desde_ultima_revisao, warranty_start_date,
    dealer_loyalty, num_revisoes,
    risco_composto, sinais
  from com_risco
  where risco_composto >= risco_min
    and (filtro_sinal is null or filtro_sinal = any(sinais))
  order by risco_composto desc, num_revisoes asc
  limit least(greatest(coalesce(limite, 50), 1), 500);
$$;

comment on function public.leads_ranqueados is
  'Lead ranking com risco composto = perfil_real + sinais (revisão atrasada, garantia, dealer loyalty, idade). Usado em /clients/leads.';

revoke all on function public.leads_ranqueados(numeric, text, text, integer, text, integer) from public, anon;
grant execute on function public.leads_ranqueados(numeric, text, text, integer, text, integer) to authenticated;
grant execute on function public.leads_ranqueados(numeric, text, text, integer, text, integer) to service_role;

-- Source migration: 20260926_019_sprint3_security_hardening.sql
-- Security hardening for the Sprint 3 review.
-- Existing installations apply this migration; fresh installations also get
-- the same policy/function definitions from migrations 002, 016, and 018.

drop policy if exists profiles_self_update on public.profiles;
revoke update on table public.profiles from anon, authenticated, public;

drop policy if exists ai_insights_authenticated_read on public.ai_insights;
drop policy if exists ai_insights_admin_read on public.ai_insights;
create policy ai_insights_admin_read on public.ai_insights
  for select using (public.is_admin());

alter function public.dealer_perfil_stats(integer) security invoker;
revoke all on function public.dealer_perfil_stats(integer) from public, anon;
grant execute on function public.dealer_perfil_stats(integer) to authenticated, service_role;

create or replace function public.leads_ranqueados(
  risco_min numeric default 0.4,
  filtro_perfil text default null,
  filtro_modelo text default null,
  filtro_dealer integer default null,
  filtro_sinal text default null,
  limite integer default 50
)
returns table (
  id uuid,
  nome_cliente text,
  vin_hash text,
  model_name text,
  model_year smallint,
  dealer_code_venda integer,
  perfil_real text,
  dias_desde_ultima_revisao smallint,
  warranty_start_date date,
  dealer_loyalty numeric,
  num_revisoes smallint,
  risco_composto numeric,
  sinais text[]
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with base as (
    select
      c.id,
      c.nome_cliente,
      c.vin_hash,
      c.model_name,
      c.model_year,
      c.dealer_code_venda,
      c.perfil_real,
      c.dias_desde_ultima_revisao,
      c.warranty_start_date,
      c.dealer_loyalty,
      c.num_revisoes,
      case c.perfil_real
        when 'abandono'  then 0.85
        when 'esquecido' then 0.65
        when 'economico' then 0.35
        when 'fiel'      then 0.15
        else                  0.20
      end as risco_base,
      array_remove(array[
        case when c.dias_desde_ultima_revisao > 365 then 'revisao_atrasada' end,
        case when c.warranty_start_date is not null
             and c.warranty_start_date + interval '3 years' < now() then 'garantia_vencida' end,
        case when c.warranty_start_date is not null
             and c.warranty_start_date + interval '3 years' >= now()
             and c.warranty_start_date + interval '3 years' < now() + interval '90 days'
             then 'garantia_vencendo' end,
        case when c.dealer_loyalty < 0.4 and c.num_revisoes > 0 then 'dealer_loyalty_baixa' end,
        case when c.model_year is not null and (extract(year from now()) - c.model_year) >= 5
             then 'veiculo_veterano' end,
        case when c.num_revisoes = 0 and c.delivery_date is not null
             and c.delivery_date < now() - interval '15 months' then 'sem_revisao_alguma' end
      ], null) as sinais
    from public.clients c
    where c.perfil_real is not null
      and (filtro_perfil is null or c.perfil_real = filtro_perfil)
      and (filtro_modelo is null or c.model_name = filtro_modelo)
      and (filtro_dealer is null or c.dealer_code_venda = filtro_dealer)
  ),
  com_risco as (
    select
      b.*,
      least(0.99,
        b.risco_base
        + case when 'revisao_atrasada'     = any(b.sinais) then 0.10 else 0 end
        + case when 'garantia_vencida'     = any(b.sinais) then 0.05 else 0 end
        + case when 'dealer_loyalty_baixa' = any(b.sinais) then 0.05 else 0 end
        + case when 'veiculo_veterano'     = any(b.sinais) then 0.03 else 0 end
        + case when 'sem_revisao_alguma'   = any(b.sinais) then 0.07 else 0 end
      ) as risco_composto
    from base b
  )
  select
    id, nome_cliente, vin_hash, model_name, model_year, dealer_code_venda,
    perfil_real, dias_desde_ultima_revisao, warranty_start_date,
    dealer_loyalty, num_revisoes,
    risco_composto, sinais
  from com_risco
  where risco_composto >= risco_min
    and (filtro_sinal is null or filtro_sinal = any(sinais))
  order by risco_composto desc, num_revisoes asc
  limit least(greatest(coalesce(limite, 50), 1), 500);
$$;

revoke all on function public.leads_ranqueados(numeric, text, text, integer, text, integer) from public, anon;
grant execute on function public.leads_ranqueados(numeric, text, text, integer, text, integer) to authenticated, service_role;

create or replace function public.leads_ranqueados_stats()
returns table (
  total bigint,
  alto bigint,
  medio bigint,
  baixo bigint,
  por_sinal jsonb,
  por_perfil jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with base as (
    select
      c.perfil_real,
      array_remove(array[
        case when c.dias_desde_ultima_revisao > 365 then 'revisao_atrasada' end,
        case when c.warranty_start_date is not null
             and c.warranty_start_date + interval '3 years' < now() then 'garantia_vencida' end,
        case when c.warranty_start_date is not null
             and c.warranty_start_date + interval '3 years' >= now()
             and c.warranty_start_date + interval '3 years' < now() + interval '90 days'
             then 'garantia_vencendo' end,
        case when c.dealer_loyalty < 0.4 and c.num_revisoes > 0 then 'dealer_loyalty_baixa' end,
        case when c.model_year is not null and (extract(year from now()) - c.model_year) >= 5
             then 'veiculo_veterano' end,
        case when c.num_revisoes = 0 and c.delivery_date is not null
             and c.delivery_date < now() - interval '15 months' then 'sem_revisao_alguma' end
      ], null) as sinais,
      case c.perfil_real
        when 'abandono'  then 0.85
        when 'esquecido' then 0.65
        when 'economico' then 0.35
        when 'fiel'      then 0.15
        else                  0.20
      end as risco_base
    from public.clients c
    where c.perfil_real is not null
  ),
  scored as (
    select
      perfil_real,
      sinais,
      least(0.99,
        risco_base
        + case when 'revisao_atrasada'     = any(sinais) then 0.10 else 0 end
        + case when 'garantia_vencida'     = any(sinais) then 0.05 else 0 end
        + case when 'dealer_loyalty_baixa' = any(sinais) then 0.05 else 0 end
        + case when 'veiculo_veterano'     = any(sinais) then 0.03 else 0 end
        + case when 'sem_revisao_alguma'   = any(sinais) then 0.07 else 0 end
      ) as risco_composto
    from base
  ),
  eligible as (
    select * from scored where risco_composto >= 0.4
  ),
  signal_counts as (
    select sinal, count(*) as quantidade
    from eligible e
    cross join lateral unnest(e.sinais) as signal_rows(sinal)
    group by sinal
  ),
  profile_counts as (
    select perfil_real, count(*) as quantidade
    from eligible
    group by perfil_real
  )
  select
    count(*)::bigint,
    count(*) filter (where risco_composto >= 0.7)::bigint,
    count(*) filter (where risco_composto >= 0.5 and risco_composto < 0.7)::bigint,
    count(*) filter (where risco_composto >= 0.4 and risco_composto < 0.5)::bigint,
    coalesce((select jsonb_object_agg(sinal, quantidade) from signal_counts), '{}'::jsonb),
    coalesce((select jsonb_object_agg(perfil_real, quantidade) from profile_counts), '{}'::jsonb)
  from eligible;
$$;

revoke all on function public.leads_ranqueados_stats() from public, anon;
grant execute on function public.leads_ranqueados_stats() to authenticated;
grant execute on function public.leads_ranqueados_stats() to service_role;
