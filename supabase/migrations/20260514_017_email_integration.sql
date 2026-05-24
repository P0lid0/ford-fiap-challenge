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
