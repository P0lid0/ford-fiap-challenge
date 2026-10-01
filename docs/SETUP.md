# Setup detalhado

Stack de dados: **PostgreSQL padrão** (local, container ou gerenciado) acessado
pela API com o driver `postgres` (porsager). Não há Supabase: a autenticação é
própria (JWT HS256 emitido pela API + senha em bcrypt) e o escopo por
concessionária/perfil é aplicado pela API (`apps/api/src/lib/data-access.ts`).

## Passo 0 — PostgreSQL

Qualquer PostgreSQL ≥ 14 serve (a migration 001 habilita `pgcrypto`;
`gen_random_uuid()` é nativo). Crie o banco `faroai`:

```bash
# local (psql/createdb no PATH)
createdb faroai

# ou container
docker run -d --name faroai-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=faroai postgres:16
```

## Passo 1 — Variáveis de ambiente

Crie `.env.local` na raiz (cópia de `.env.example`):

```bash
cp .env.example .env.local
```

A API (`apps/api/src/config.ts`) e os scripts de `scripts/` leem esse arquivo
da raiz; variáveis já presentes no ambiente têm precedência.

| Variável | Valor | Obrigatória? |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5432/faroai` (ajuste usuário, senha e host) | ✓ |
| `CLIENT_CPF_PEPPER` | segredo aleatório de 32+ caracteres: `openssl rand -hex 32` | ✓ |
| `ML_SERVICE_TOKEN` | segredo aleatório de 32+ caracteres (`openssl rand -hex 32`); use o mesmo valor na API e no serviço ML | ✓ |
| `JWT_SECRET` | 32+ caracteres: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` | ✓ em produção (em desenvolvimento há um valor padrão) |
| `JWT_EXPIRES_IN_SECONDS` | validade do token em segundos (padrão `3600`) | opcional |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | só para usar Claude (senão cai em fallback) |
| `ML_SERVICE_URL` | URL do serviço de ML (padrão `http://localhost:8001`) | opcional |
| `API_HOST` | padrão `127.0.0.1`; use `0.0.0.0` apenas se outro dispositivo ou container precisar acessar a API | opcional |
| `TRUST_PROXY` | `false` localmente; `true` somente atrás de um proxy confiável | recomendado |

Não troque `CLIENT_CPF_PEPPER` sem planejar a migração dos hashes existentes.
O CPF original não é guardado, então um hash antigo não pode ser recalculado sem
receber o CPF novamente de uma fonte autorizada.

**Web (`apps/web/.env.local`)** e **Mobile (`apps/mobile/.env.local`)** — só a URL da API:
```
EXPO_PUBLIC_API_URL=http://localhost:3333
```
(no web, `next.config.js` expõe esse valor como `NEXT_PUBLIC_API_URL`.)

## Passo 2 — Instalar dependências e aplicar as migrations

```bash
pnpm install
pnpm db:migrate
```

`scripts/db-migrate.mjs` aplica os arquivos de `db/migrations/` em ordem
alfabética (20 migrations), registrando cada nome em
`public.schema_migrations`. Cada arquivo roda numa transação própria: se um
falhar, nada dele fica aplicado, o nome não é registrado e basta corrigir e
rodar de novo. Para conferir sem alterar nada:

```bash
pnpm db:migrate:status
```

Migrations de referência:
- `001_init` — schema base (`profiles`, `dealerships`, `clients`, `vehicles`, ...)
- `002_rls_policies` — só documenta que o isolamento por concessionária passou para a API (e cria um índice); o nome foi mantido para o histórico
- `003_seed_dealerships` — concessionárias de demonstração (`FD001`...)
- `20260926_019_sprint3_security_hardening` — funções de leads com limite de resultados e `leads_ranqueados_stats()`
- `20260927_020_auth_local` — `profiles.password_hash` + default `gen_random_uuid()` em `profiles.id`

## Passo 3 — Usuário admin de demonstração

```bash
pnpm db:seed:admin
```

Faz upsert por e-mail em `public.profiles` com hash bcrypt (custo 12):

```
email: admin@faroai.com.br
senha: Ford2026!
role:  admin
```

Personalize com `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` e
`ADMIN_DEALERSHIP_CODIGO` (padrão `FD001`; se a concessionária existir, vincula).
Essa senha é só para ambiente local — troque-a em qualquer outro ambiente.

## Passo 4 — Seed de veículos (Desafio 1)

```bash
pnpm db:seed
```

