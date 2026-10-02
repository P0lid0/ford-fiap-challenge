# Decisões técnicas — Ford × FIAP Challenge

Registro cronológico das decisões não-óbvias e o porquê. Padrão: `[DATA] · Decisão. Motivação. Impacto esperado.`

---

## 2026-05-14

### 1. Modular monolith no API gateway, não microsserviços
**Decisão:** `apps/api` é uma única aplicação Fastify com módulos isolados (`modules/competitive`, `modules/retention`, `routes/insights`).
**Motivação:** time pequeno (5 alunos), sprint única de 10 dias. Microsserviços adicionam complexidade operacional sem retorno imediato. Os módulos têm fronteiras bem desenhadas e podem ser extraídos sem reescrita.
**Impacto:** velocidade de entrega aumenta; observabilidade fica unificada; deploy é um único processo.

### 2. ML em serviço separado (FastAPI)
**Decisão:** `services/ml` é um processo Python separado, acessado via HTTP do API gateway.
**Motivação:** ecossistema Python para sklearn/XGBoost é incomparável; isolar ML reduz risco de breaking change no API gateway TS.
**Impacto:** atende SOA limpa (serviços independentes); permite escalar ML horizontalmente.

### 3. Supabase como single source of truth (Postgres + Auth + Storage + RLS)
> **Substituída em 2026-10-01 pela decisão 13** (PostgreSQL padrão, identidade local, escopo aplicado na API).

**Decisão:** todo o estado mora no Supabase. Sem outro banco.
**Motivação:** pedido explícito do Pólido. Reduz peças móveis. RLS no Postgres elimina lógica de autorização duplicada no backend.
**Impacto:** muito menos código de auth/autorização para escrever; risco concentrado em escrever boas policies (mitigado com testes).

### 4. Schema canônico de veículo versionado
**Decisão:** schema com `schema_version` e `extra="ignore"` na validação Pydantic.
**Motivação:** o requisito Ford é "lista padronizada de specs com formato sempre igual". Tornar o schema versionado permite evolução não-quebrável.
**Impacto:** consumidores podem ignorar campos novos; quando precisar quebrar, sobe major version e versiona o endpoint.

### 5. Lookup com seleção dinâmica de campos (`?fields=motor.potencia_cv,...`)
**Decisão:** o endpoint `/competitive/lookup` aceita um query param `fields` separado por vírgula, com dot-notation.
**Motivação:** o briefing Ford é literal: *"A ferramenta deve permitir que o usuário defina livremente a lista de atributos técnicos que deseja pesquisar"*. Schema fixo viola isso.
**Impacto:** UI mobile pode renderizar formulário "escolha o que comparar"; campos não solicitados não viajam pela rede; campos solicitados mas ausentes vêm como `null` explícito (regra Ford).

### 6. Dados sintéticos para Desafio 2 + dados reais para Desafio 1
**Decisão:** retenção (D2) usa o gerador `services/ml/src/synthetic.py`; competição (D1) tenta `carrosnaweb` + LLM fallback.
**Motivação:** D2 trata de dados de cliente Ford (PII real seria inviável e inseguro); D1 precisa de dados reais para o piloto ser convincente.
**Impacto:** notebook treina classificador defensável; comparativo apresenta carros reais (quando carrosnaweb voltar).

### 7. Scraping do carrosnaweb.com.br + fallback LLM
**Decisão:** chain de ingestão: (1) tenta `fichadetalhe.asp?codigo=`; (2) fallback Claude com fetch da fabricante oficial; (3) erro 404 limpo.
**Motivação:** em 14/05/2026, todas as fichas em `carrosnaweb` retornam 500. O scraper está pronto pra quando o site voltar; o LLM cobre o gap.
**Impacto:** robustez contra fonte indisponível; custo Claude controlado por cache em `ai_insights`.

### 8. JWT secret e service_role nunca no mobile
> **Atualizada em 2026-10-01 (decisão 13):** não há mais `service_role`, `anon key` nem provedor de auth. Web e mobile falam só com a API (`POST /auth/login`); o único segredo de assinatura (`JWT_SECRET`) fica no backend. O princípio — nenhum segredo no cliente — continua valendo.

**Decisão:** `EXPO_PUBLIC_*` só inclui `SUPABASE_URL` e `SUPABASE_ANON_KEY` (pública por design); service_role só no backend.
**Motivação:** mobile vira PWA, IPA ou APK — qualquer chave que vai pra lá é pública.
**Impacto:** o mobile autentica direto no Supabase Auth e usa o JWT do usuário pra todas as chamadas (RLS protege os dados).

### 9. Cache de insights Claude em `ai_insights` com hash do payload
**Decisão:** tabela `ai_insights(scope, resource_id, payload_hash)` com TTL.
**Motivação:** insights são determinísticos por payload — re-chamar é desperdício de token e latência.
**Impacto:** custo Claude estimado em ~$5/mês mesmo com uso intenso pela banca avaliadora.

