-- Reverte 013: feature de campanhas WhatsApp foi descartada.
drop table if exists public.msg_campanhas cascade;
-- O cascade derruba o trigger, mas não a função — remove pra não ficar órfã.
drop function if exists public.tg_msg_campanhas_updated_at();
drop type if exists msg_destinatario_status;
drop type if exists msg_campanha_status;
drop type if exists msg_provedor;
