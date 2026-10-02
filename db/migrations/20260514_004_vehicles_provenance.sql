-- Provenance dos dados de veículos — Desafio 1 com fontes verificáveis.
alter table public.vehicles
  add column if not exists data_sources jsonb not null default '{}'::jsonb,
  add column if not exists fipe_codigo text,
  add column if not exists fipe_mes_referencia text,
  add column if not exists confianca_geral text not null default 'baixa'
    check (confianca_geral in ('alta', 'media', 'baixa'));

create index if not exists vehicles_fipe_idx on public.vehicles(fipe_codigo) where fipe_codigo is not null;
