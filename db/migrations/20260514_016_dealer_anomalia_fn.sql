-- =====================================================================
-- RPC: agregação de perfil_real por dealer
-- =====================================================================
-- Agregar 175k VINs no Node seria caro; esta função roda a agregação
-- INTEIRA dentro do Postgres e devolve só o sumário por dealer (412 linhas).
-- A API chama: select * from public.dealer_perfil_stats($1).
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
