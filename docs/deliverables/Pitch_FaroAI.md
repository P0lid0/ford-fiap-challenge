# 🎬 Pitch Faro AI · Ford × FIAP Challenge 2026

**Vídeo de 3+ minutos · 5 falantes · ~40s cada**

---

## 📋 Identificação

- **Empresa/Projeto**: **Faro AI** — *Inteligência automotiva*
- **Tagline**: *"AI que tem faro pro cliente certo."*
- **Cliente**: Ford Motor Company Brasil
- **Sprint**: Ford × FIAP Challenge 2026 (1ª entrega · 24/05/2026)
- **Equipe**:
  - **Guilherme** — RM 554962
  - **Pedro** — RM 555556
  - **Fabrício** — RM 558216
  - **Vitor** — RM 554893
  - **Matheus** — RM 555447

---

# 🎤 ROTEIRO DO PITCH

## 👤 FALA 1 — Apresentação & Problema (≈ 40s) — **GUILHERME**

> *"Boa tarde. Somos a **Faro AI** — uma startup de inteligência automotiva
> nascida dentro do FIAP Challenge 2026. Eu sou o Guilherme, e do meu lado estão
> Pedro, Fabrício, Vitor e Matheus.*
>
> *Hoje, a Ford BR vende centenas de milhares de carros — mas só uma fração
> volta pra rede oficial pra fazer manutenção. **Esse indicador chama VIN
> Share**, e é a dor que a Ford trouxe pra gente: como reter o cliente no
> pós-venda, sem depender só da venda do próximo carro?*
>
> *E também: como gerar inteligência competitiva pra vendedor saber,
> instantaneamente, onde a Ranger ganha ou perde contra qualquer concorrente?*
>
> *Os dois desafios têm uma coisa em comum: **decisão precisa, em tempo real,
> com dados verificáveis**. Foi exatamente isso que a gente construiu."*

**[Visual sugerido]**: Logo Faro AI aparecendo · cut com slides dos dois desafios
Ford lado a lado · slide com nomes da equipe + RMs.

---

## 👤 FALA 2 — O Mercado (≈ 40s) — **FABRÍCIO**

> *"Esse problema **não é exclusivo da Ford**. É a maior dor de toda
> montadora no mundo.*
>
> *Algumas estatísticas pra dimensionar:*
>
> - *O mercado brasileiro de pós-venda automotivo movimenta cerca de **R$ 80
>   bilhões por ano**. As redes oficiais ficam com **menos de 30%** disso —
>   o restante vai pra oficinas independentes.*
> - *Cada **1 ponto percentual** a mais de VIN Share representa, pra
>   uma OEM, dezenas de milhões em receita recorrente.*
> - *Estudos da Cox Automotive mostram que o **LTV** de um cliente fiel
>   à rede oficial é **até 3x maior** que o de um cliente esporádico.*
> - *No nosso dataset real Ford BR: **mais de 11% dos VINs abandonam a rede
>   após a 1ª revisão**, e **55% perdem o timing** da revisão regular.*
>
> *Ou seja: o problema é gigante, e o gap entre **saber quem está pra sair** e
> **agir antes** vale muito dinheiro."*

**[Visual sugerido]**: Stats em cards grandes · gráfico de pizza
"redes oficiais vs independentes" · screenshot da página `/visao-ford` mostrando
a distribuição comportamental real dos 175k VINs.

---

## 👤 FALA 3 — A Solução (≈ 50s) — **PEDRO**

> *"A Faro AI entrega um produto único que cobre os dois desafios em
> uma plataforma só. São três blocos:*
>
> ***Bloco 1 — Catálogo competitivo (Desafio 1).*** *Cadastramos as 3 versões da
> Ranger 26MY no schema canônico Ford com 262 atributos. Operador compara contra
> qualquer concorrente lado a lado, com troféu visual no maior valor de cada
> linha. A IA cruza com vendas reais no Brasil via web search.*
>
> ***Bloco 2 — Retenção VIN Share (Desafio 2).*** *Ingerimos os **175 mil VINs
> reais** do dataset Ford. Treinamos um XGBoost que classifica cada cliente em
> um de 4 perfis comportamentais. Cruzamos o perfil com sinais operacionais —
> revisão atrasada, garantia vencendo, fidelidade ao dealer — e geramos
> automaticamente **135 mil leads priorizados** com explicação visível do
> porquê cada um está no topo.*
>
> ***Bloco 3 — Ação real.*** *O vendedor abre a ficha, vê a Visão 360, e dispara
> e-mail real via Resend com template ajustado ao perfil. Tudo auditado.*
>
> *Pipeline 100% transparente: cada decisão tem fonte e cada predição tem
> sinal explicável."*

