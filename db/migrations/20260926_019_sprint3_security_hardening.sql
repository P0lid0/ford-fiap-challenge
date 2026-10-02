-- =====================================================================
-- Sprint 3 — endurecimento de segurança (versão PostgreSQL padrão)
-- =====================================================================
-- Na versão original (Supabase) esta migration também trocava policies de RLS,
-- revogava grants de anon/authenticated e passava as funções para
-- `security invoker`. Em PostgreSQL padrão não há RLS nem esses papéis: o
-- isolamento por papel/concessionária é feito pela API (lib/data-access.ts) e
-- as funções já rodam com os direitos de quem chama.
--
-- O que resta aqui é o que não depende do Supabase:
--   - leads_ranqueados: `limite` limitado a 1..500 (mesma definição da 018,
--     recriada para instalações que já tinham a versão sem o limite);
--   - leads_ranqueados_stats(): agregação de leads em uma única chamada
--     (total, urgência, sinais, perfis) usada em /clients/leads/stats.
-- =====================================================================

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
