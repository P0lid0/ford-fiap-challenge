# Ford × FIAP Challenge 2026 — Faro AI

> **Equipe Faro AI** · **Entrega:** 24/05/2026 · **Scrum Master:** Prof. Yan Coelho
>
> Guilherme (RM 554962) · Pedro (RM 555556) · Fabrício (RM 558216) · Vitor (RM 554893) · Matheus (RM 555447)

Plataforma única que resolve os **dois desafios da Ford**:
- **Desafio 1 — Inteligência Competitiva:** schema canônico de 262 atributos × 14 seções (template oficial Ford), comparação 2-5 veículos lado a lado, busca FIPE + IA com web search.
- **Desafio 2 — VIN Share / Retenção:** classificador XGBoost treinado em **175.554 VINs reais Ford BR**, leads priorizados via risco composto, ação real via Resend, visão 360 do cliente.

---

## 📦 Entregas técnicas no GitHub (este repositório)

| Disciplina | Entregável | Caminho |
|---|---|---|
| 1. SOA / Web Services | API REST Fastify + Swagger | `apps/api/` |
| 1. SOA / Web Services | Migrations versionadas | `db/migrations/` (**20 migrations**) |
| 2. Mobile & IoT | App React Native + Expo Router | `apps/mobile/` |
| 3. Testing / QA | Frontend web Next.js 15 | `apps/web/` |
| 4. Cybersecurity | Documento de segurança (5 eixos) | `docs/SECURITY.md` |
| 5. IA / ML | Serviço FastAPI + XGBoost | `services/ml/` |
| 5. IA / ML | Notebook Jupyter (EDA + cluster + classif) | `services/ml/notebooks/ford_segmentation.ipynb` |
| 5. IA / ML | Modelo treinado serializado | Gerado localmente em `services/ml/models/classifier_real_v1.joblib` |
| 5. IA / ML | Métricas reais (175k VINs) | Geradas localmente em `services/ml/models/metrics_real.json` |

## 📨 Entregas finais via Teams

| Documento | Caminho local |
|---|---|
| Apresentação 14 slides (PPTX) | `docs/deliverables/Apresentacao_FaroAI.pptx` |
| Roteiro do vídeo de pitch (3 min, 5 falantes) | `docs/deliverables/Pitch_FaroAI.md` |
| Vídeo de pitch gravado | a gravar — inserir link no slide 1 do PPTX |
| Arquitetura TOGAF (.archimate) | `docs/deliverables/FaroAI_Architecture.archimate` |
| Diagrama de arquitetura exportado | `docs/deliverables/FaroAI_Architecture_Diagram.pdf/.png` |
| Business Model Canvas | `docs/deliverables/Business_Canvas.docx` |
| Quadro de Valor | `docs/deliverables/Quadro_de_Valor.docx` |
| Relatório técnico ML (PDF) | `docs/deliverables/Relatorio_Desafio_2_ML.pdf` |
| Checklist completa de entregas | `docs/deliverables/CHECKLIST_ENTREGAS.md` |
| README das entregas | `docs/deliverables/README_Entregaveis.docx` |

---

## 🏗 Arquitetura

```
┌──────────────────────────────────────────────────┐
│  apps/web — Next.js 15 + TypeScript + Tailwind   │
│  Login · Carteira · Leads · Veículos · Clientes  │
│  Ações · Configurações · Ajuda                   │
└──────────────────┬───────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────┐
│  apps/mobile — React Native + Expo Router        │
│  Login · Tabs · Cliente [id] · Compare           │
└──────────────────┬───────────────────────────────┘
                   │ HTTPS + JWT próprio (HS256, emitido pela API)
┌──────────────────▼───────────────────────────────┐
│  apps/api — Node.js + Fastify + TypeScript + Zod │
│  30+ rotas REST · Swagger UI em /docs            │
│  /auth/login /auth/register /me                  │
│  /clients /vehicles /leads /metrics /acoes ...   │
│  Auth: bcrypt + jose · isolamento por dealership │
│  e papel em lib/scope.ts (analista/gestor/admin) │
└──────┬───────────────────────┬───────────────────┘
       │                       │
       │              ┌────────▼─────────────────┐
       │              │ services/ml — FastAPI    │
       │              │ XGBoost + scikit-learn   │
       │              │ classifier_real_v1       │
       │              └──────────────────────────┘
       │
┌──────▼───────────────────────────────────────────┐
│  PostgreSQL padrão (driver `postgres`, porsager) │
│  20 migrations em db/migrations · sem RLS        │
│  profiles (password_hash) · dealerships          │
│  clients · vehicles                              │
│  catalog_items · vehicle_catalog_values          │
│  acoes_retencao · email_logs · audit_log         │
│  predictions · ai_insights · ai_keys             │
└──────────────────────────────────────────────────┘
```

## 📁 Estrutura do monorepo

