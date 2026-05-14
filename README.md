# Ford × FIAP Challenge 2026 — 3am IT

> **Squad:** 3am IT (parceria Genova × FIAP) · **Entrega:** 24/05/2026 · **Scrum Master:** Prof. Yan Coelho

Plataforma única que resolve os **dois desafios da Ford**:
- **Desafio 1 — Inteligência Competitiva:** lookup padronizado de fichas técnicas com seleção dinâmica de atributos + comparação 2-5 veículos.
- **Desafio 2 — VIN Share / Retenção:** classificador no momento da compra (sem data leakage), leads proativos, KPIs por concessionária + insights gerados por Claude.

## Arquitetura

```
┌──────────────────────────────────────────────┐
│  apps/mobile  — React Native + Expo Router   │
│  Login, Carteira, Leads, Veículos, Insights, │
│  Detalhe do cliente, Cadastro, Comparativo   │
└─────────────────────┬────────────────────────┘
                      │ HTTPS + JWT (Supabase)
┌─────────────────────▼────────────────────────┐
│  apps/api  — Node.js + Fastify (TS, Zod)     │
│  /me /vehicles /lookup /compare /clients     │
│  /predict /insights /metrics  +  /docs       │
└──────┬──────────────────────┬────────────────┘
       │                      │
       │              ┌───────▼─────────────┐
       │              │ services/ml         │
       │              │ FastAPI + sklearn + │
       │              │ XGBoost             │
       │              │ /predict /ingest    │
       │              └─────────────────────┘
       │
┌──────▼──────────────────────────────────────┐
│  Supabase (Postgres + Auth + RLS)           │
│  profiles · dealerships · clients ·         │
│  client_history · predictions · vehicles ·  │
│  ai_insights · audit_log                    │
└─────────────────────────────────────────────┘
```

## Estrutura

```
ford-fiap-challenge/
├── apps/
│   ├── api/                     # Fastify + Zod + Swagger + Supabase + rate limit
│   └── mobile/                  # Expo + Expo Router + Supabase Auth
├── services/ml/                 # FastAPI + scikit-learn + XGBoost + scrapers
│   ├── src/                     # synthetic, clustering, classifier, scrapers, main.py
│   └── notebooks/               # ford_segmentation.ipynb (entrega IA)
├── packages/
│   ├── types/                   # tipos compartilhados TS
│   └── ui/                      # design tokens Ford (cores, tipografia, spacing)
├── supabase/
│   └── migrations/              # schema + RLS + seeds
├── scripts/
│   ├── run-migrations.mjs       # aplica SQL no Postgres (precisa DB password)
│   ├── seed-vehicles.mjs        # popula vehicles com Ranger Raptor + concorrentes
│   ├── test-supabase-connection.mjs
│   └── test-pg-connection.mjs
└── .github/workflows/ci.yml     # lint + typecheck + train smoke + gitleaks
```

## Setup local (10 min)

### 1. Pré-requisitos
- Node ≥ 20 + pnpm ≥ 9 + Python 3.11

### 2. Variáveis de ambiente
```bash
cp .env.example .env.local
```
Preencha `.env.local` com:
- `SUPABASE_URL` — já preenchido com seu projeto
- `SUPABASE_ANON_KEY` — pegar em **Supabase Dashboard → Project Settings → API → anon public**
- `SUPABASE_SERVICE_ROLE_KEY` — já preenchido (service_role JWT)
- `SUPABASE_JWT_SECRET` — em **Settings → API → JWT Settings** (necessário se quiser validar JWT no backend localmente)
- `SUPABASE_DB_PASSWORD` (opcional) — em **Settings → Database → Connection string**. Só se quiser rodar migrations via `pnpm db:migrate`.
- `ANTHROPIC_API_KEY` (opcional) — sem ela os insights caem em fallback regra-baseada

### 3. Banco de dados
**Opção A — Manual (1 minuto, recomendada):**
1. Abra **Supabase Dashboard → SQL Editor → New Query**
2. Cole o conteúdo de `supabase/migrations.combined.sql`
3. Click em **Run**

**Opção B — Script automatizado:**
```bash
pnpm install
pnpm db:migrate   # precisa SUPABASE_DB_PASSWORD ou DATABASE_URL no .env.local
pnpm db:seed
```

### 4. Treinar o modelo ML
```bash
cd services/ml
pip install -r requirements.txt
python -m src.scripts.train_models 10000
```
Saída esperada:
```
silhouette=0.29  accuracy=0.60  f1_macro=0.56
```

### 5. Rodar tudo (3 terminais)
```bash
# Terminal 1 — ML service
cd services/ml && python -m uvicorn src.main:app --reload --port 8001

# Terminal 2 — API gateway
cd apps/api && pnpm dev

# Terminal 3 — App mobile
cd apps/mobile && pnpm start
```

