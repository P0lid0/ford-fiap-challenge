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
**Decisão:** `EXPO_PUBLIC_*` só inclui `SUPABASE_URL` e `SUPABASE_ANON_KEY` (pública por design); service_role só no backend.
**Motivação:** mobile vira PWA, IPA ou APK — qualquer chave que vai pra lá é pública.
**Impacto:** o mobile autentica direto no Supabase Auth e usa o JWT do usuário pra todas as chamadas (RLS protege os dados).

### 9. Cache de insights Claude em `ai_insights` com hash do payload
**Decisão:** tabela `ai_insights(scope, resource_id, payload_hash)` com TTL.
**Motivação:** insights são determinísticos por payload — re-chamar é desperdício de token e latência.
**Impacto:** custo Claude estimado em ~$5/mês mesmo com uso intenso pela banca avaliadora.

### 10. Migration runner com fallback manual (SQL Editor)
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

## Riscos conhecidos / dívida técnica

- **DB password ausente.** Migrations precisam ser aplicadas manualmente até o `SUPABASE_DB_PASSWORD` ser preenchido no `.env.local`.
- **`SUPABASE_ANON_KEY` precisa ser preenchido** pelo Pólido (pegar no Dashboard). Sem ele, o mobile não conecta.
- **`carrosnaweb` está com backend off** (500 em todas as fichas). LLM fallback cobre o gap.
- **`SUPABASE_JWT_SECRET` não foi compartilhado**; quando preenchido, o backend valida JWTs localmente sem chamar `auth.getUser()`. Por enquanto, valida via Supabase API (1 round-trip extra por request).
- **Sem testes de RLS policy** ainda; risco real de policy mal escrita silenciosamente abrir dado. M2 vai adicionar.
- **Modelo F1 macro 0.56** — bom, mas a classe "esquecido" tem o pior recall (features sutis no momento da compra). SMOTE/ADASYN podem subir.
- **Detox e2e não configurado** ainda. M3 vai cobrir.

---

## Credenciais e rotação

Em 14/05/2026 o Pólido enviou em chat:
1. `SUPABASE_URL` (semi-público — sem ação necessária)
2. `SUPABASE_SERVICE_ROLE_KEY` (JWT longo)
3. Um `sb_secret_*`

**Ação obrigatória após a entrega:** rotacionar `SUPABASE_SERVICE_ROLE_KEY` e o `sb_secret_*` em **Supabase Dashboard → Settings → API → Reset**. Essas chaves saíram do canal seguro.