```
ford-fiap-challenge/
├── apps/
│   ├── api/                     # Fastify + Zod + Swagger + postgres (30+ rotas)
│   ├── mobile/                  # Expo + Expo Router + AsyncStorage (9 telas)
│   └── web/                     # Next.js 15 (painel operacional)
├── services/ml/                 # FastAPI + scikit-learn + XGBoost
│   ├── src/                     # classifier, classifier_real, clustering, scrapers, main.py
│   ├── data/                    # gerado localmente: Parquet das bases + JSON canônico D1
│   ├── models/                  # gerado localmente: .joblib + metrics.json + metrics_real.json
│   └── notebooks/               # ford_segmentation.ipynb (entrega oficial D5)
├── packages/
│   ├── types/                   # tipos compartilhados TS
│   └── ui/                      # design tokens Ford (cores, tipografia, spacing)
├── db/
│   └── migrations/              # 20 migrations versionadas (schema + seeds)
├── scripts/
│   ├── lib/env.mjs              # lê DATABASE_URL do ambiente ou de .env.local
│   ├── db-migrate.mjs           # aplica db/migrations/ (schema_migrations, --status)
│   ├── db-seed-admin.mjs        # cria/atualiza o admin de demo (bcrypt)
│   ├── seed-vehicles.mjs        # popula vehicles
│   ├── import-ford-real-clients.mjs # importa 175k VINs Ford BR
│   ├── populate-catalog-canonico.mjs # popula schema 262 atributos
│   ├── reset-catalog-ranger-only.mjs # mantém só as 3 Ranger 26MY
│   ├── generate-deliverables.py # gera PDFs/DOCX dos entregáveis
│   └── build-presentation-pptx.mjs # gera Apresentacao_FaroAI.pptx
├── docs/
│   ├── SECURITY.md              # política de segurança (entrega D4)
│   ├── SETUP.md
│   └── deliverables/            # PPTX, PDFs, DOCX, .archimate
└── .github/workflows/ci.yml     # typecheck + migrations em Postgres + train smoke + gitleaks
```

---

## 🚀 Setup local (10 min)

### 1. Pré-requisitos
- Node ≥ 20 + pnpm ≥ 9 + Python 3.11
- **PostgreSQL ≥ 13** rodando (local ou container) com um banco criado, ex.:
  `createdb faroai` — ou `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=faroai postgres:16`.
  A migration 001 habilita `pgcrypto`; `gen_random_uuid()` é nativo.

### 2. Instalar dependências
```bash
pnpm install
```

### 3. Variáveis de ambiente
```bash
cp .env.example .env.local
```
Preencha `.env.local` (raiz do monorepo — a API e os scripts leem daí):
- `DATABASE_URL` — ex.: `postgres://postgres:postgres@127.0.0.1:5432/faroai`
- `JWT_SECRET` — mínimo 32 chars; gere com
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `JWT_EXPIRES_IN` (opcional, default `12h`)
- `ANTHROPIC_API_KEY` (opcional) — sem ela os insights caem em fallback rule-based

Para o web/mobile, `apps/web/.env.local` e `apps/mobile/.env.local` só precisam de
`EXPO_PUBLIC_API_URL=http://localhost:3333` (o `next.config.js` expõe esse valor como `NEXT_PUBLIC_API_URL`).

### 4. Banco de dados — migrations + seeds
```bash
pnpm db:migrate          # aplica as 20 migrations de db/migrations/ (idempotente)
pnpm db:migrate:status   # lista aplicadas/pendentes sem alterar nada
pnpm db:seed:admin       # cria/atualiza admin@faroai.com.br / Ford2026! (role admin)
pnpm db:seed             # popula vehicles (Ranger Raptor + concorrentes)
```

`scripts/db-migrate.mjs` registra cada arquivo em `public.schema_migrations`
e roda cada um numa transação própria: se uma falhar, nada dela fica aplicado
e basta corrigir e rodar de novo. O admin pode ser customizado com
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` e `ADMIN_DEALERSHIP_CODIGO`
(default `FD001`, criada pela migration 003).

### 5. Treinar o modelo ML
```bash
cd services/ml
pip install -r requirements.txt
python ../../scripts/etl-d2-real.py  # gera Parquets reais a partir do XLSX Ford
python -m src.scripts.train_real     # gera classifier_real_v1 + metrics_real.json
```

Os artefatos em `services/ml/data/` e `services/ml/models/` são gerados
localmente pelos scripts de ETL/treino e não são commitados por tamanho e
governança de dados.

### 6. Rodar tudo (4 terminais)
```bash
# Terminal 1 — ML service
cd services/ml && python -m uvicorn src.main:app --reload --port 8001

# Terminal 2 — API gateway
pnpm dev:api          # http://localhost:3333

# Terminal 3 — Web (painel operacional)
pnpm --filter @ford/web dev   # http://localhost:3000

