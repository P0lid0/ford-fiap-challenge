# Setup detalhado

Stack de dados: **PostgreSQL padrão** (local, container ou gerenciado) acessado
pela API com o driver `postgres` (porsager). Não há Supabase: autenticação é
própria (JWT HS256 + bcrypt) e o isolamento por dealership/papel fica na API
(`apps/api/src/lib/scope.ts`).

## Passo 0 — PostgreSQL

Qualquer PostgreSQL ≥ 13 serve (a migration 001 habilita `pgcrypto`;
`gen_random_uuid()` é nativo). Crie o banco `faroai`:

```bash
# local (psql/createdb no PATH)
createdb faroai

# ou container
docker run -d --name faroai-pg -p 5432:5432   -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=faroai postgres:16
```

## Passo 1 — Variáveis de ambiente

Crie `.env.local` na raiz (copia de `.env.example`):

```bash
cp .env.example .env.local
```

A API (`apps/api/src/config.ts`) e os scripts de `scripts/` leem esse arquivo
da raiz; variáveis já presentes no ambiente têm precedência.

| Variável | Valor | Obrigatória? |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5432/faroai` (ajuste usuário/senha/host) | ✓ |
| `JWT_SECRET` | ≥ 32 chars. Gere: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | ✓ |
| `JWT_EXPIRES_IN` | validade do token (default `12h`) | opcional |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | só para usar Claude (senão cai em fallback) |
| `ML_SERVICE_URL` / `ML_SERVICE_TOKEN` | URL do serviço de ML e segredo compartilhado do HMAC | defaults locais funcionam |
| `TRUST_PROXY` | `false` fora de proxy reverso (ver `docs/SECURITY.md`) | opcional |

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
- `002_rls_policies` — só documenta que o isolamento passou para a API (e cria um índice); o nome foi mantido para o histórico
- `003_seed_dealerships` — concessionárias de demo (`FD001`...)
- `019_auth_local` — `profiles.password_hash` + default `gen_random_uuid()` em `profiles.id`

## Passo 3 — Usuário admin de demo

```bash
pnpm db:seed:admin
```

Faz upsert por e-mail em `public.profiles` com hash bcrypt (cost 12):

```
email: admin@faroai.com.br
senha: Ford2026!
role:  admin
```

Personalize com `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` e
`ADMIN_DEALERSHIP_CODIGO` (default `FD001`; se a dealership existir, vincula).

## Passo 4 — Seed de veículos (Desafio 1)

```bash
pnpm db:seed
```

Insere Ranger Raptor, Hilux GR-S, RAM 1500 TRX, Amarok V6, Bronco Wildtrack
(upsert por `hash_dedupe`, pode rodar mais de uma vez).

## Passo 5 — Outros usuários

No web (`/`) ou no mobile, use **Cadastrar**: `POST /auth/register` cria o
usuário com role `analista` (e `full_name` = parte antes do `@`, se não
informado) e já devolve a sessão.

**Para virar admin/gestor** (psql ou qualquer cliente SQL):
```sql
update public.profiles set role = 'admin' where email = 'seu@email.com';
```

**Para se vincular a uma dealership:**
```sql
update public.profiles
set dealership_id = (select id from public.dealerships where codigo = 'FD001')
where email = 'seu@email.com';
```

Um `analista` sem `dealership_id` não vê clientes/leads (o filtro da API
retorna vazio); `gestor` e `admin` leem a rede inteira.

## Passo 6 — Treinar o modelo

```bash
cd services/ml
pip install -r requirements.txt
python -m src.scripts.train_models 10000
```

## Passo 7 — Rodar tudo

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

## Troubleshooting

**API não sobe: erro de validação em `DATABASE_URL` / `JWT_SECRET`** → o
`.env.local` da raiz está faltando ou incompleto (passo 1). `JWT_SECRET`
precisa ter pelo menos 32 caracteres.

**`ECONNREFUSED 127.0.0.1:5432`** → PostgreSQL não está rodando ou a
`DATABASE_URL` aponta para host/porta errados (passo 0).

**`relation "public.profiles" does not exist`** → migrations não foram
aplicadas (passo 2). Confira com `pnpm db:migrate:status`.

**`pnpm db:migrate` falhou no meio** → a migration com erro não foi registrada;
o log mostra o arquivo e a mensagem do Postgres. Corrija e rode de novo — as
anteriores já registradas são puladas.

**Login responde 401 `invalid credentials`** → e-mail não existe, senha errada
ou o profile está sem `password_hash` (rode `pnpm db:seed:admin` para o admin).
A mensagem é genérica de propósito.

**Web/mobile não conectam** → confira `EXPO_PUBLIC_API_URL` no `.env.local` do
app e se a origem está em `ALLOWED_ORIGINS` na raiz.

**ML service responde 503: "modelo não encontrado"** → rode
`python -m src.scripts.train_models` (passo 6).

**API responde 500 quando chama `/clients`** → o `created_by` precisa de um
`profiles.id` válido e o usuário precisa estar vinculado a uma dealership
(passo 3/5).
