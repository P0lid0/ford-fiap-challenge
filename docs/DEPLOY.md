# Deploy na Vercel (sem Supabase)

Ambiente publicado a partir da branch `feat/sem-supabase-sobre-main` (PR #34):

| Peça | Onde | URL |
|---|---|---|
| Web (Next.js) | projeto Vercel `faro-ai-web` (root `apps/web`) | https://faro-ai-web.vercel.app |
| API (Fastify) | projeto Vercel `faro-ai-api` (root `apps/api`, função `api/index.js`) | https://faro-ai-api.vercel.app |
| Banco | Neon (Vercel Marketplace) `faro-ai-db`, região São Paulo | — |
| Serviço de ML | não publicado — a API usa o classificador de reserva | — |

Funções e banco em São Paulo (`gru1` / `aws-sa-east-1`).

## Como a API roda na Vercel

- `pnpm build` compila `src/` para `dist/`; `apps/api/api/index.js` monta o app com
  `buildApp()` e entrega cada requisição ao servidor interno do Fastify.
- `vercel.json` reescreve todas as rotas para a função.
- O Swagger (`/docs`) fica desligado em produção por decisão do time (`src/app.ts`).
- `lib/db.ts` remove `channel_binding` da URL do Neon e desliga prepared
  statements quando a URL aponta para o pooler (`-pooler`).

## Variáveis (projeto `faro-ai-api`, ambiente production)

`DATABASE_URL` vem da integração do Neon. Definidas à mão: `JWT_SECRET`,
`CLIENT_CPF_PEPPER`, `ML_SERVICE_TOKEN` (valores próprios de produção, nunca os
locais), `TRUST_PROXY=true`, `ALLOWED_ORIGINS` (inclui o domínio do web) e
`LOG_LEVEL`. No `faro-ai-web`: `EXPO_PUBLIC_API_URL=https://faro-ai-api.vercel.app`
(lido no build).

## Publicar de novo

O deploy é feito pela CLI a partir da raiz do monorepo. O `.vercelignore` impede
o envio de `.env.local`, `.venv` e entregáveis.

```bash
# API
VERCEL_ORG_ID=<team id> VERCEL_PROJECT_ID=<id do faro-ai-api> vercel deploy --prod
# Web
VERCEL_ORG_ID=<team id> VERCEL_PROJECT_ID=<id do faro-ai-web> vercel deploy --prod
```

## Banco (migrations e dados demo)

Use a URL **sem pooler** (`DATABASE_URL_UNPOOLED`, obtida com `vercel env pull`
num diretório fora do repositório):

```bash
DATABASE_URL=<unpooled> pnpm db:migrate
DATABASE_URL=<unpooled> pnpm db:seed:admin
DATABASE_URL=<unpooled> pnpm db:seed
DATABASE_URL=<unpooled> ML_SERVICE_URL=http://127.0.0.1:8001 pnpm db:seed:demo
```

Os usuários demo (`admin@`, `gestor@`, `analista@`, `analista2@faroai.com.br`)
usam a senha pública `Ford2026!`. O ambiente é só de demonstração, com dados
sintéticos.
