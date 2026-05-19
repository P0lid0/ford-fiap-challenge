-- Permite 'vehicle411' (autoapi411.com) como provedor na tabela secret_keys (ai_keys).
-- Usado pra specs detalhadas de motor/transmissão/reboque, cobertura US-centric.
alter table public.ai_keys drop constraint if exists ai_keys_provider_check;
alter table public.ai_keys add constraint ai_keys_provider_check
  check (provider in ('openai', 'anthropic', 'gemini', 'fipe', 'vehicle411'));
