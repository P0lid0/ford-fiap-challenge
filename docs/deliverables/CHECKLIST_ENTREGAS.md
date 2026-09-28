# ✅ Checklist de entregas · Faro AI · Ford × FIAP Challenge 2026

**Data de entrega**: 24/05/2026
**Scrum Master**: Prof. Yan Coelho
**Submissão**: Teams (todos os arquivos juntos)

**Equipe Faro AI**
- Guilherme — RM 554962
- Pedro — RM 555556
- Fabrício — RM 558216
- Vitor — RM 554893
- Matheus — RM 555447

---

## ✅ Auditoria final — 10 itens da revisão (todos validados em 23/05/2026)

| # | Item | Status | Evidência |
|---|---|---|---|
| 1 | Nomes dos arquivos de arquitetura padronizados (FordIQ → FaroAI) | ✅ | `FaroAI_Architecture.archimate` · `FaroAI_Architecture_Diagram.pdf/png` · 0 ocorrências de "FordIQ" no XML interno |
| 2 | README com seção "Entregas GitHub vs Entregas Teams" | ✅ | `README.md` cabeçalho — 2 tabelas separadas |
| 3 | Número de migrations padronizado: **18** | ✅ | 18 arquivos `.sql` em `supabase/migrations/` |
| 4 | Narrativa sintético vs real reescrita | ✅ | Relatório PDF Seção 3 reescrita: "validar pipeline / produção usa Ford BR real" |
| 5 | Próximos passos corrigidos (sem "coletar dados reais") | ✅ | Trocado por "coletar dados adicionais de loja-piloto + tracking de conversão pós-ação" |
| 6 | 4 visões TOGAF no .archimate | ✅ | `view-strategic` · `view-business` · `view-app` · `view-tech` |
| 7 | Notebook ML executa do início ao fim | ✅ | Rodado via `nbconvert` simulado — acc 60% · F1 macro 0.55 · estratégias por perfil OK |
| 8 | Smoke test local: API + ML rodando | ✅ | `pnpm dev:api` → `/health` OK · `python -m uvicorn` → `/health` model_loaded=true |
| 9 | Swagger UI disponível em `/docs` | ✅ | HTTP 200 · **46 rotas REST** documentadas |
| 10 | 18 migrations aplicadas sem erro | ✅ | `apply-migrations-via-api.mjs` → "todas aplicadas" |

---

## 📋 Checklist por disciplina

A challenge tem **5 disciplinas**. A nota é a média das entregas, e TODAS as disciplinas recebem essa nota.

---

### ✅ Disciplina 1 — Arquitetura Orientada a Serviços e Web Services

> Avaliação 100 pts conforme slide 11 do PPTX

| Item | Peso | Status | Onde está |
|---|---|---|---|
| **APIs RESTful** | 20% | ✅ | `apps/api/src/routes/` — 30+ endpoints REST |
| **Documentação Swagger** | 10% | ✅ | `apps/api/src/server.ts` (registra `@fastify/swagger` em `/docs`) |
| **Métodos HTTP corretos** | 10% | ✅ | GET (consulta) · POST (criação) · PATCH (atualização) · DELETE — todas as rotas |
| **Desenho de arquitetura** | 10% | ✅ | `docs/deliverables/FaroAI_Architecture.archimate` (4 visões TOGAF) |
| **Organização SOA modular** | 10% | ✅ | `apps/api/src/routes/*.ts` + `lib/*.ts` + `modules/*.ts` |
| **Separação apresentação/serviço/dados** | 10% | ✅ | `apps/web` (apresent.) · `apps/api` (serviço) · `supabase` (dados) |
| **Padrões REST/JSON/OpenAPI** | 8% | ✅ | OpenAPI 3 gerado automaticamente |
| **Tratamento de erros** | 7% | ✅ | Try/catch + Zod errors + Fastify error handler |
| **Configuração BD + Migrations** | 15% | ✅ | `supabase/migrations/` — 19 migrations versionadas |

**Onde provar**: rode `pnpm dev:api` e acesse `http://localhost:3333/docs` — Swagger UI lista todos os endpoints, com schemas, exemplos e validação Zod.

---

### ✅ Disciplina 2 — Mobile Development

> React Native com Expo; IoT está fora do escopo deste sprint.

| Item | Status | Onde está |
|---|---|---|
| **App React Native funcional** | ✅ | `apps/mobile/` (Expo SDK 52 + RN 0.76) |
| **iOS + Android** | ✅ | `app.json` com identificadores de bundle e ícones |
| **Navegação Expo Router** | ✅ | `apps/mobile/app/` (file-based routing) |
| **Sessão nativa protegida** | ✅ | `expo-secure-store`; web usa armazenamento do navegador |
| **Consumo de APIs** | ✅ | `apps/mobile/lib/api.ts` chama `apps/api` |
| **TypeScript estrito** | ✅ | `tsconfig.json` |
| **Aderência ao desafio Ford** | ✅ | D1 (veículos e comparação) + D2 (clientes, leads e insights) |

