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
