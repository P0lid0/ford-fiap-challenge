-- Renomeia ai_keys → secret_keys e permite 'fipe' como provedor (mesma mecânica de gerenciamento).
alter table public.ai_keys drop constraint if exists ai_keys_provider_check;
alter table public.ai_keys add constraint ai_keys_provider_check
  check (provider in ('openai', 'anthropic', 'gemini', 'fipe'));