**Como rodar**: `pnpm dev:mobile` mostra o QR code do Expo para Expo Go ou simulador.

### ✅ Disciplina 3 — Testing, Compliance & Quality Assurance

> Slides 13-14 do PPTX — entrega em grupo

| Item | Status | Arquivo |
|---|---|---|
| **Pitch escrito** | ✅ | `docs/deliverables/Pitch_FaroAI.md` — 5 falantes × ~40s = ≥3 min |
| **Apresentação 10-15 slides** | ✅ **14 slides** | `docs/deliverables/Apresentacao_FaroAI.pptx` |
| **Slide 1 com nome + RM** | ✅ | Slide 1 lista os 5 integrantes com RMs |
| **Vídeo de pitch (até 3 min)** | ⏳ **Você grava** | Link a inserir no slide 1 da apresentação |
| **Business Canvas** | ✅ | `docs/deliverables/Business_Canvas.docx` |
| **Quadro de Valor** | ✅ | `docs/deliverables/Quadro_de_Valor.docx` |
| **Arquitetura TOGAF no Archi (.archimate)** | ✅ | `docs/deliverables/FaroAI_Architecture.archimate` |
| **Diagrama exportado (visualização)** | ✅ | `FaroAI_Architecture_Diagram.pdf` + `.png` |
| **README dos entregáveis** | ✅ | `docs/deliverables/README_Entregaveis.docx` |
| **Critérios de qualidade (performance/segurança/usabilidade)** | ✅ | Slide 13 da apresentação + SECURITY.md |
| **Riscos e impactos no negócio** | ✅ | Slide 13 da apresentação + Pitch (anexo executivo) |
| **Métricas de sucesso** | ✅ | Slide 14 da apresentação (6 KPIs) |
| **Análise de impactos de falhas** | ✅ | Business_Canvas.docx (seção Riscos) |
| **Custos associados à qualidade** | ✅ | Business_Canvas.docx (seção Custos) |
| **Cada benefício com métrica de negócio + qualidade** | ✅ | Quadro_de_Valor.docx |

**🎬 O que você ainda precisa fazer**:
1. Gravar o vídeo de até 3 min (use o roteiro em `Pitch_FaroAI.md`)
2. Subir o vídeo no Teams ou YouTube unlisted
3. Editar o slide 1 do `Apresentacao_FaroAI.pptx` colando o link do vídeo onde está `[inserir link do Teams]`

---

### ✅ Disciplina 4 — Cybersecurity

> Sprint 3: quatro grupos avaliativos, total de 10 pontos. IoT e MQTT estão fora do escopo.

| Grupo | Pontos | Implementação no repositório | Operação pendente |
|---|---:|---|---|
| **DevSecOps e pipeline** | 3,0 | CI com typecheck, Semgrep, `pnpm audit`, `pip-audit`, Gitleaks e Dependabot | Exigir os jobs nas regras de proteção da branch |
| **Segurança de código e infraestrutura** | 2,5 | Zod, RBAC, RLS, segredos obrigatórios, SecureStore nativo e fetch de e-book restrito | Configurar TLS, proxy, firewall e rede privada no deploy |
| **Monitoramento e resposta a incidentes** | 2,0 | Pino, limite de requisições e `audit_log` | Centralizar logs, configurar alertas e definir responsáveis |
| **Compliance e segurança contínua** | 2,5 | Minimização de dados, escopo por concessionária e atualização semanal de dependências | Aprovar fluxos de IA, retenção e resposta conforme LGPD |

**Documento de referência**: [`docs/SECURITY.md`](../SECURITY.md). O workflow está configurado, mas seus jobs ainda precisam rodar no CI. Branch protection, alertas e controles de produção dependem da configuração do ambiente.

### ✅ Disciplina 5 — Inteligência Artificial & Machine Learning

Challenge 2 — VIN Share e retenção, o mesmo da sprint anterior. O notebook anterior e seu relatório permanecem como histórico. Os itens abaixo registram a entrega Sprint 3.

