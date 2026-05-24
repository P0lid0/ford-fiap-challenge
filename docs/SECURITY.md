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
| 2. Autenticação e autorização | 20 | ✅ JWT Supabase, RBAC 3 níveis, RLS Postgres |
| 3. Proteção de APIs e serviços | 20 | ✅ TLS 1.3, rate-limit, CORS allowlist, HMAC payloads |
| 4. Dados e privacidade | 25 | ✅ AES-256 at rest, VIN_Hash, anonimização ML, LGPD-ready |
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

**Não usamos SQL raw.** Toda comunicação com Postgres passa por:
- `@supabase/supabase-js` (PostgREST com parâmetros bindados)
- Migrations em arquivos `.sql` versionados (não recebem input)

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

### JWT

- Auth via **Supabase Auth** (JWT assinado HS256)
- Validação no plugin `apps/api/src/plugins/auth.ts`:
  - Token validado contra `/auth/v1/user` (não confiamos no payload sem revalidar)
  - Expiração padrão Supabase: 1 hora (refresh token separado)

### RBAC

Três roles definidos em `user_role` enum (migration `20260514_001_init.sql`):

| Role | Permissões |
|------|------------|
| `analista` | Read próprios clientes/leads, write leads |
| `gestor` | Tudo de analista + write clientes, ler dashboard da dealership |
| `admin` | Tudo + ai-config, delete vehicles, audit log |

Helper `requireRole(req, 'gestor')` em rotas sensíveis. DELETE de veículo e
configuração de chaves de IA exigem `admin`.

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

A API já tem `trustProxy: true` em `server.ts`, então respeita `X-Forwarded-*`.

Supabase e RapidAPI (411 Vehicle Data) **já são HTTPS-only** — não há tráfego
plain entre nosso backend e os serviços externos.

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

- **Supabase Postgres**: AES-256 em repouso (gerenciado pela plataforma — disk encryption + WAL encryption)
- **CPF**: nunca armazenado em claro. `apps/api/src/routes/clients.ts:30` aplica `sha256(cpf + CLIENT_CPF_PEPPER)` antes de gravar. Lookup é feito comparando hashes.
- **Chaves de API (OpenAI, Anthropic, Gemini, FIPE, 411)**: em tabela `ai_keys` com RLS admin-only. Para deploy produtivo, recomendamos migrar pra **Supabase Vault** (criptografia de coluna).
- **JWTs**: nunca persistidos no backend (validação stateless).

### Política de retenção e descarte

| Entidade | Retenção | Mecanismo |
|----------|----------|-----------|
| `clients` | 5 anos após última interação (LGPD art. 15) | Cron mensal anonimiza nome+email após inatividade |
| `audit_log` | 12 meses | Cron mensal apaga eventos > 365 dias |
| `vehicles` (catálogo) | Indefinido (não é dado pessoal) | — |
| `ai_predictions` | 6 meses por cliente | Trigger ao deletar cliente apaga predições |
| `leads` | 24 meses após status `convertido` ou `descartado` | Cron mensal |
| Logs do Pino | 30 dias (rotação) | logrotate ou agregador de logs (DataDog/CloudWatch) |

Implementação: arquivo `supabase/migrations/20260514_009_retention_jobs.sql` (TODO — agendar via Supabase Cron extension).

### Anonimização / pseudonimização

Pipeline de ML **nunca recebe PII**:
- `dealership_id` é trocado por HMAC-SHA256 truncado (16 hex chars) antes de sair do gateway
- `nome`, `cpf_hash`, `email`, `telefone` **nunca** entram no payload
- Variáveis usadas: idade, gênero, região, renda, score, perfil de compra

Para dashboards agregados: queries de KPI agrupam por `dealership_id` mas não
listam clientes individuais sem permissão explícita (RLS).

### Proteção contra exposição

- Logs do Pino com `redact: ['req.headers.authorization', 'req.headers.cookie', '*.SUPABASE_SERVICE_ROLE_KEY', '*.ANTHROPIC_API_KEY']`
- `.env.local` no `.gitignore`
- Swagger UI disponível em dev em `/docs` — para deploy produtivo, desabilitar
  ou proteger com auth (basic auth no reverse proxy)
- Mensagens de erro genéricas pra cliente (sem stack/SQL/internal paths)
- RLS no Supabase isola dados por `dealership_id` — analista de uma loja não
  vê dados de outra

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

Tabela `audit_log` com RLS admin-only. Helper em `apps/api/src/lib/audit.ts`
registra:
- Alteração de chave de IA (`provider`, `actor_id`, IP, user-agent)
- Criação/edição/exclusão de cliente
- Exclusão de veículo
- Refresh manual (com URL custom do e-book)
- Login/logout (via Supabase Auth → `auth.audit_log_entries`)

Eventos críticos têm metadata estruturada pra investigação posterior.

---

## Pendências de deploy produtivo (HTTPS Production)

Os controles de aplicação já estão implementados no MVP, mas os itens abaixo
devem ser concluídos antes de afirmar deploy produtivo final.

- [ ] Definir DNS apontando pro host
- [ ] Caddy ou Nginx + Let's Encrypt instalado
- [ ] Variáveis de ambiente (`.env.production`) populadas
- [ ] `NODE_ENV=production` (ativa CSP estrita no helmet)
- [ ] `ML_SERVICE_TOKEN` rotacionado (não usar `change-me`)
- [ ] `CLIENT_CPF_PEPPER` rotacionado e armazenado em secret manager
- [ ] Swagger UI desabilitado ou protegido (basic auth no proxy)
- [ ] `audit_log` retention job agendado
- [ ] Backup automático Supabase ativo (PITR)
- [ ] Monitoramento de uptime + alertas configurados

---

## Modelo de Ameaças resumido (STRIDE)

| Ameaça | Mitigação |
|--------|-----------|
| **S**poofing | JWT validado server-side, sem trust em payload direto |
| **T**ampering | HMAC nas chamadas API→ML, RLS no DB |
| **R**epudiation | Audit log com IP + user-agent |
| **I**nformation Disclosure | Erros genéricos, logs redacted, RLS, pseudonimização |
| **D**enial of Service | Rate limit, body size limit, timeout em fetches externos |
| **E**levation of Privilege | RBAC + RLS Postgres (defense in depth) |
