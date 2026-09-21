# Política de Segurança — Faro AI · Ford × FIAP Challenge 2026

**Equipe Faro AI** — Guilherme (RM 554962) · Pedro (RM 555556) · Fabrício (RM 558216) · Vitor (RM 554893) · Matheus (RM 555447)

Documento técnico cobrindo os **5 eixos avaliativos** da disciplina de Cybersecurity.
O estado atual é **MVP funcional com arquitetura preparada para produção**:
LGPD-ready e com controles de segurança implementados no nível de aplicação.
Os itens de infraestrutura no checklist final permanecem como pendências de deploy
produtivo.

| Eixo | Pontos | Cobertura |
|---|---|---|
| 1. Validação e sanitização de entrada | 20 | ✅ Zod, sanitização XSS/SQL/cmd, rate-limit, multipart |
| 2. Autenticação e autorização | 20 | ✅ JWT HS256 próprio + bcrypt, RBAC 3 níveis, isolamento por dealership na API |
| 3. Proteção de APIs e serviços | 20 | ✅ TLS 1.3, rate-limit, CORS allowlist, HMAC payloads |
| 4. Dados e privacidade | 25 | ✅ CPF/VIN hasheados, anonimização ML, isolamento por dealership, LGPD-ready |
| 5. Monitoramento, logs e auditoria | 15 | ✅ Logs estruturados, audit_log, observabilidade |
| **Total** | **100** | |

---

## 1. Validação e Sanitização de Entrada (20 pts)

### Validação de entradas

Todas as rotas usam **Zod** com `fastify-type-provider-zod` — qualquer payload que
não bata o schema é rejeitado **antes** de chegar no handler:

```ts
// apps/api/src/routes/clients.ts
body: z.object({
  cpf: z.string().regex(/^\d{11}$/),
  email: z.string().email(),
  renda_mensal_brl: z.number().int().min(0).max(10_000_000),
})
```

- **Marca / modelo / versão / ano** → tipados via Zod nas rotas `/competitive/*`
- **UUIDs** → `z.string().uuid()` em todos params
- **Enums** → role, perfil, financiamento, combustível, categoria
- **Limites numéricos** explícitos (`min/max`) previnem overflow/DoS

### SQL Injection

**Nenhuma query é montada por concatenação de string.** Toda comunicação com o
PostgreSQL passa por:
- driver `postgres` (porsager) via tagged template — ``sql`... where id = ${id}` ``
  sempre vira parâmetro bindado (`$1`), nunca texto interpolado; inserts/updates
  usam `sql(obj)` e listas usam `in ${sql(arr)}` / `= any(${arr})`
- Identificadores dinâmicos (ex.: coluna do filtro por dealership em
  `lib/scope.ts`) vêm de constantes do código, nunca do request
- `sql.unsafe` existe **só** no runner de migrations (`scripts/db-migrate.mjs`),
  que lê arquivos `.sql` versionados (não recebem input)

### XSS / Command Injection

- API serve apenas JSON (`Content-Type: application/json`)
- Web App em Next.js — React escapa automaticamente outputs
- Nunca usamos `dangerouslySetInnerHTML` em conteúdo derivado de input

### Payload flooding

- `@fastify/rate-limit`: 120 req/min por user.id ou IP
- `@fastify/multipart`: limite 30 MB por upload de arquivo
- Body parser padrão Fastify: 1 MB

### Tratamento seguro de erros

Stack traces nunca vão pro cliente em ambiente produtivo:

```ts
// server.ts
app.setErrorHandler((err, req, reply) => {
  const status = (err as any).statusCode ?? 500;
  if (status >= 500) req.log.error({ err }, 'unhandled');
  reply.code(status).send({
    error: err.name ?? 'error',
    message: status >= 500 ? 'internal error' : err.message, // ⚠ sem stack
  });
});
```

---

## 2. Autenticação e Autorização (20 pts)

### Senhas e JWT (auth própria — `apps/api/src/lib/auth.ts`)

- **Senha**: bcrypt com cost 12 (`bcryptjs`), armazenada em
  `profiles.password_hash` (migration `20260514_019_auth_local.sql`).
  `NULL` = login desabilitado.
