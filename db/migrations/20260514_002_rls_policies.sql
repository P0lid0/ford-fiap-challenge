-- =====================================================================
-- Isolamento de dados — movido para a camada da API
-- =====================================================================
-- Esta migration originalmente habilitava Row Level Security e criava as
-- policies que dependiam de auth.uid()/auth.role() (Supabase GoTrue).
-- Com o projeto rodando em PostgreSQL padrão, não há sessão de usuário no
-- banco: a API conecta com um único role e aplica as regras em código.
--
-- Regras (implementadas em apps/api/src/lib/data-access.ts):
--   admin    → lê e escreve tudo.
--   gestor   → lê tudo (clients, client_history, predictions, acoes_retencao,
--              email_logs); escreve só na própria dealership.
--   analista → lê/escreve só dealership_id = profiles.dealership_id.
--   email_logs: analista vê só sent_by = próprio id.
--   vehicles/catalog_items/vehicle_catalog_values/dealerships: leitura para
--   qualquer autenticado; escrita conforme o papel exigido pela rota.
--   ai_keys/ai_config/audit_log: admin.
--   ai_insights: leitura só admin (Sprint 3); a API grava o cache e entrega o
--   conteúdo pelas rotas /insights, que aplicam o escopo.
--   profiles: papel e concessionária só mudam por provisionamento do admin
--   (não há rota de autoatualização).
--
-- Mantemos aqui apenas índices que apoiam esses filtros. O arquivo precisa
-- continuar SQL válido porque o runner registra cada nome aplicado.
-- =====================================================================

-- Filtro por dealership + ordenação por data é a consulta mais comum do
-- analista na listagem de clientes.
create index if not exists clients_dealership_created_idx
  on public.clients(dealership_id, created_at desc);