Insere Ranger Raptor, Hilux GR-S, RAM 1500 TRX, Amarok V6, Bronco Wildtrack
(upsert por `hash_dedupe`, pode rodar mais de uma vez).

## Passo 5 — Outros usuários

Não há rota de cadastro na API: usuários são criados por script (upsert por
e-mail, senha em bcrypt):

```bash
pnpm db:user --email ana@faroai.com.br --password '<senha>' --role analista --dealership FD001 --name "Ana"
# a senha também pode vir de USER_PASSWORD, para não ir ao histórico do shell
```

`--role` aceita `analista` (padrão), `gestor` ou `admin`; `--dealership` é o
código da concessionária (obrigatório para analista e gestor).

Para mudar o perfil ou a concessionária de um usuário existente, rode o mesmo
comando de novo ou use SQL (psql ou qualquer cliente):

```sql
update public.profiles set role = 'admin' where email = 'seu@email.com';

update public.profiles
set dealership_id = (select id from public.dealerships where codigo = 'FD001')
where email = 'seu@email.com';
```

O token carrega o perfil: a mudança só vale no próximo login. Um `analista` sem
`dealership_id` não vê clientes nem ações (responde `403 no_dealership`);
`gestor` e `admin` leem a rede inteira.

## Passo 6 — Dados de demonstração (opcional)

```bash
pnpm db:seed:demo
```

Cria os usuários `gestor@faroai.com.br` (gestor, FD001), `analista@faroai.com.br`
(analista, FD001) e `analista2@faroai.com.br` (analista, FD002), todos com a senha
`Ford2026!`, mais cerca de 700 clientes fictícios nas 10 concessionárias, com
histórico, predições, ações de retenção e e-mails de exemplo. Se o serviço de ML
estiver no ar (`ML_SERVICE_URL` e `ML_SERVICE_TOKEN`), as predições vêm dele; senão
o script usa uma heurística determinística e informa quantas vieram de cada fonte.
É idempotente: só apaga e recria as linhas marcadas como `demo_seed`.

## Passo 7 — Treinar o modelo

```bash
cd services/ml
pip install -r requirements.txt
python -m src.scripts.train_models 10000
```

## Passo 8 — Rodar tudo

Em 4 terminais separados:

```bash
# Terminal 1 — ML service
cd services/ml && python -m uvicorn src.main:app --reload --port 8001

# Terminal 2 — API
pnpm dev:api                    # http://localhost:3333 (Swagger em /docs)

# Terminal 3 — Web
pnpm --filter @ford/web dev     # http://localhost:3000

# Terminal 4 — Mobile
pnpm dev:mobile                 # QR code para Expo Go
```

## Testes

Os testes da API usam um banco próprio (`faroai_test`), para não tocar nos dados de
desenvolvimento:

```bash
createdb faroai_test
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/faroai_test pnpm db:migrate
pnpm --filter @ford/api test
```

## Troubleshooting

**API não sobe: erro de validação em `DATABASE_URL`, `CLIENT_CPF_PEPPER` ou `ML_SERVICE_TOKEN`** → o
`.env.local` da raiz está faltando ou incompleto (passo 1). Os segredos
precisam ter pelo menos 32 caracteres.

**`ECONNREFUSED 127.0.0.1:5432`** → o PostgreSQL não está rodando ou a
`DATABASE_URL` aponta para host/porta errados (passo 0).

**`relation "public.profiles" does not exist`** → as migrations não foram
aplicadas (passo 2). Confira com `pnpm db:migrate:status`.

**`pnpm db:migrate` falhou no meio** → a migration com erro não foi registrada;
o log mostra o arquivo e a mensagem do Postgres. Corrija e rode de novo — as
anteriores já registradas são puladas.

**Login responde 401 `invalid_credentials`** → e-mail não existe, senha errada
ou o perfil está sem `password_hash` (rode `pnpm db:seed:admin` para o admin ou
`pnpm db:user` para os demais). A mensagem é genérica de propósito.

**Login responde 502 `identity_provider_unavailable`** → a API não conseguiu
consultar o banco (confira `DATABASE_URL` e se o PostgreSQL está no ar).

**Web/mobile não conectam** → confira `EXPO_PUBLIC_API_URL` no `.env.local` do
app e se a origem está em `ALLOWED_ORIGINS` na raiz.

**ML service responde 503: "modelo não encontrado"** → rode
`python -m src.scripts.train_models` (passo 7).

**API responde 403 `no_dealership` ao chamar `/clients`** → o usuário (analista)
não está vinculado a uma concessionária (passo 3 ou 5).
