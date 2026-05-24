-- Reverte 013: feature de campanhas WhatsApp foi descartada.
drop table if exists public.msg_campanhas cascade;
drop type if exists msg_destinatario_status;
drop type if exists msg_campanha_status;
drop type if exists msg_provedor;
