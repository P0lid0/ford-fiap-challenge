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