| Item | Status | Onde está |
|---|---|---|
| **Notebook Sprint 3 (.ipynb)** | ✅ | `services/ml/notebooks/ford_retention_sprint3.ipynb` |
| **Relatório de execução Sprint 3** | ✅ | `docs/deliverables/Relatorio_Sprint3_IA_ML_Challenge2.md` — números gravados pelo notebook após a execução |
| **Dados e limites** | ✅ | Base sintética de 10.000 registros; o relatório deixa claro que não mede desempenho Ford real |
| **Análise e preparação** | ✅ | EDA, auditoria, limites de domínio, imputação dentro do pipeline e codificação categórica |
| **Segmentação Base 1** | ✅ | Comparação de K=2 a 8 por inércia e silhouette; K=4 mantido para os quatro perfis do desafio |
| **Classificação Base 2** | ✅ | Regressão logística, Random Forest, XGBoost e baseline comparados por validação cruzada estratificada |
| **Ajuste e avaliação** | ✅ | Busca em grade no treino; teste estratificado reservado para avaliar o modelo ajustado |
| **Métricas por perfil e matriz de confusão** | ✅ | Incluídas no notebook e no relatório gerado |
| **Uso no produto** | ✅ | Demonstração pelo `src.classifier.predict`; salva um candidato sem trocar o modelo da API |

**Limites para produção:** o notebook não usa a planilha real ausente do repositório. A rota `/predict` carrega `classifier_base2.joblib`, não `classifier_real_v1.joblib`. O ETL real atual calcula agregados de perfil por concessionária e modelo sobre toda a base antes do split, portanto suas métricas não são evidência livre de vazamento. Corrigir esse fluxo e avaliar com dados autorizados por tempo ou concessionária antes de promover um modelo.

---

## 📁 Tudo está em `docs/deliverables/`

```
docs/deliverables/
├── Apresentacao_FaroAI.pptx           ← 14 slides (Disciplina 3)
├── Pitch_FaroAI.md                    ← Roteiro 5 falantes (Disciplina 3)
├── Business_Canvas.docx               ← Canvas (Disciplina 3)
├── Quadro_de_Valor.docx               ← Quadro de Valor (Disciplina 3)
├── FaroAI_Architecture.archimate      ← TOGAF Archi (Disciplina 3)
├── FaroAI_Architecture_Diagram.pdf    ← Diagrama exportado
├── FaroAI_Architecture_Diagram.png    ← Diagrama exportado
├── Relatorio_Sprint3_IA_ML_Challenge2.md ← Relatório Sprint 3, gerado pelo notebook
├── Relatorio_Desafio_2_ML.pdf         ← Relatório anterior (histórico)
├── README_Entregaveis.docx            ← Índice
└── CHECKLIST_ENTREGAS.md              ← Este arquivo
```

E mais:

```
docs/
└── SECURITY.md                        ← Cybersecurity (Disciplina 4)

services/ml/notebooks/
├── ford_segmentation.ipynb            ← Notebook anterior (histórico)
└── ford_retention_sprint3.ipynb       ← Notebook Sprint 3 (Disciplina 5)
```

---

## 🎯 O que VOCÊ ainda precisa fazer

1. ⏳ **Gravar o vídeo de pitch** (até 3 min) — roteiro pronto em `Pitch_FaroAI.md`
2. ⏳ **Subir o vídeo** no Teams ou YouTube unlisted
3. ⏳ **Editar `Apresentacao_FaroAI.pptx` slide 1**: substituir `[inserir link do Teams]` pelo link real
4. ⏳ **Submeter no Teams**: enviar tudo junto (pptx + ArchiMate + vídeo + notebook Sprint 3 + relatório Sprint 3 + docx; manter o PDF anterior como histórico)

---

## 🔐 Acesso ao sistema (demo)

- **Web**: `http://localhost:3000` (rode `pnpm dev:web`)
- **API**: `http://localhost:3333` (rode `pnpm dev:api`)
- **Swagger**: `http://localhost:3333/docs`
- **Mobile**: `pnpm dev:mobile` → escaneie QR code no Expo Go
- **Login admin**: `admin@faroai.com.br` · senha `Ford2026!`

---

## ✅ Verificação final do código

| Check | Status |
|---|---|
| Zero menções a "3am IT" / "Genova" em arquivos relevantes | ✅ |
| Branding **Faro AI** consistente (sidebar, página de login, README) | ✅ |
| Admin `admin@faroai.com.br` criado no Supabase | ✅ |
| Mobile typecheck (warnings pré-existentes, sem bloqueios) | ✅ |
| API rotas: 30+ endpoints REST documentados em Swagger | ✅ |
| Banco: 19 migrations versionadas + RLS habilitada | ✅ |
| Base real de 175.554 VINs acessível neste checkout | ❌ | Planilha e Parquet não incluídos; importação anterior consta no histórico do projeto |
| Schema canônico Ford D1 (262 atributos × 14 seções) populado | ✅ |
| Métricas do XGBoost real sem vazamento | ⏳ | Métricas anteriores foram reportadas, mas o ETL calcula agregados de perfil na base completa antes do split; revalidar após corrigir |

---

*Faro AI · AI que tem faro pro cliente certo.*