- API: http://localhost:3333 · Swagger: http://localhost:3333/docs
- ML: http://localhost:8001 · OpenAPI: http://localhost:8001/docs
- Mobile: scaneie o QR com Expo Go (ou rode `pnpm android` / `pnpm ios`)

## Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Liveness |
| `GET` | `/me` | Perfil + role + dealership do usuário autenticado |
| `GET` | `/competitive/vehicles` | Lista veículos |
| `GET` | `/competitive/lookup?marca=Ford&modelo=Ranger&versao=Raptor&fields=motor.potencia_cv,...` | **Lookup com seleção dinâmica** (requisito Ford) |
| `POST` | `/competitive/compare` | Comparação 2-5 veículos campo a campo |
| `GET` | `/competitive/fields` | Catálogo de campos comparáveis |
| `POST` | `/clients` | Cadastra cliente + classifica automaticamente |
| `GET` | `/clients` | Lista carteira (filtra por dealership via RLS) |
| `GET` | `/clients/:id` | Detalhe + histórico de predições |
| `GET` | `/clients/leads?risco_min=0.6` | Lista priorizada de leads em risco |
| `GET` | `/metrics/dealership` | KPIs + **VIN Share** estimado |
| `GET` | `/insights/client/:id` | XAI: Claude explica em PT-BR por que o cliente foi classificado |
| `GET` | `/insights/portfolio` | Análise de carteira em PT-BR |

## Segurança (Cybersec — disciplina 4)

- **RLS habilitada** em todas as tabelas com policies escritas explicitamente.
- `SUPABASE_SERVICE_ROLE_KEY` só é usado em `apps/api` — nunca chega no mobile.
- JWT validado em todas as rotas autenticadas (`/me`, `/clients/*`, `/insights/*`).
- Rate limit 120 req/min por usuário (configurável).
- CORS restritivo via `ALLOWED_ORIGINS`.
- Validação Zod em todos os body/querystring.
- Tabela `audit_log` para eventos críticos (criação de cliente, etc.).
- Logs estruturados (pino) com redaction automática de Authorization e API keys.
- CI roda **gitleaks** para barrar push acidental de segredos.
- Tratamento de erro genérico (sem stack trace para o cliente).

## ML & IA (Disciplina 5)

- **Base 1** (com pós-compra) → segmentação K-Means → 4 perfis: fiel · abandono · esquecido · econômico.
- **Base 2** (somente pré-compra) → classificador XGBoost. **Sem data leakage.**
- Métricas atuais (com 10k clientes sintéticos):
  - Clustering: silhouette ≈ 0.29 (4 grupos)
  - Classificador: accuracy ≈ 0.60, F1 macro ≈ 0.56 (vs 0.25 do baseline aleatório)
- **Notebook**: [`services/ml/notebooks/ford_segmentation.ipynb`](services/ml/notebooks/ford_segmentation.ipynb) — entrega oficial da disciplina IA, com EDA, escolha de K (elbow + silhouette), interpretação dos clusters, classificação, feature importance e leitura executiva.

## Diferencial — Claude API

- `/insights/client/:id` usa **Claude Haiku 4.5** para XAI (explica em PT-BR por que o cliente foi classificado).
- `/insights/portfolio` usa **Claude Sonnet 4.6** para análise estratégica da carteira.
- **Cache** por hash do payload (TTL 24h por cliente, 6h por portfolio).
- Sem `ANTHROPIC_API_KEY`, cai em fallback rule-based.

## Sobre o Desafio 1 — ingestão de dados reais

A ideia era usar `carrosnaweb.com.br` como fonte primária. No dia 14/05/2026 o backend deles está retornando 500 em todas as fichas técnicas. Implementação preparada com:

1. **Scraper de carrosnaweb** (`services/ml/src/scrapers/carrosnaweb.py`) — parser por regex sobre o HTML clássico do site.
2. **Fallback LLM** (`services/ml/src/scrapers/llm_extractor.py`) — fetch do site oficial da fabricante + Claude normaliza para o schema canônico.
3. **Cache em Supabase** (`vehicles`) — não re-fetcha o que já foi normalizado.

Veja `DECISIONS.md` para histórico completo.

## Roadmap pós-MVP

- [ ] App mobile: notificações push, modo escuro, biometria, deeplinks
- [ ] Detox/Maestro e2e nos fluxos críticos
- [ ] Survival analysis (tempo até evasão)
- [ ] Uplift modeling (causalml)
- [ ] Reverse ETL pro CRM/DMS da concessionária
- [ ] Observabilidade: OpenTelemetry + Grafana
- [ ] Documentos da disciplina QA: Pitch.pdf, BusinessCanvas.pdf, QuadroDeValor.pdf
- [ ] Arquitetura no Archi (.archimate) com 4 visões TOGAF

---

**3am IT — parceria Genova × FIAP**
