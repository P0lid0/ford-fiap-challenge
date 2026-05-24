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
security definer
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
  limit limite;
$$;

comment on function public.leads_ranqueados is
  'Lead ranking com risco composto = perfil_real + sinais (revisão atrasada, garantia, dealer loyalty, idade). Usado em /clients/leads.';

grant execute on function public.leads_ranqueados(numeric, text, text, integer, text, integer) to authenticated;
grant execute on function public.leads_ranqueados(numeric, text, text, integer, text, integer) to service_role;