**[Visual sugerido]**: Screen recording de 3 telas rápidas — `/veiculos/comparar`
mostrando o schema canônico · `/leads` mostrando os sinais coloridos por lead ·
`/clientes/[id]` mostrando Visão 360 + envio de e-mail real.

---

## 👤 FALA 4 — Benchmark & Diferenciação (≈ 40s) — **VITOR**

> *"O que já existe no mercado pra esse problema?*
>
> *Soluções genéricas como **Salesforce Automotive Cloud** e **Microsoft
> Dynamics 365** custam acima de **US$ 150 por usuário/mês**, exigem 6 meses
> de implementação, e não são feitas com dados brasileiros. **Plataformas de
> ML como DataRobot** dão o modelo mas não o produto. **CRMs locais como Linx
> e TOTVS** têm cobertura mas zero IA preditiva.*
>
> *Onde a **Faro AI** ganha:*
>
> 1. ***Stack 100% Brasil**: integração nativa FIPE, dataset oficial Ford BR,
>    análise de vendas via FENABRAVE — competidor global não tem isso.*
> 2. ***IA explicável**: cada lead mostra POR QUE está no topo (sinais
>    visíveis), não é black box.*
> 3. ***Hybrid ML + LLM crítico**: XGBoost prediz, LLM revisa com contexto
>    qualitativo — reduz erro do modelo puro.*
> 4. ***Pronto pra usar**: nosso MVP já roda hoje com 175k clientes reais,
>    enquanto competidor leva semanas de setup.*
> 5. ***LGPD-first**: VIN_Hash anonimizado, audit log de e-mails, RLS no banco
>    desde o dia 1.*"

**[Visual sugerido]**: Tabela comparativa "Faro AI vs Salesforce vs Linx vs
DataRobot" com checks verdes onde a Faro AI ganha.

---

## 👤 FALA 5 — Roadmap, Métricas & Encerramento (≈ 50s) — **MATHEUS**

> *"Pra fechar, o roadmap das próximas sprints e como mediremos sucesso.*
>
> ***Sprint 3** (entrega 14/06): integração com APIs de veículo conectado
> (telematics), dashboards regionais com drilldown por dealer, e treino do
> modelo com 6 meses de novo histórico.*
>
> ***Sprint 4** (entrega 12/07): mobile-first pra vendedor de loja, motor de
> campanhas automáticas com A/B testing, e API pública pra integração com o
> CRM atual da Ford.*
>
> ***Critérios de qualidade que perseguimos:***
> - *Performance: tela carrega em <2s, lead ranking de 175k em <1s via RPC SQL.*
> - *Segurança: RLS no Postgres, HMAC nas requisições ML, sem PII no contexto
>   de IA.*
> - *Usabilidade: UI testada com vendedor de loja real, 4 cliques pra disparar
>   ação.*
>
> ***Riscos identificados***: dependência de chaves de IA pagas (mitigado por
> fallback gracioso entre OpenAI, Anthropic e Gemini), e drift do modelo
> (mitigado por re-treino mensal).*
>
> ***Métricas de sucesso***:
> - *Aumento de VIN Share em **+3pp em 6 meses** na loja piloto*
> - *Conversão de lead pra revisão agendada de **>15%***
> - *NPS do vendedor **>70***
> - *Disponibilidade **99,5%***
>
> ***A Faro AI não é só um sistema — é a forma da Ford parar de perder cliente
> sem nem saber que perdeu. Obrigado.***"

**[Visual sugerido]**: Roadmap em timeline horizontal · grid de KPIs · logo
Faro AI final + frase "AI que tem faro pro cliente certo."

---

# 📊 ANEXO: Resumo executivo (1 página)

## Problema
- Ford BR perde cliente pra oficinas independentes (VIN Share < 30%)
- Sem visibilidade preditiva: time descobre churn só quando já aconteceu
- Inteligência competitiva manual e desestruturada

