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
