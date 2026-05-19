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