## Solução: Faro AI
Plataforma SaaS que combina:
1. **Catálogo canônico** (262 atributos × 14 seções) — Desafio 1
2. **Classificador preditivo** XGBoost real (175k VINs Ford BR) — Desafio 2
3. **Lead ranking** com 6 sinais operacionais explicáveis
4. **Ação integrada**: envio real de e-mail via Resend, registro auditado

## Diferenciais
| Aspecto | Faro AI | Salesforce | Linx | DataRobot |
|---|---|---|---|---|
| Custo entrada | **Open-stack** | US$150/user | R$1k/mês | US$10k/mês |
| Dataset Ford BR real | ✅ 175k VINs | ❌ | ❌ | ❌ |
| IA explicável | ✅ Sinais visíveis | ⚠️ Limitada | ❌ | ⚠️ SHAP only |
| LGPD-first | ✅ VIN_Hash + RLS | ✅ | ⚠️ | ⚠️ |
| Arquitetura preparada para produção | ✅ MVP funcional | 3-6 meses | 1-2 meses | 2-3 meses |
| Integração FIPE/FENABRAVE | ✅ Nativa | ❌ | ⚠️ | ❌ |

## Critérios de qualidade
- **Performance**: <2s render · <1s ranking 175k leads
- **Segurança**: RLS Postgres · HMAC payloads · audit log · LGPD-ready
- **Usabilidade**: ≤4 cliques pra ação · UI 100% PT-BR
- **Observabilidade**: 100% das chamadas IA rastreadas (custo + provider + cache)

## Riscos & mitigações
| Risco | Impacto | Mitigação |
|---|---|---|
| Dependência de chaves IA pagas | Quebra de extração | Fallback gracioso entre 3 providers |
| Drift do modelo | Predição obsoleta | Re-treino mensal automático |
| Cliente sem e-mail no cadastro | Não dá pra mandar lembrete | Captura no momento da venda (UI) |
| Custo de envio de e-mail em escala | Conta cresce | Limite por tier de cliente + opt-in LGPD |

## Métricas de sucesso (KPIs)
| KPI | Meta 6 meses |
|---|---|
| VIN Share (loja piloto) | +3 p.p. |
| Conversão lead → revisão agendada | >15% |
| Tempo médio de resposta API | <500ms (p95) |
| Disponibilidade | 99,5% |
| NPS vendedor | >70 |
| Custo médio por classificação IA | <US$ 0,05 |

## Roadmap

| Sprint | Período | Entregas |
|---|---|---|
| ✅ **Sprint 1** (atual) | 24/05/2026 | MVP D1 + D2 com 175k VINs reais, 135k leads detectados, envio real de e-mail, schema canônico 262 atributos |
| 🟡 **Sprint 2** | 07/06/2026 | Mobile-responsive · re-treino do XGBoost com novos dados · onboarding sem fricção |
| ⏭ **Sprint 3** | 14/06/2026 | API de telematics (veículo conectado) · dashboards regionais com drilldown · KPIs de impacto financeiro |
| ⏭ **Sprint 4** | 12/07/2026 | App mobile pro vendedor de loja · motor de campanhas A/B · API pública pra integrar com CRM Ford |

---

## 🎥 Notas de produção do vídeo

**Duração alvo**: 3-3:30 min  
**Estilo**: 5 falantes em sequência, cada um filmado em close-up (busto), corte
limpo entre falas. Slide visual de fundo muda conforme a fala.

**Música**: ambiente eletrônica suave (sem letra) — referência: Vercel keynote,
Notion product launch.

**Logo abertura (0-3s)**: Faro AI animado · texto pequeno *"em parceria com Ford × FIAP"*  
**Logo encerramento (último 5s)**: Faro AI + tagline *"AI que tem faro pro cliente certo."*

**Equipamento mínimo**: celular com câmera HD, microfone de lapela ou cardióide
USB, iluminação natural ou softbox. Edição: CapCut, DaVinci Resolve ou Premiere.

**Roteiro de gravação por pessoa**: ~45s de fala efetiva + 10s de respiro
visual = ~55s por bloco × 5 = 4:35 brutos, edita pra 3:00-3:30 finais.