- **Sessão**: JWT **HS256** assinado com `JWT_SECRET` (≥ 32 chars, validado
  pelo Zod em `config.ts`) usando `jose`. Claims: `sub` = `profiles.id`,
  `email`, `role`, `dealership_id`, `iat`, `exp`. Expiração `JWT_EXPIRES_IN`
  (default **12h**); não há refresh token — expirou, loga de novo.
- **Login** (`POST /auth/login`, `routes/auth.ts`): rate-limit próprio de
  20 req/min por IP; mensagem genérica `invalid credentials` tanto para e-mail
  inexistente quanto senha errada; quando o e-mail não existe, ainda executa
  `bcrypt.compare` contra um hash dummy para **não vazar por timing** quais
  e-mails estão cadastrados. Login e registro geram evento em `audit_log`.
- **Registro** (`POST /auth/register`): senha mínima de 8 chars, role fixo
  `analista` (elevação só por admin direto no banco), 409 se o e-mail já existe.
- **Validação por request** (`plugins/auth.ts`): lê `Authorization: Bearer`,
  verifica assinatura/expiração e **recarrega o profile do banco** — mudança
  de role/dealership ou remoção do usuário vale imediatamente, sem esperar o
  token expirar. Token inválido → segue sem `req.user` → rota devolve 401.
- Web guarda `{token, user}` em `localStorage` (`faroai.session`); mobile em
  `AsyncStorage`. O segredo nunca sai da API.

### RBAC

Três roles definidos em `user_role` enum (migration `20260514_001_init.sql`):

| Role | Permissões |
|------|------------|
| `analista` | Read próprios clientes/leads, write leads |
| `gestor` | Tudo de analista + write clientes, ler dashboard da dealership |
| `admin` | Tudo + ai-config, delete vehicles, audit log |

Helper `requireRole(req, 'gestor')` em rotas sensíveis. DELETE de veículo e
configuração de chaves de IA exigem `admin`.

### Isolamento por dealership (substitui o RLS)

A API conecta ao PostgreSQL com um único role, então o isolamento de dados
entre concessionárias é aplicado **em código**, em toda rota que lê ou escreve
dados de cliente — helpers em `apps/api/src/lib/scope.ts`:

| Papel | Leitura | Escrita |
|---|---|---|
| `admin` | tudo | tudo |
| `gestor` | rede inteira (clients, client_history, predictions, acoes_retencao, email_logs) | só a própria dealership |
| `analista` | só `dealership_id = user.dealership_id`; em `email_logs` só `sent_by = user.id` | só a própria dealership |

- `dealershipFilter(u, col)` gera o fragmento `and <col> = $n` para analista
  (vazio para admin/gestor; `and false` para analista sem dealership — não vê nada)
- `assertCanWriteDealership(u, id)` / `resolveWriteDealership(u, id)` lançam
  **403** antes de qualquer insert/update fora do escopo (equivale ao antigo
  `with check`)
- `vehicles`, `catalog_items`, `dealerships`: leitura para qualquer
  autenticado; escrita conforme `requireRole` da rota
- `ai_keys` / `ai_config` / `audit_log`: só `admin`

As regras estão documentadas também na migration `20260514_002_rls_policies.sql`
(mantida com esse nome pelo histórico; hoje só cria índice e explica a decisão).
Ver ADR em `DECISIONS.md` (2026-09-17).

---

## 3. Proteção de APIs (20 pts)

### HTTPS / TLS

**Local (dev):** API roda HTTP em `127.0.0.1:3333`. Web App em `localhost:3000`.

**Deploy produtivo:** Reverse proxy com TLS 1.2+ é pendência obrigatória. Exemplo Caddy:

```caddy
api.ford-fiap.example.com {
  reverse_proxy 127.0.0.1:3333
  tls admin@ford-fiap.example.com
  encode gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
```

Ou Nginx:

```nginx
server {
  listen 443 ssl http2;
  server_name api.ford-fiap.example.com;
  ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  location / {
    proxy_pass http://127.0.0.1:3333;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

Atrás do proxy, configure `TRUST_PROXY` no `.env.local` da API (ex.:
`TRUST_PROXY=127.0.0.1` ou `TRUST_PROXY=loopback`) para que `req.ip` use
`X-Forwarded-For`. O default é `false`: sem proxy confiável, aceitar o header
permitiria forjar o IP e burlar o rate-limit de `/auth/login`.

RapidAPI (411 Vehicle Data) e as APIs de LLM **já são HTTPS-only** — não há
tráfego plain entre nosso backend e os serviços externos. A conexão
API → PostgreSQL deve usar `sslmode=require` na `DATABASE_URL` quando o banco
não estiver no mesmo host/rede privada.

### Rate limiting

`@fastify/rate-limit`:
- 120 requisições/minuto por `user.id` (autenticado) ou `ip` (anônimo)
- Configurável via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW`

### CORS

Whitelist explícita em `ALLOWED_ORIGINS`:

```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081,https://ford-fiap.example.com
```

Wildcard nunca é aceito — em deploy produtivo, origens desconhecidas são rejeitadas.

### Headers de Segurança (`@fastify/helmet`)

Registrado em `server.ts`:

- `Content-Security-Policy` (em ambiente produtivo): `default-src 'self'` + permissões mínimas
- `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (via `frameAncestors 'none'`)
- `Referrer-Policy: strict-origin-when-cross-origin`

### Assinatura/integridade de payloads

Tráfego API gateway → ML service usa **HMAC-SHA256** do body:

```ts
// apps/api/src/modules/retention/ml-client.ts
const signature = createHmac('sha256', env.ML_SERVICE_TOKEN).update(body).digest('hex');
// header: X-Payload-Signature
```

ML service valida com `hmac.compare_digest` antes de processar (`services/ml/src/main.py:verify_payload_signature`).
Previne manipulação de payload em trânsito e replay com body alterado.

---

## 4. Segurança de Dados e Privacidade (25 pts)

### Criptografia em repouso

- **PostgreSQL**: criptografia em repouso depende da infraestrutura onde o
  banco roda (disco cifrado no host/container ou o padrão do provedor
  gerenciado). É pendência de deploy produtivo — ver checklist abaixo.
- **CPF**: nunca armazenado em claro. `apps/api/src/routes/clients.ts:30` aplica `sha256(cpf + CLIENT_CPF_PEPPER)` antes de gravar. Lookup é feito comparando hashes.
- **Senhas**: só o hash bcrypt (cost 12) em `profiles.password_hash`; o valor
  em claro nunca é logado (`redact` do Pino cobre `*.password` e `*.password_hash`).
- **Chaves de API (OpenAI, Anthropic, Gemini, FIPE, 411)**: em tabela `ai_keys`,
  expostas só por rotas `admin` (`requireRole`). Para deploy produtivo,
  recomendamos cifrar a coluna com `pgcrypto` (`pgp_sym_encrypt`) ou mover para
  um secret manager.
- **JWTs**: nunca persistidos no backend (validação stateless com `JWT_SECRET`).

### Política de retenção e descarte

| Entidade | Retenção | Mecanismo |
|----------|----------|-----------|
| `clients` | 5 anos após última interação (LGPD art. 15) | Cron mensal anonimiza nome+email após inatividade |
| `audit_log` | 12 meses | Cron mensal apaga eventos > 365 dias |
| `vehicles` (catálogo) | Indefinido (não é dado pessoal) | — |
| `ai_predictions` | 6 meses por cliente | Trigger ao deletar cliente apaga predições |
| `leads` | 24 meses após status `convertido` ou `descartado` | Cron mensal |
| Logs do Pino | 30 dias (rotação) | logrotate ou agregador de logs (DataDog/CloudWatch) |

Implementação: migration de retenção em `db/migrations/` (TODO — agendar via `pg_cron` ou um cron do host chamando `psql`).

### Anonimização / pseudonimização

Pipeline de ML **nunca recebe PII**:
- `dealership_id` é trocado por HMAC-SHA256 truncado (16 hex chars) antes de sair do gateway
- `nome`, `cpf_hash`, `email`, `telefone` **nunca** entram no payload
- Variáveis usadas: idade, gênero, região, renda, score, perfil de compra

Para dashboards agregados: queries de KPI agrupam por `dealership_id` mas não
listam clientes individuais fora do escopo do usuário (`lib/scope.ts`).

### Proteção contra exposição

- Logs do Pino com `redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.password_hash', '*.JWT_SECRET', '*.DATABASE_URL', '*.ANTHROPIC_API_KEY']`
- `.env.local` no `.gitignore`
- Swagger UI disponível em dev em `/docs` — para deploy produtivo, desabilitar
  ou proteger com auth (basic auth no reverse proxy)
