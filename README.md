# Ford × FIAP Challenge 2026 — Faro AI

> **Equipe Faro AI** · **Scrum Master:** Prof. Yan Coelho
>
> Guilherme (RM 554962) · Pedro (RM 555556) · Fabrício (RM 558216) · Vitor (RM 554893) · Matheus (RM 555447)

Plataforma única para os **dois desafios da Ford**:
- **Desafio 1 — Inteligência Competitiva:** schema canônico de 262 atributos × 14 seções (template oficial Ford), comparação 2-5 veículos lado a lado, busca FIPE + IA com web search.
- **Desafio 2 — VIN Share / Retenção:** classificação de perfis, priorização de leads, ações de retenção e visão 360 do cliente.

---

## 🧩 Sprint 3 — Arquitetura Orientada a Serviços e Web Services

A API REST (`apps/api`) foi evoluída para atender os critérios da Sprint 3:

| Critério | Peso | O que foi entregue | Onde ver |
|---|---|---|---|
| Arquitetura da solução | 20% | Diagramas de componentes, camadas, caminho da requisição e sequências de login e autorização | [`docs/ARQUITETURA_SOA.md`](docs/ARQUITETURA_SOA.md) · imagens em [`docs/arquitetura/`](docs/arquitetura/) |
| Autenticação e autorização | 20% | API segura por padrão (só `/health` e `/auth/login` são públicas) · perfis `analista`, `gestor`, `admin` · escopo por concessionária | `apps/api/src/plugins/auth.ts` · `apps/api/src/lib/data-access.ts` |
| JWT | 15% | Token HS256 **emitido pela própria API** em `POST /auth/login`, validado localmente (assinatura, emissor, audiência, expiração de 1 h) | `apps/api/src/lib/jwt.ts` · `apps/api/src/routes/auth.ts` |
| Maturidade REST nível 2 | 20% | Recursos por URI, verbos HTTP e status codes coerentes (200/201/204/400/401/403/404/409/415/422/429/5xx) | [Arquitetura §5](docs/ARQUITETURA_SOA.md#5-api-rest--maturidade-nível-2) · Swagger |
| Testes automatizados | 15% | 95 testes: sucesso, erro e acesso não autorizado — com relatório JUnit e cobertura | `apps/api/test/` · [`docs/evidencias/TESTES.md`](docs/evidencias/TESTES.md) |
| Documentação e erros | 10% | Swagger com acesso e erros de cada rota · erros no padrão Problem Details (RFC 7807) | `http://localhost:3333/docs` · `apps/api/src/plugins/error-handler.ts` |

### Rodando a API e testando a autenticação

```bash
pnpm install                     # na raiz do repositório
pnpm dev:api                     # API em http://localhost:3333 · Swagger em http://localhost:3333/docs
```

1. No Swagger, abra `POST /auth/login` → **Try it out** → informe as credenciais de um usuário criado no seu projeto Supabase.
2. Copie o `access_token` da resposta e clique em **Authorize** (cadeado no topo).
3. As rotas protegidas passam a responder; sem o token elas devolvem `401`.

Pelo terminal:

```bash
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu-usuario@example.com","password":"sua-senha"}'

curl http://localhost:3333/me -H "Authorization: Bearer <access_token>"
```

### Rodando os testes

Não precisam de Supabase, chaves nem internet — as dependências externas são simuladas.

```bash
pnpm --filter @ford/api test             # 95 testes
pnpm --filter @ford/api test:coverage    # + relatórios em apps/api/test-results/ (junit.xml e coverage/index.html)
```

---

## 📱 Sprint 3 — Mobile Development and IoT

O app mobile (`apps/mobile`) foi finalizado como produto: **versão 1.0.0 em APK**, identidade visual unificada com a web e todos os fluxos do desafio funcionando — inclusive **offline**, no modo demonstração.

| Objetivo | O que foi entregue | Onde ver |
|---|---|---|
| APK publicável com os fluxos sem erros | Expo EAS Build (perfil `preview` → APK), modo demonstração offline, 7 fluxos verificados de ponta a ponta | [`apps/mobile/README.md`](apps/mobile/README.md#-gerar-o-apk) · `apps/mobile/eas.json` |
| Identidade visual consistente | Design system próprio (`components/ui`), tokens compartilhados com a web, fonte Inter, contraste WCAG AA, ícone e splash Faro AI | [Identidade visual](apps/mobile/README.md#-identidade-visual) |
| Código organizado | Camada de dados com interface `DataSource` (API ou local), TypeScript estrito sem erros, telas sem acesso direto à rede | [Arquitetura](apps/mobile/README.md#-arquitetura) |
| Demonstração de todas as telas | 12 prints das 9 telas | [`docs/mobile/screenshots/`](docs/mobile/screenshots/) · [galeria](apps/mobile/README.md#-telas) |

<p>
  <img src="docs/mobile/screenshots/02-carteira.png" width="190" alt="Carteira" />
  <img src="docs/mobile/screenshots/04-leads.png" width="190" alt="Leads" />
  <img src="docs/mobile/screenshots/06-comparar.png" width="190" alt="Comparar" />
  <img src="docs/mobile/screenshots/09-cliente.png" width="190" alt="Detalhe do cliente" />
</p>

**Login de demonstração do APK:** `admin@faroai.com.br` · `Ford2026!` (ou o botão *Entrar com conta demonstração*).

---

## 📦 Entregas técnicas no GitHub (este repositório)

| Disciplina | Entregável | Caminho |
|---|---|---|
| 1. SOA / Web Services | API REST Fastify + Swagger | `apps/api/` |
| 1. SOA / Web Services | Migrations versionadas | `supabase/migrations/` (**19 migrations**) |
| 2. Mobile Development | App React Native + Expo Router | `apps/mobile/` |
| 3. Testing / QA | Frontend web Next.js 15 | `apps/web/` |
| 4. Cybersecurity | Pipeline e controles do Sprint 3 | `docs/SECURITY.md` |
| 5. IA / ML | Serviço FastAPI + XGBoost | `services/ml/` |
| 5. IA / ML | Notebook da sprint anterior | `services/ml/notebooks/ford_segmentation.ipynb` |
| 5. IA / ML | Notebook Sprint 3 — Challenge 2 | `services/ml/notebooks/ford_retention_sprint3.ipynb` |
| 5. IA / ML | Relatório Sprint 3 | `docs/deliverables/Relatorio_Sprint3_IA_ML_Challenge2.md` |
| 5. IA / ML | Treinamento com dados Ford | ETL e trainer locais; requer a planilha autorizada, ausente do repositório |

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
                   │ HTTPS + JWT (emitido pela API)
┌──────────────────▼───────────────────────────────┐
│  apps/api — Node.js + Fastify + TypeScript + Zod │
│  30+ rotas REST · Swagger UI em /docs            │
│  /clients /vehicles /leads /metrics /acoes ...   │
└──────┬───────────────────────┬───────────────────┘
       │                       │
       │              ┌────────▼─────────────────┐
       │              │ services/ml — FastAPI    │
       │              │ XGBoost + scikit-learn   │
       │              │ classifier_base2.joblib  │
       │              └──────────────────────────┘
       │
┌──────▼───────────────────────────────────────────┐
│  Supabase Postgres (managed)                     │
│  19 migrations · RLS por dealership × role       │
│  profiles · dealerships · clients · vehicles     │
│  catalog_items · vehicle_catalog_values          │
│  acoes_retencao · email_logs · audit_log         │
│  predictions · ai_insights · ai_keys             │
└──────────────────────────────────────────────────┘
```

## 📁 Estrutura do monorepo

```
ford-fiap-challenge/
├── apps/
│   ├── api/                     # Fastify + Zod + Swagger + Supabase (30+ rotas)
│   ├── mobile/                  # Expo + Expo Router + SecureStore nativo (9 telas)
│   └── web/                     # Next.js 15 (painel operacional)
├── services/ml/                 # FastAPI + scikit-learn + XGBoost
│   ├── src/                     # classifier, classifier_real, clustering, scrapers, main.py
│   ├── data/                    # gerado localmente: Parquet das bases + JSON canônico D1
│   ├── models/                  # gerado localmente: .joblib + metrics.json + metrics_real.json
│   └── notebooks/               # notebooks de IA das sprints anteriores e Sprint 3
├── packages/
│   ├── types/                   # tipos compartilhados TS
│   └── ui/                      # design tokens Ford (cores, tipografia, spacing)
├── supabase/
│   └── migrations/              # 19 migrations versionadas + RLS + seeds
├── scripts/
│   ├── run-migrations.mjs       # aplica SQL no Postgres
│   ├── apply-migrations-via-api.mjs # alternativa via Management API
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
└── .github/workflows/ci.yml     # typecheck + ML + SAST + SCA + secret scan
```

---

## 🚀 Setup local (10 min)

### 1. Pré-requisitos
- Node ≥ 20 + pnpm ≥ 9 + Python 3.11

### 2. Variáveis de ambiente
```bash
cp .env.example .env.local
```
Preencha `.env.local` com:
- `SUPABASE_URL` — URL do projeto Supabase
- `SUPABASE_ANON_KEY` — anon JWT
- `SUPABASE_SERVICE_ROLE_KEY` — service_role JWT
- `SUPABASE_JWT_SECRET` — (legado) segredo JWT do projeto Supabase
- `JWT_SECRET` — segredo (32+ caracteres) para a API assinar os próprios tokens. **Obrigatório em produção**; em desenvolvimento há um valor padrão
- `SUPABASE_DB_PASSWORD` (opcional) — para `pnpm db:migrate`
- `ANTHROPIC_API_KEY` (opcional) — sem ela os insights caem em fallback rule-based

### 3. Instalar dependências
```bash
pnpm install
```

### 4. Banco de dados — aplicar as 19 migrations
**Opção A — Script automatizado (recomendado):**
```bash
SUPABASE_ACCESS_TOKEN=<seu_PAT> node scripts/apply-migrations-via-api.mjs
```

**Opção B — Manual via SQL Editor:**
1. Supabase Dashboard → SQL Editor → New Query
2. Cole o conteúdo de cada arquivo em `supabase/migrations/` (em ordem)
3. Click em Run

### 5. Gerar o modelo usado pelo serviço ML
```bash
cd services/ml
pip install -r requirements.txt
python -m src.scripts.train_models   # gera classifier_base2.joblib
```

Esse é o artefato carregado por `src.main` na rota `/predict`. Os arquivos em
`services/ml/data/` e `services/ml/models/` são gerados localmente e não são
commitados.

O treinamento com a planilha Ford é uma trilha separada. Ele gera
`classifier_real_v1.joblib`, que a API não carrega. `scripts/etl-d2-real.py`
depende de uma planilha autorizada fora do repositório, pressupõe caminhos de
uma estação Windows e lê XLSX sem que `openpyxl` esteja declarado em
`services/ml/requirements.txt`. Configure os caminhos e instale um engine XLSX
antes de executar `python -m src.scripts.train_real`.

### 6. Rodar tudo (4 terminais)
```bash
# Terminal 1 — ML service
cd services/ml && python -m uvicorn src.main:app --reload --port 8001

# Terminal 2 — API gateway
pnpm dev:api          # http://localhost:3333

# Terminal 3 — Web (painel operacional)
pnpm dev:web          # http://localhost:3000

# Terminal 4 — Mobile (Expo)
pnpm dev:mobile       # QR code para Expo Go (modo API; veja apps/mobile/README.md para o modo demonstração)
```

URLs:
- Web: http://localhost:3000
- API: http://localhost:3333
- Swagger: **http://localhost:3333/docs**
- ML: http://localhost:8001
- ML OpenAPI: http://localhost:8001/docs

### 7. Usuário de demonstração

Crie um usuário no Supabase Auth e atribua o perfil desejado em `profiles`.
Não use credenciais compartilhadas no repositório.

---

## 🧠 ML & IA (Disciplina 5)

O projeto continua no **Challenge 2 — VIN Share e retenção**, o mesmo da sprint anterior. O notebook anterior permanece em [`ford_segmentation.ipynb`](services/ml/notebooks/ford_segmentation.ipynb). A Sprint 3 acrescenta comparação e ajuste de classificadores em [`ford_retention_sprint3.ipynb`](services/ml/notebooks/ford_retention_sprint3.ipynb), com relatório em [`Relatorio_Sprint3_IA_ML_Challenge2.md`](docs/deliverables/Relatorio_Sprint3_IA_ML_Challenge2.md).

O notebook da Sprint 3 usa 10.000 registros gerados por `services/ml/src/synthetic.py`. Como o gerador cria o rótulo e os atributos juntos, os resultados medem a recuperação de rótulos sintéticos; não são métricas de desempenho em clientes Ford. O XGBoost usa CUDA quando detecta uma GPU NVIDIA e um build compatível; K-Means, regressão logística e Random Forest continuam na CPU.

O serviço FastAPI carrega `services/ml/models/classifier_base2.joblib` e chama `src.classifier`. O trainer com dados reais (`scripts/etl-d2-real.py` e `python -m src.scripts.train_real`) é uma trilha separada que depende da planilha autorizada, não versionada aqui. Ele não é o artefato carregado pela rota `/predict`. Além disso, o ETL atual calcula agregados de perfil por concessionária e modelo antes da divisão treino/teste, apesar do comentário dizer leave-one-out; essas métricas não devem ser tratadas como validação sem vazamento até que esse fluxo seja corrigido. O notebook da Sprint 3 não usa esses agregados nem promove seu candidato ao serviço.

---

## Segurança (Sprint 3)

[`docs/SECURITY.md`](docs/SECURITY.md) descreve os quatro grupos do trabalho.
A solução atual não tem dispositivo IoT nem broker MQTT; o documento registra essa ausência.

| Atividade | Estado |
|---|---|
| Pipeline DevSecOps | CI com testes, Semgrep, auditoria de dependências e Gitleaks; achados de dependências ainda abertos |
| Código e infraestrutura | JWT, RBAC, RLS, limites HTTP, HMAC API→ML e proteção de dados implementados; controles de deploy pendentes |
| Monitoramento e resposta | Logs e auditoria implementados; alertas e dashboard pendentes de implantação |
| Compliance contínuo | STRIDE e mapeamento OWASP/LGPD documentados; retenção e backup ainda pendentes |

---

## 📊 Endpoints principais (Disciplina 1)

Swagger UI completo: **http://localhost:3333/docs** — cada rota mostra quem pode acessá-la e os erros possíveis. Arquitetura e fluxos em [`docs/ARQUITETURA_SOA.md`](docs/ARQUITETURA_SOA.md).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Liveness (público) |
| POST | `/auth/login` | Autentica e devolve o JWT da API (público) |
| GET | `/me` | Perfil + role + dealership autenticado (claims do token) |
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

## ✅ Status registrado na sprint anterior

Os números abaixo reproduzem o status documentado na entrega anterior e não foram revalidados neste checkout. A planilha e os Parquets da base Ford não estão incluídos no repositório.

- **18 migrations** versionadas em `supabase/migrations/`
- **175.554 VINs reais Ford BR** reportados como importados na entrega anterior; a base não está disponível neste checkout
- **786 valores canônicos** populados (262 atributos × 3 Ranger 26MY)
- **135.839 leads** detectados via risco composto
- **30+ endpoints REST** documentados em Swagger
- **9 telas mobile** + **11 páginas web**
- **Zero menções legadas** (FordIQ, Genova, 3am IT) removidas

---

**Faro AI · Ford × FIAP Challenge 2026**
*AI que tem faro pro cliente certo.*