### 10. Migration runner com fallback manual (SQL Editor)
> **Substituída em 2026-10-01 pela decisão 13:** runner próprio (`scripts/db-migrate.mjs`) contra `DATABASE_URL`; `migrations.combined.sql` foi removido.

**Decisão:** `pnpm db:migrate` é o caminho automatizado; `supabase/migrations.combined.sql` é o paste manual.
**Motivação:** Supabase requer DB password ou Personal Access Token para automação. O paste manual no SQL Editor é 1 clique.
**Impacto:** independência da Supabase CLI; qualquer dev consegue rodar.

### 11. Validação Ford com Ranger Raptor (seed-vehicles.mjs)
**Decisão:** o seed inicial inclui Ranger Raptor 2025 (397cv, 583Nm, 4x4 com bloqueios), Hilux GR-S, RAM 1500 TRX, Amarok V6 e Bronco Wildtrack.
**Motivação:** o critério de validação Ford é literal: "utilizem a Ford Ranger Raptor".
**Impacto:** demonstração imediata sem depender de scraping ao vivo.

### 12. Sem TypeScript no `services/ml`
**Decisão:** Python puro.
**Motivação:** evita reimplementar ML em TS; ecossistema Python é maduro para isso.
**Impacto:** o package `@ford/types` documenta os tipos; quem mexer em Python precisa manter coerência com os TS (cobrir com testes).

---

## 2026-10-01

### 13. Migração Supabase → PostgreSQL padrão (ADR)
**Status:** aceita e implementada. Substitui a decisão 3 e a 10, e atualiza a 8.

**Contexto:** mesmo depois da Sprint 3 (JWT próprio, escopo por concessionária na
API, Problem Details), o projeto ainda dependia do Supabase em quatro pontos:
Supabase Auth (conferir e-mail/senha e validar tokens legados de web/mobile),
PostgREST via `@supabase/supabase-js` (toda a leitura e escrita de dados), RLS
com `auth.uid()`/`auth.role()` como segunda camada de isolamento por
concessionária, e a Management API para aplicar migrations. Isso exigia chaves
de terceiros (`service_role`, `anon`, PAT) em todo ambiente e impedia rodar o
projeto sobre um banco comum.

**Decisão:** rodar sobre **PostgreSQL padrão**, **preservando o desenho do time**
(contratos HTTP, Problem Details, escopos, nomes de erro, OpenAPI e testes):
- **Dados:** driver `postgres` (porsager) em `apps/api/src/lib/db.ts`, sempre com
  tagged template parametrizado (`sql.unsafe` só no runner de migrations).
  Parsers mantêm o contrato que o PostgREST entregava (`numeric`/`bigint` →
  `Number`, `date` → `YYYY-MM-DD`, `timestamptz` → `Date`).
- **Identidade local:** `lib/identity.ts` mantém a API pública
  (`authenticateWithPassword`, `findUserProfile`), agora conferindo bcrypt
  (cost 12) contra `profiles.password_hash`; quando o e-mail não existe roda o
  compare contra um hash fictício, para não vazar por tempo quais e-mails estão
  cadastrados. Falha do banco no login continua virando `502
  identity_provider_unavailable`. O token legado do Supabase deixou de existir.
  Não há rota de cadastro: usuários são criados por `pnpm db:user` (ou
  `db:seed:admin` / `db:seed:demo`).
- **JWT:** continua o do time (`lib/jwt.ts`, HS256, `iss`/`aud`/`jti`/`exp`,
  claims `role` e `dealership_id`); `POST /auth/login` mantém exatamente
  `{ access_token, token_type: "Bearer", expires_in }`.
- **Escopo explícito no lugar do RLS:** `lib/data-access.ts` mantém
  `readScopeOf`/`writeScopeOf`/`canAccessDealership`/`assertCanModify`/
  `requireDealership` com a mesma semântica e ganha `scopeFilter(escopo, coluna)`,
  que devolve o fragmento SQL `and <coluna> = <id>` (vazio para a rede inteira).
  As rotas que dependiam do RLS (`dbFor(user)`) passaram a aplicar o escopo na
  própria query.
- **Migrations** em `db/migrations/` (20 arquivos, nomes originais mantidos),
  aplicadas por `scripts/db-migrate.mjs` (controle em `schema_migrations`, uma
  transação por arquivo, idempotente, `--status`). Foi removido o que era
  específico do Supabase (FK para `auth.users`, RLS e policies, grants a
  `anon`/`authenticated`/`service_role`, `security definer`, schema `auth`) e
  `uuid_generate_v4` virou `gen_random_uuid`. A `002_rls_policies` virou um
  arquivo que documenta a decisão (e cria um índice); a
  `20260926_019_sprint3_security_hardening` manteve as funções de leads com
  limite de resultados; a nova `20260927_020_auth_local` acrescenta
  `profiles.password_hash` e o default de `profiles.id`. A pasta `supabase/` foi
  removida.