# Terminal 4 — Mobile (Expo)
pnpm dev:mobile       # QR code para Expo Go
```

URLs:
- Web: http://localhost:3000
- API: http://localhost:3333
- Swagger: **http://localhost:3333/docs**
- ML: http://localhost:8001
- ML OpenAPI: http://localhost:8001/docs

### 7. Login demo
```
email: admin@faroai.com.br
senha: Ford2026!
role:  admin
```
Criado pelo `pnpm db:seed:admin`. O login (`POST /auth/login`) devolve um JWT
HS256 que web e mobile mandam em `Authorization: Bearer`; `POST /auth/register`
cria usuários com role `analista`.

---

## 🧠 ML & IA (Disciplina 5)

- **Pipeline em 2 etapas**:
  1. Segmentação não-supervisionada na Base 1 (histórico completo) → K-Means K=4 validado por elbow + silhouette → 4 perfis: **fiel** · **abandono** · **esquecido** · **econômico**
  2. Classificação supervisionada na Base 2 (apenas dados pré-compra) → XGBoost → **zero data leakage**

- **Modelo técnico do MVP (`xgb-real-v1`)** — treinado em **175.554 VINs reais Ford BR** (`vin_share_Desafio_02.xlsx`):
  - accuracy = **62,7%**
  - F1 weighted = **0,60**
  - F1 macro = **0,48**
  - 140.443 amostras treino · 35.111 amostras teste

- **Bases sintéticas** (`services/ml/src/synthetic.py`) — usadas só durante desenvolvimento inicial pra validar o pipeline. Métricas sintéticas (≈ 60% acc) ficam como baseline histórico.

- **Artefatos de treino**: `services/ml/data/*.parquet`, `services/ml/models/classifier_real_v1.joblib` e `services/ml/models/metrics_real.json` são gerados localmente por `scripts/etl-d2-real.py` e `python -m src.scripts.train_real`; não são commitados por tamanho e governança de dados.

- **Notebook oficial**: [`services/ml/notebooks/ford_segmentation.ipynb`](services/ml/notebooks/ford_segmentation.ipynb)

---

## 🛡 Segurança (Disciplina 4 — 5 eixos)

Documento completo em **[`docs/SECURITY.md`](docs/SECURITY.md)**. Cobre os 5 eixos:

| Eixo | Pontos | Status |
|---|---|---|
| 1. Validação & Sanitização | 20 | ✅ Zod em todas rotas · SQL parametrizado (tagged template) · rate-limit · multipart 30MB |
| 2. Autenticação & RBAC | 20 | ✅ JWT HS256 próprio + bcrypt · 3 roles · isolamento por dealership na API |
| 3. Proteção de APIs | 20 | ✅ TLS via reverse proxy (deploy) · CORS allowlist · HMAC payloads · helmet |
| 4. Dados & Privacidade | 25 | ✅ VIN_Hash · pseudonimização no ML · isolamento por dealership · LGPD-ready |
| 5. Monitoramento & Auditoria | 15 | ✅ audit_log estruturado · email_logs · sem stack trace |

---

## 📊 Endpoints principais (Disciplina 1)

Swagger UI completo: **http://localhost:3333/docs**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/auth/login` | E-mail + senha → JWT + usuário |
| POST | `/auth/register` | Cria usuário (role `analista`) e devolve a sessão |
| GET | `/me` | Perfil + role + dealership autenticado |
| GET | `/competitive/vehicles` | Lista veículos |
| GET | `/competitive/lookup?marca=&modelo=&fields=…` | Lookup com seleção dinâmica de campos |
| POST | `/competitive/compare` | Comparação 2-5 veículos |
| GET | `/competitive/catalog-items` | Schema canônico Ford D1 (262 atributos) |
| POST | `/competitive/compare/canonico` | Comparação na tabela canônica |
| POST | `/competitive/vehicles/:id/refresh-price` | Atualiza preço FIPE |
| POST | `/competitive/vehicles/:id/catalog-values/auto-fill` | IA preenche 262 atributos |
| POST | `/clients` | Cadastra cliente + classifica |
| GET | `/clients/leads?risco_min=&perfil=&sinal=…` | Leads priorizados (perfil + 6 sinais) |
| GET | `/clients/leads/stats` | KPIs agregados de leads |
| GET | `/metrics/dealership` | KPIs por dealer + VIN Share |
| GET | `/metrics/proximas-revisoes` | Próximas revisões estimadas |
| GET | `/metrics/garantia-status` | Veículos com garantia vencendo |
| GET | `/metrics/anomalias-dealer` | Dealers fora da curva (z-score) |
| POST | `/acoes/email-send` | **Envia e-mail real via Resend** |
| GET | `/insights/client/:id` | XAI por cliente |
| GET | `/insights/portfolio` | Briefing executivo da carteira |

---

## ✅ Status final

- **20 migrations** versionadas em `db/migrations/` (PostgreSQL padrão, sem Supabase — ver `DECISIONS.md`)
- **Auth própria**: JWT HS256 + bcrypt, isolamento por dealership/papel na API (`apps/api/src/lib/scope.ts`)
- **175.554 VINs reais Ford BR** importados na base
- **786 valores canônicos** populados (262 atributos × 3 Ranger 26MY)
- **135.839 leads** detectados via risco composto
- **30+ endpoints REST** documentados em Swagger
- **9 telas mobile** + **11 páginas web**
- **Zero menções legadas** (FordIQ, Genova, 3am IT) removidas

---

**Faro AI · Ford × FIAP Challenge 2026**
*AI que tem faro pro cliente certo.*
