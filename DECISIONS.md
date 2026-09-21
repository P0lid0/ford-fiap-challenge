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
> **Substituída em 2026-09-17 pela decisão 13** (PostgreSQL padrão, auth própria, isolamento na API).

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
> **Atualizada em 2026-09-17 (decisão 13):** o mobile não fala mais com nenhum provedor de auth — só com a API (`/auth/login`, `/auth/register`); o único segredo (`JWT_SECRET`) fica no backend.

**Decisão:** `EXPO_PUBLIC_*` só inclui `SUPABASE_URL` e `SUPABASE_ANON_KEY` (pública por design); service_role só no backend.
**Motivação:** mobile vira PWA, IPA ou APK — qualquer chave que vai pra lá é pública.
**Impacto:** o mobile autentica direto no Supabase Auth e usa o JWT do usuário pra todas as chamadas (RLS protege os dados).

### 9. Cache de insights Claude em `ai_insights` com hash do payload
**Decisão:** tabela `ai_insights(scope, resource_id, payload_hash)` com TTL.
**Motivação:** insights são determinísticos por payload — re-chamar é desperdício de token e latência.
**Impacto:** custo Claude estimado em ~$5/mês mesmo com uso intenso pela banca avaliadora.

### 10. Migration runner com fallback manual (SQL Editor)
> **Substituída em 2026-09-17 pela decisão 13:** runner próprio (`scripts/db-migrate.mjs`) contra `DATABASE_URL`; `migrations.combined.sql` foi removido.

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

## 2026-09-17

### 13. Migração Supabase → PostgreSQL padrão (ADR)
**Status:** aceita e implementada. Substitui as decisões 3, 8 (parte) e 10.

**Contexto:** o projeto dependia do Supabase em cinco pontos — Auth/GoTrue
(login, `auth.users`, trigger `handle_new_user`), PostgREST via
`@supabase/supabase-js` em API/web/mobile, RLS com `auth.uid()`/`auth.role()`
para isolar dealerships, Vault/`extensions.` para segredos e a Management API
para aplicar migrations. Isso amarrava o banco a um provedor específico, exigia
chaves de terceiros (`service_role`, `anon`, PAT) em todo ambiente e deixava a
autorização espalhada entre policies SQL e código.

**Decisão:** rodar sobre **PostgreSQL padrão** e trazer auth e autorização
para a API:
- **Dados**: driver `postgres` (porsager) em `apps/api/src/lib/db.ts`, sempre
  com tagged template (parâmetros bindados). Parsers configurados para manter
  o contrato HTTP que o PostgREST entregava (`numeric`/`bigint` → `Number`,
  `date` → string `YYYY-MM-DD`, `timestamptz` → `Date`).
- **Auth própria** (`apps/api/src/lib/auth.ts`, `routes/auth.ts`): senha com
  bcrypt (cost 12) em `profiles.password_hash`; sessão em JWT HS256 assinado
  com `JWT_SECRET`, expiração `JWT_EXPIRES_IN` (12h); `POST /auth/login` e
  `POST /auth/register`; `plugins/auth.ts` valida o Bearer e recarrega o
  profile a cada request. `profiles` deixa de ter FK para `auth.users` e ganha
  `id default gen_random_uuid()` (migration `019_auth_local`).
- **Tenancy na API** (`apps/api/src/lib/scope.ts`) em vez de RLS: admin lê e
  escreve tudo; gestor lê tudo e escreve só na própria dealership; analista
  lê/escreve só a própria dealership (`email_logs`: só o que ele enviou).
  Rotas que dependiam do RLS passaram a aplicar o filtro explicitamente.
- **Migrations** em `db/migrations/` (19 arquivos, nomes originais mantidos),
  aplicadas por `scripts/db-migrate.mjs` com controle em `schema_migrations`,
  uma transação por arquivo, idempotente. `002_rls_policies` virou um arquivo
  que documenta a decisão e cria índice. A pasta `supabase/` foi removida.
- **Config**: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` substituem todo
  `SUPABASE_*`; web/mobile só precisam de `EXPO_PUBLIC_API_URL`.
- **Seeds**: `pnpm db:seed:admin` (admin de demo com hash bcrypt) e
  `pnpm db:seed` (vehicles), ambos via `DATABASE_URL`.

**Motivação:**
1. Portabilidade — qualquer PostgreSQL (local, container, gerenciado) roda o
   projeto; CI sobe um `postgres:16` e aplica as migrations.
2. Um único lugar para autorização — as regras ficam em TypeScript, testáveis,
   em vez de divididas entre policies SQL e `requireRole`.
3. Menos segredos de terceiros — sai `service_role`/`anon`/PAT, entra um
   `JWT_SECRET` gerado localmente.
4. Setup reproduzível para a banca: `pnpm install → cp .env.example .env.local
   → pnpm db:migrate → pnpm db:seed:admin → pnpm db:seed → rodar`.

**Consequências:**
- (+) Sem vendor lock-in; ambiente local completo sem conta externa.
- (+) Contratos HTTP (paths, query params, shapes, códigos) preservados —
  web e mobile só trocaram o cliente de auth.
- (−) A API vira o único guardião do isolamento: **toda** query de dados de
  cliente precisa passar por `lib/scope.ts`. Uma rota nova que esqueça o
  filtro vaza dados entre dealerships — não há mais a rede de segurança do
  banco. Mitigação: helpers centralizados, revisão de código e testes de
  autorização por papel (pendente, ver abaixo).
- (−) Sem refresh token: sessão dura `JWT_EXPIRES_IN`; rotacionar
  `JWT_SECRET` invalida todas as sessões.
- (−) Criptografia em repouso, backup e TLS do banco passam a ser
  responsabilidade da infraestrutura (checklist em `docs/SECURITY.md`).
- Sem storage de arquivos gerenciado — o projeto não usava Supabase Storage.

---

## Riscos conhecidos / dívida técnica

- **Sem testes automatizados de autorização por papel** (`lib/scope.ts`). Risco real: rota nova que esqueça `dealershipFilter` abre dado entre dealerships. Prioridade após a migração.
- **Sem refresh token** — sessão expira em `JWT_EXPIRES_IN` e o usuário loga de novo; aceitável para o MVP.
- **Chaves de IA em `ai_keys` em claro** (só rotas admin as expõem). Cifrar com `pgcrypto` ou secret manager antes de produção.
- **`carrosnaweb` está com backend off** (500 em todas as fichas). LLM fallback cobre o gap.
- **Modelo F1 macro 0.56** — bom, mas a classe "esquecido" tem o pior recall (features sutis no momento da compra). SMOTE/ADASYN podem subir.
- **Detox e2e não configurado** ainda. M3 vai cobrir.

---

## Credenciais e rotação

- **2026-09-17:** com a migração para PostgreSQL padrão, nenhuma chave do Supabase é mais usada pelo código. As chaves recebidas em 14/05/2026 (`SUPABASE_SERVICE_ROLE_KEY` e `sb_secret_*`, que saíram do canal seguro) devem ser **revogadas** no dashboard do projeto antigo e o projeto desativado.
- `JWT_SECRET` é gerado localmente (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) e vive só em `.env.local`/secret manager. Rotacionar = todas as sessões expiram.
- `ADMIN_PASSWORD` de demo (`Ford2026!`) serve para a banca; em qualquer ambiente exposto, rode `ADMIN_PASSWORD=<nova> pnpm db:seed:admin`.