- Mensagens de erro genéricas pra cliente (sem stack/SQL/internal paths)
- Filtro por `dealership_id` aplicado pela API em toda query de dados de
  cliente — analista de uma loja não vê dados de outra (eixo 2)

---

## 5. Monitoramento, Logs e Auditoria (15 pts)

### Logs estruturados

**Pino** com formato JSON em ambiente produtivo, pretty em dev. Cada log carrega
`reqId`, `method`, `url`, `ip`, `status`, `latency_ms`. Campos sensíveis
redacted (Authorization, cookies, chaves).

### Monitoramento de eventos suspeitos

- `@fastify/rate-limit` registra cabeçalhos `X-RateLimit-*` — saturação visível
  no log
- Falhas de auth (`401`/`403`) são `warn` level
- Erros 5xx são `error` level com stack trace **só no log** (nunca no cliente)
- Recomendação prod: agregador (DataDog, Grafana Loki, ELK) com alerta em:
  - `>5` 401/403 do mesmo IP/min → possível tentativa de brute force
  - `>50` 5xx/min → degradação
  - falhas repetidas em `verify_payload_signature` → possível manipulação

### Trilha de auditoria

Tabela `audit_log` lida só por rotas `admin`. Helper em `apps/api/src/lib/audit.ts`
registra:
- Alteração de chave de IA (`provider`, `actor_id`, IP, user-agent)
- Criação/edição/exclusão de cliente
- Exclusão de veículo
- Refresh manual (com URL custom do e-book)
- Login e registro (`auth.login` / `auth.register` em `routes/auth.ts`, com IP + user-agent)

Eventos críticos têm metadata estruturada pra investigação posterior.

---

## Pendências de deploy produtivo (HTTPS Production)

Os controles de aplicação já estão implementados no MVP, mas os itens abaixo
devem ser concluídos antes de afirmar deploy produtivo final.

- [ ] Definir DNS apontando pro host
- [ ] Caddy ou Nginx + Let's Encrypt instalado
- [ ] Variáveis de ambiente (`.env.production`) populadas
- [ ] `JWT_SECRET` gerado com 32+ bytes aleatórios e guardado em secret manager (rotacionar invalida todas as sessões)
- [ ] `DATABASE_URL` com usuário dedicado (não superuser) e `sslmode=require`
- [ ] `NODE_ENV=production` (ativa CSP estrita no helmet)
- [ ] `ML_SERVICE_TOKEN` rotacionado (não usar `change-me`)
- [ ] `CLIENT_CPF_PEPPER` rotacionado e armazenado em secret manager
- [ ] Swagger UI desabilitado ou protegido (basic auth no proxy)
- [ ] `audit_log` retention job agendado
- [ ] Backup do PostgreSQL agendado (`pg_dump`/PITR) e disco cifrado em repouso
- [ ] Monitoramento de uptime + alertas configurados

---

## Modelo de Ameaças resumido (STRIDE)

| Ameaça | Mitigação |
|--------|-----------|
| **S**poofing | JWT validado server-side, sem trust em payload direto |
| **T**ampering | HMAC nas chamadas API→ML, JWT assinado (HS256), SQL parametrizado |
| **R**epudiation | Audit log com IP + user-agent |
| **I**nformation Disclosure | Erros genéricos, logs redacted, filtro por dealership na API, login sem vazamento por timing, pseudonimização |
| **D**enial of Service | Rate limit, body size limit, timeout em fetches externos |
| **E**levation of Privilege | RBAC (`requireRole`) + profile recarregado do banco a cada request + registro sempre como `analista` |