- **Config:** `DATABASE_URL` substitui todo `SUPABASE_*`; `CLIENT_CPF_PEPPER`,
  `ML_SERVICE_TOKEN` e `JWT_*` seguem como antes. Web e mobile só precisam de
  `EXPO_PUBLIC_API_URL`; o web guarda a sessão em `localStorage`
  (`faroai.session`) e descobre e-mail/papel por `GET /me`.
- **Testes e CI:** a suíte da API roda contra um PostgreSQL real
  (`faroai_test`); o CI sobe um `postgres:16` e executa `pnpm db:migrate` antes
  dos testes.

**Motivação:**
1. Portabilidade: qualquer PostgreSQL (local, container, gerenciado) roda o projeto.
2. Menos segredos de terceiros: saem `service_role`, `anon` e PAT; entram só o
   `JWT_SECRET` e a `DATABASE_URL`, definidos localmente.
3. Uma única fonte de verdade para a autorização: TypeScript testável, sem
   metade da regra em policies SQL e metade na API.
4. Setup reproduzível para a banca: `pnpm install → cp .env.example .env.local
   → pnpm db:migrate → pnpm db:seed:admin → pnpm db:seed → rodar`.

**Consequências:**
- (+) Sem vendor lock-in; ambiente completo sem conta externa.
- (+) Contratos HTTP (rotas, parâmetros, formatos, códigos de erro) e a
  documentação OpenAPI preservados.
- (−) A API vira a **única** guardiã do isolamento entre concessionárias: toda
  consulta de dados de cliente precisa aplicar o escopo (`scopeFilter`). Uma
  rota nova que esqueça o filtro vaza dados entre lojas — já não existe a rede de
  segurança do banco. Mitigação: helpers centralizados, testes de autorização
  por perfil e revisão de PR.
- (−) Sem refresh token; rotacionar `JWT_SECRET` invalida todas as sessões.
- (−) Backup, TLS e criptografia em repouso do banco passam a ser da
  infraestrutura (ver `docs/SECURITY.md`).
- (−) As rotas de leads (`leads_ranqueados`) são restritas a gestor/admin, cujo
  escopo de leitura é a rede inteira; por isso a função SQL não ganhou filtro de
  concessionária. Se um analista passar a vê-las, será preciso uma migration nova.
- O projeto não usava Supabase Storage; nada a migrar nesse ponto.

---

## Riscos conhecidos / dívida técnica

- ~~**DB password ausente.**~~ *Resolvido em 2026-10-01 (decisão 13):* as migrations rodam por `pnpm db:migrate` contra a `DATABASE_URL`.
- ~~**`SUPABASE_ANON_KEY` precisa ser preenchido.**~~ *Resolvido em 2026-10-01:* não há mais chave do Supabase; web e mobile só usam `EXPO_PUBLIC_API_URL`.
- **`carrosnaweb` está com backend off** (500 em todas as fichas). LLM fallback cobre o gap.
- ~~**Validação de JWT** chamando `/auth/v1/user` do Supabase.~~ *Substituído em 2026-10-01:* a API valida localmente o JWT que ela mesma emite (`lib/jwt.ts`).
- ~~**Sem testes de RLS policy.**~~ *Não se aplica mais (sem RLS).* O risco equivalente agora é uma consulta nova esquecer o escopo de concessionária; mitigado por `lib/data-access.ts` e pelos testes de autorização.
- **Modelo F1 macro 0.56** — bom, mas a classe "esquecido" tem o pior recall (features sutis no momento da compra). SMOTE/ADASYN podem subir.
- **Detox e2e não configurado** ainda. M3 vai cobrir.

---

## Credenciais e rotação

> **Contexto histórico.** O projeto não usa mais o Supabase (decisão 13). As chaves abaixo,
> porém, saíram do canal seguro e devem ser consideradas comprometidas: ao desativar
> o projeto Supabase antigo (ou, se ele seguir no ar, ao rotacionar as chaves), a
> exposição deixa de ter efeito. Nada disso é necessário para rodar a versão atual.

Em 14/05/2026 o Pólido enviou em chat:
1. `SUPABASE_URL` (semi-público — sem ação necessária)
2. `SUPABASE_SERVICE_ROLE_KEY` (JWT longo)
3. Um `sb_secret_*`

**Ação obrigatória após a entrega:** rotacionar `SUPABASE_SERVICE_ROLE_KEY` e o `sb_secret_*` em **Supabase Dashboard → Settings → API → Reset** (ou desativar o projeto antigo). Essas chaves saíram do canal seguro.
