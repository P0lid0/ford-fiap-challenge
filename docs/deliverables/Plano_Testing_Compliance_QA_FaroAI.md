# Plano de Testing, Compliance e Quality Assurance — Faro AI

**Projeto:** Ford × FIAP Challenge 2026 · **Equipe:** Equipe Faro AI · **Data-base:** 2026-09-27

Plano de produto e qualidade para o Azure Boards, alinhado ao modelo TOGAF/ArchiMate e ao código existente no repositório.

## Escopo e premissas

- O PDF Ford_V2.pdf informa Sprint 3 com entrega em 27/09/2026 e Sprint 4 com entrega em 11/10/2026. O documento não informa as datas das Sprints 1 e 2.
- As alocações de Sprint 1 e 2 são uma proposta de sequência para o produto. Validar as datas e o histórico real da equipe no Azure DevOps antes de publicar.
- A velocidade histórica da equipe não está registrada nos arquivos consultados. A carga de 29 a 34 pontos por Sprint é uma hipótese inicial, não uma capacidade comprovada.
- Os pontos usam a escala Fibonacci 1, 2, 3, 5, 8, 13 como estimativa inicial de Planning Poker. A equipe precisa votar os pontos antes de assumir o compromisso.
- O backlog usa o processo Scrum do Azure DevOps. Os tipos são Epic, Feature, Product Backlog Item e Task.
- A arquitetura FaroAI_Architecture.archimate e o código do repositório definem o escopo FaroAI. O modelo SistemaHelpDesk na pasta de aula é um exemplo distinto e não deve ser importado como arquitetura do produto.
- A automação CI existente executa typecheck da API, treino smoke e pytest do serviço ML e Gitleaks. O workflow atual não executa testes da API nem verificações de web e mobile.
- O import CSV cria os vínculos de hierarquia. As relações Predecessor entre itens devem ser criadas no Azure Boards após o import.
- A equipe ainda precisa confirmar o nome da organização e do projeto Azure DevOps, o caminho de área, os nomes de iteração e o e-mail institucional do professor.

O PDF atribui 20% a cada parte da atividade: hierarquia Scrum; descrições, aceite e pronto em BDD; prioridade, Planning Poker e dependências; release plan; e tarefas da Sprint atual.

## Alinhamento com a arquitetura

| Épico | Fluxos e componentes relacionados |
|---|---|
| Inteligência competitiva de veículos | Processo Comparativo Competitivo; Faro AI API Gateway; Aggregator de Veículos; Catálogo de Veículos; FIPE.online, NHTSA, 411 Vehicle Data, fabricantes e provedores de IA. |
| Retenção e relacionamento pós-venda | Classificação Preditiva de Perfil; Orquestração de Ações de Retenção; Painel de Carteira; ML Service; clients, leads, predictions, acoes_retencao e audit_log. |
| Plataforma segura e integrada | Faro AI Web; Faro AI Mobile; API Gateway Fastify; ML Service FastAPI; Supabase Auth; Postgres RLS; Audit Log Service. |
| Qualidade, conformidade e entrega | Todos os componentes FaroAI: web, mobile, API, ML, Supabase, provedores externos, Auth, RBAC e trilha de auditoria. |

O projeto usa o modelo FaroAI em FaroAI_Architecture.archimate. O arquivo de Help Desk fornecido na pasta de aula é um exemplo didático diferente.

## Prioridade e esforço

A prioridade descreve a necessidade para o negócio e para a entrega. O número é o valor inicial para o campo Priority do Azure Boards.

| Rótulo | Priority | Regra de priorização |
|---|---:|---|
| Obrigatório | 1 | Requisito necessário para o fluxo principal, segurança ou critério explícito de entrega. |
| Necessário | 2 | Requisito que completa o uso confiável do produto ou reduz risco importante. |
| Opcional | 3 | Melhoria útil que pode ficar fora da primeira entrega sem bloquear o fluxo principal. |

Os PBIs usam pontos Planning Poker na escala Fibonacci. Os pontos são uma proposta baseada no código e na arquitetura; a equipe deve reestimar em conjunto. Não converta pontos diretamente em horas.

Prioridade e esforço são registrados nos PBIs. Epics e Features recebem prioridade pela urgência de seus filhos e não recebem pontos separados, para evitar contagem dupla.

## Definition of Ready

- O item tem persona, resultado de negócio e motivo claros.
- Os critérios de aceite estão escritos em cenários Dado/Quando/Então e podem ser observados.
- O item aponta os componentes ou elementos da arquitetura que serão afetados.
- As dependências técnicas estão identificadas.
- A equipe discutiu riscos, dados de teste e evidências necessárias.
- A equipe estimou o item em Planning Poker.

## Definition of Done

- O código e a documentação do item estão no repositório e passaram por revisão.
- Todos os critérios de aceite foram verificados no ambiente definido para a Sprint.
- Os testes automatizados aplicáveis passaram. Os testes manuais têm resultado e evidência registrados.
- A solução respeita autenticação, autorização, isolamento por concessionária e privacidade aplicáveis ao fluxo.
- Logs e respostas de erro não expõem credenciais, tokens ou dados pessoais.
- A documentação da API ou da operação foi atualizada quando o contrato mudou.
- A evidência foi vinculada ao item do Azure Boards e não contém dados reais de clientes.

## Release plan

| Sprint | Meta | Data indicada no PDF | Pontos | Escopo planejado |
|---|---|---|---:|---|
| Sprint 1 | Entregar a base do catálogo competitivo, a comparação de veículos e os controles de acesso da plataforma. | Não informado no PDF | 29 | PBI-1.1.1, PBI-1.1.2, PBI-1.2.1, PBI-3.1.1, PBI-3.2.1 |
| Sprint 2 | Entregar classificação de clientes, priorização de leads, enriquecimento de catálogo e fluxos de uso. | Não informado no PDF | 34 | PBI-1.2.2, PBI-2.1.1, PBI-2.1.2, PBI-2.2.1, PBI-2.2.2, PBI-3.1.2, PBI-3.2.2 |
| Sprint 3 | Completar ações auditáveis e estabelecer a estratégia de testes, os gates de CI e a revisão de conformidade. | 2026-09-27 | 31 | PBI-2.3.1, PBI-3.3.1, PBI-4.1.1, PBI-4.1.2, PBI-4.1.3, PBI-4.1.5, PBI-4.2.1 |
| Sprint 4 | Validar o produto ponta a ponta, preparar evidências e gravar o vídeo pitch/técnico de até 6 minutos. | 2026-10-11 | 30 | PBI-4.1.4, PBI-4.2.2, PBI-4.2.3, PBI-4.2.4, PBI-4.3.1, PBI-4.3.2 |

A carga proposta varia de 29 a 34 pontos por Sprint. Esse equilíbrio é apenas inicial. Confirmar a velocidade real e ajustar o plano com a equipe. As datas das Sprints 1 e 2 não aparecem no PDF.

## Backlog de produto

Cada PBI usa o formato Como/Quero/Para. Os cenários de aceite seguem Dado/Quando/Então. As relações pai/filho entram no CSV; os predecessores técnicos ficam listados para criação como links Predecessor no Azure Boards.

### EP-1 · Inteligência competitiva de veículos

Disponibilizar dados automotivos rastreáveis e comparações que apoiem a decisão de venda na concessionária.

**Rastreabilidade:** Processo Comparativo Competitivo; Faro AI API Gateway; Aggregator de Veículos; Catálogo de Veículos; FIPE.online, NHTSA, 411 Vehicle Data, fabricantes e provedores de IA.

**Critérios de aceite**

1. Dado que o catálogo tem dados de veículos com fonte identificada, quando um vendedor comparar de dois a cinco veículos, então o resultado deve usar os atributos canônicos e preservar procedência e ausência de dados.
2. Dado que um atributo foi sugerido por IA, quando o vendedor consultar a comparação, então a sugestão deve aparecer como não confirmada até a revisão humana.

**Critérios de pronto**

- Os atributos canônicos e as fontes estão documentados.
- A comparação respeita quantidade, unidade, ausência de dados e revisão de sugestões.
- Os cenários principais têm evidência ligada aos PBIs.

#### FT-1.1 · Catálogo canônico e procedência dos dados

Unificar atributos do veículo no schema Ford e preservar a fonte e a confiança de cada valor.

**Critérios de aceite**

1. Dado que um veículo é consultado ou atualizado, quando o sistema devolver seus atributos, então os campos devem usar o schema canônico e indicar fonte e confiança quando houver valor.

**Critérios de pronto**

- O schema Ford e as regras de validação estão versionados.
- O catálogo não apresenta sugestão ou ausência como dado confirmado.

##### PBI-1.1.1 · Registrar origem e confiança dos atributos de veículo

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 1

**Como:** Analista de inteligência competitiva.

**Quero:** consultar atributos de veículos com fonte, data de captura e confiança por campo.

**Para:** validar a informação antes de usá-la em uma comparação comercial.

**Arquitetura relacionada:** Aggregator de Veículos; FIPE.online; NHTSA vPIC; 411 Vehicle Data; sites oficiais; Data Object Veículo com provenance por campo.

**Critérios de aceite**

1. Dado que uma fonte externa retornou um atributo válido de veículo, quando o agregador persistir esse atributo, então o registro deve incluir valor, fonte, data de captura e nível de confiança.
2. Dado que duas fontes retornaram valores diferentes para o mesmo atributo, quando o agregador aplicar a prioridade de fontes, então o valor escolhido e a divergência devem permanecer rastreáveis.
3. Dado que a fonte prioritária está indisponível, quando outra fonte confiável possuir o atributo, então o sistema deve usar a alternativa e registrar a origem usada.

**Predecessores técnicos:** Nenhum predecessor técnico.

**Critério de pronto para este item**

- A política de prioridade e fallback está documentada.
- Os dados persistidos permitem localizar a fonte de cada campo.
- Os cenários de conflito e fallback têm resultado registrado.

##### PBI-1.1.2 · Validar o schema canônico Ford de 262 atributos

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 1

**Como:** Analista de inteligência competitiva.

**Quero:** consultar cada veículo no schema canônico Ford organizado em 14 seções.

**Para:** comparar veículos com nomes, tipos e unidades consistentes.

**Arquitetura relacionada:** Catálogo de Veículos; API REST; base vehicles e catalog_items no Supabase.

**Critérios de aceite**

1. Dado que um veículo está sendo criado ou atualizado, quando a API validar seus atributos, então cada campo conhecido deve respeitar identificador, tipo, seção e unidade definidos no schema.
2. Dado que um atributo não tem valor confirmado, quando a API serializar o veículo, então o campo deve manter o formato esperado e indicar ausência sem inventar um valor.
3. Dado que um atributo não existe no schema, quando a API receber esse atributo, então a validação deve rejeitá-lo ou colocá-lo em uma área de revisão explícita.

**Predecessores técnicos:** PBI-1.1.1

**Critério de pronto para este item**

- O contrato do schema está versionado e tem exemplos.
- A API valida tipos, unidades e campos desconhecidos.
- A resposta mantém formato estável para clientes web e mobile.

#### FT-1.2 · Comparação de veículos e apoio por IA

Comparar de dois a cinco veículos e permitir enriquecimento assistido com revisão humana.

**Critérios de aceite**

1. Dado que um vendedor seleciona veículos válidos, quando solicitar uma comparação, então a interface deve mostrar diferenças comparáveis e destacar sugestões de IA como pendentes de confirmação.

**Critérios de pronto**

- A comparação funciona com limites de dois a cinco veículos.
- Os dados ausentes, fontes e sugestões aparecem de forma distinta.

##### PBI-1.2.1 · Comparar de 2 a 5 veículos no schema canônico

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 8 SP · **Sprint:** Sprint 1

**Como:** Vendedor da concessionária.

**Quero:** comparar de dois a cinco veículos lado a lado nos atributos equivalentes.

**Para:** explicar vantagens e diferenças do veículo Ford ao cliente.

**Arquitetura relacionada:** Processo Comparativo Competitivo; API de comparação; Faro AI Web e Mobile; Catálogo de Veículos.

**Critérios de aceite**

1. Dado que o vendedor escolheu de dois a cinco veículos válidos, quando solicitar a comparação, então o sistema deve devolver os mesmos atributos canônicos para todos os veículos.
2. Dado que um atributo numérico comparável tem valores para os veículos, quando a comparação for exibida, então o maior valor deve ser destacado sem alterar o valor original nem sua unidade.
3. Dado que um veículo não tem valor confirmado para um atributo, quando a comparação for exibida, então a ausência deve ser visível e não pode ser tratada como zero.

**Predecessores técnicos:** PBI-1.1.2

**Critério de pronto para este item**

- A API rejeita menos de dois ou mais de cinco veículos.
- A comparação preserva fonte, unidade e ausência de dados.
- Os fluxos web e mobile mostram o resultado e os erros de entrada.

##### PBI-1.2.2 · Sugerir atributos do catálogo com IA e confiança visível

**Prioridade:** Opcional (Azure Priority 3) · **Esforço:** 5 SP · **Sprint:** Sprint 2

**Como:** Analista de inteligência competitiva.

**Quero:** receber sugestões de atributos extraídos por IA com fonte e confiança.

**Para:** reduzir a digitação sem transformar uma inferência em dado confirmado.

**Arquitetura relacionada:** Comparação Competitiva com IA; provedores LLM; extração multimodal; Catalog Items.

**Critérios de aceite**

1. Dado que um documento ou página contém um atributo reconhecível, quando o serviço de IA analisar o material, então a sugestão deve incluir valor, fonte, confiança e referência ao trecho de origem quando disponível.
2. Dado que a confiança está abaixo do limite configurado ou a fonte não foi localizada, quando a sugestão chegar à interface, então o sistema deve marcar o campo para revisão e não salvá-lo como confirmado.
3. Dado que um analista revisar a sugestão, quando confirmar ou rejeitar o campo, então a decisão deve ficar registrada com usuário e data.

**Predecessores técnicos:** PBI-1.1.1, PBI-1.1.2

**Critério de pronto para este item**

- Os valores sugeridos não substituem valores confirmados sem revisão.
- A interface distingue sugestão, confirmação e rejeição.
- A ausência de chave de IA apresenta fallback claro.

### EP-2 · Retenção e relacionamento pós-venda

Identificar clientes com risco de afastamento e apoiar ações de retenção rastreáveis na concessionária.

**Rastreabilidade:** Classificação Preditiva de Perfil; Orquestração de Ações de Retenção; Painel de Carteira; ML Service; clients, leads, predictions, acoes_retencao e audit_log.

**Critérios de aceite**

1. Dado que um cliente tem dados elegíveis para análise, quando o sistema gerar perfil e prioridade, então o resultado deve ser explicável e não enviar PII ao serviço ML.
2. Dado que um vendedor autorizado decide contatar um cliente, quando o sistema enviar a ação, então o resultado deve ser registrado sem duplicar o envio.

**Critérios de pronto**

- O fluxo ML mantém os limites de privacidade definidos.
- Leads, visão 360 e ações respeitam o escopo da concessionária.
- O resultado de cada ação de retenção pode ser auditado.

#### FT-2.1 · Classificação e explicação de perfil

Classificar clientes com dados permitidos e apresentar sinais compreensíveis para a equipe de pós-venda.

**Critérios de aceite**

1. Dado que o usuário consulta um cliente autorizado, quando o resultado de ML estiver disponível, então o perfil, a confiança e os sinais devem ser exibidos sem revelar entradas pessoais ao modelo.

**Critérios de pronto**

- Entrada e saída do modelo têm contrato documentado.
- Falhas do modelo não são apresentadas como predição válida.

##### PBI-2.1.1 · Classificar perfil comportamental sem enviar PII ao serviço ML

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 8 SP · **Sprint:** Sprint 2

**Como:** Gestor de pós-venda.

**Quero:** obter um perfil comportamental do cliente a partir de variáveis autorizadas.

**Para:** priorizar ações de retenção sem expor identificadores pessoais ao serviço de ML.

**Arquitetura relacionada:** ML Service FastAPI + XGBoost; gateway API; pipeline de pseudonimização; predictions.

**Critérios de aceite**

1. Dado que um cliente autorizado tem variáveis de entrada válidas, quando a API solicitar uma inferência, então o ML Service deve devolver uma classe de perfil e a confiança no contrato definido.
2. Dado que o gateway montar o payload para o ML Service, quando a chamada for enviada, então nome, CPF, e-mail, telefone e VIN em claro não podem fazer parte do payload.
3. Dado que o ML Service não responde ou rejeita o payload, quando a API tratar a falha, então a resposta deve indicar indisponibilidade sem inventar uma classificação.

**Predecessores técnicos:** PBI-3.1.1, PBI-3.1.2

**Critério de pronto para este item**

- O schema de entrada e saída do ML Service está documentado.
- O teste de contrato verifica ausência de PII no payload.
- O resultado e a versão do modelo ficam rastreáveis.

##### PBI-2.1.2 · Exibir sinais que explicam o risco do cliente

**Prioridade:** Necessário (Azure Priority 2) · **Esforço:** 3 SP · **Sprint:** Sprint 2

**Como:** Vendedor da concessionária.

**Quero:** ver os sinais que influenciaram a prioridade de um cliente.

**Para:** decidir se uma abordagem é adequada e explicar a recomendação.

**Arquitetura relacionada:** Painel de Carteira; leads; predictions; Faro AI Web e Mobile.

**Critérios de aceite**

1. Dado que um lead tem risco e sinais operacionais calculados, quando o vendedor abrir o lead, então a interface deve mostrar o perfil, os sinais usados e a data da análise.
2. Dado que não há resultado válido do modelo, quando a interface carregar o lead, então ela deve mostrar que a análise está indisponível e permitir consultar os dados operacionais.

**Predecessores técnicos:** PBI-2.1.1

**Critério de pronto para este item**

- A explicação não apresenta causalidade que o modelo não mede.
- Os dados visíveis respeitam as permissões da concessionária.
- A tela registra a versão da análise quando disponível.

#### FT-2.2 · Carteira, priorização e visão 360 do cliente

Apresentar leads ordenados e contexto suficiente para a equipe escolher uma ação.

**Critérios de aceite**

1. Dado que um gestor pertence a uma concessionária autorizada, quando abrir a carteira e selecionar um lead, então deve consultar a prioridade e o contexto do cliente sem acessar outra concessionária.

**Critérios de pronto**

- A lista tem ordenação estável e estados de carregamento, vazio e erro.
- A visão 360 e os filtros mantêm o isolamento por concessionária.

##### PBI-2.2.1 · Ordenar e filtrar leads por prioridade de retenção

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 2

**Como:** Gestor de pós-venda.

**Quero:** consultar leads ordenados por risco e filtrar a carteira por sinais operacionais.

**Para:** concentrar o tempo da equipe nos clientes que precisam de contato primeiro.

**Arquitetura relacionada:** Monitoramento de Carteira; leads; metrics; Faro AI Web e Mobile.

**Critérios de aceite**

1. Dado que a concessionária possui leads elegíveis, quando o gestor abrir a carteira, então os leads devem aparecer por prioridade e ter paginação determinística.
2. Dado que o gestor seleciona um filtro disponível, quando a lista for atualizada, então cada linha deve corresponder ao filtro e continuar limitada à concessionária autorizada.
3. Dado que dois leads têm a mesma prioridade, quando a lista for ordenada, então um critério secundário estável deve manter a ordem entre consultas.

**Predecessores técnicos:** PBI-2.1.1, PBI-2.1.2, PBI-3.1.2

**Critério de pronto para este item**

- A ordenação e os filtros têm cenários de sucesso e vazio.
- A paginação não duplica nem omite itens entre páginas estáveis.
- A consulta aplica o isolamento por concessionária.

##### PBI-2.2.2 · Consultar a visão 360 autorizada do cliente

**Prioridade:** Necessário (Azure Priority 2) · **Esforço:** 3 SP · **Sprint:** Sprint 2

**Como:** Vendedor da concessionária.

**Quero:** consultar perfil, veículo, histórico relevante e ações do cliente em uma tela.

**Para:** preparar um contato útil sem buscar dados em várias telas.

**Arquitetura relacionada:** Cliente (pseudonimizado para ML); leads; acoes_retencao; Faro AI Web e Mobile.

**Critérios de aceite**

1. Dado que o vendedor pertence à concessionária do cliente e tem permissão de leitura, quando abrir a visão 360, então a tela deve mostrar apenas os dados autorizados e o histórico relacionado.
2. Dado que o cliente pertence a outra concessionária, quando o vendedor tentar abrir sua visão 360, então o sistema deve negar o acesso sem revelar se o registro existe.

**Predecessores técnicos:** PBI-2.2.1, PBI-3.1.2

**Critério de pronto para este item**

- A tela funciona nos fluxos web e mobile definidos.
- A API e o banco aplicam a mesma regra de acesso.
- A evidência usa registros sintéticos ou anonimizados.

#### FT-2.3 · Ações de retenção com histórico

Permitir contato autorizado e registrar o resultado para auditoria.

**Critérios de aceite**

1. Dado que há permissão e base legal para o contato, quando o vendedor executar uma ação de retenção, então o envio e seu resultado devem aparecer no histórico auditável.

**Critérios de pronto**

- O envio bloqueia usuários e contatos não autorizados.
- Falhas e repetições não geram sucesso falso nem ação duplicada.

##### PBI-2.3.1 · Enviar uma ação de retenção autorizada e registrar o resultado

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 3

**Como:** Vendedor da concessionária.

**Quero:** enviar uma comunicação permitida ao cliente e consultar o resultado.

**Para:** transformar uma recomendação em ação rastreável de pós-venda.

**Arquitetura relacionada:** Orquestração de Ações de Retenção; Resend; acoes_retencao; email_logs; audit_log.

**Critérios de aceite**

1. Dado que o vendedor tem a permissão necessária e existe base legal registrada para o contato, quando solicitar o envio, então o sistema deve enviar a comunicação uma única vez e registrar o resultado.
2. Dado que o provedor retorna erro ou timeout, quando o sistema registrar a tentativa, então o estado deve indicar falha ou resultado desconhecido sem registrar sucesso falso.
3. Dado que o mesmo pedido é reenviado após uma falha de rede, quando o sistema processar a repetição, então a chave de idempotência deve impedir um envio duplicado.

**Predecessores técnicos:** PBI-2.2.2, PBI-3.1.1, PBI-3.3.1

**Critério de pronto para este item**

- A ação exige autorização e base legal antes do envio.
- Sucesso, falha e repetição têm evidência sem dados pessoais desnecessários.
- O provedor externo fica mockado nos testes automatizados.

### EP-3 · Plataforma segura e integrada

Proteger os dados da rede Ford e manter contratos coerentes entre web, mobile, API, ML e banco.

**Rastreabilidade:** Faro AI Web; Faro AI Mobile; API Gateway Fastify; ML Service FastAPI; Supabase Auth; Postgres RLS; Audit Log Service.

**Critérios de aceite**

1. Dado que um usuário acessa a plataforma por um cliente suportado, quando solicitar um recurso protegido, então JWT, papel e concessionária devem limitar a operação e os dados retornados.
2. Dado que uma chamada atravessa API, ML ou banco, quando ocorrer sucesso ou falha relevante, então o contrato e a trilha de auditoria devem permitir entender o resultado sem expor segredo.

**Critérios de pronto**

- A autenticação e o RBAC cobrem as rotas protegidas.
- RLS aplica isolamento por concessionária.
- Contratos e eventos de auditoria estão documentados.

#### FT-3.1 · Autenticação e isolamento por concessionária

Validar identidade, papel e limite de acesso aos dados de cada concessionária.

**Critérios de aceite**

1. Dado que um usuário tem ou não tem o papel requerido, quando solicitar uma rota ou registro protegido, então a API e o banco devem permitir apenas operações dentro do seu escopo.

**Critérios de pronto**

- Cenários positivos e negativos cobrem JWT, RBAC e RLS.
- As permissões por perfil estão descritas para a equipe.

##### PBI-3.1.1 · Validar JWT e aplicar RBAC por perfil

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 8 SP · **Sprint:** Sprint 1

**Como:** Administrador da organização.

**Quero:** controlar as operações de analista, gestor e administrador.

**Para:** evitar acesso ou alteração por um perfil sem autorização.

**Arquitetura relacionada:** Supabase Auth; Auth Plugin JWT + RBAC; roles analista, gestor e admin; API Gateway.

**Critérios de aceite**

1. Dado que uma rota protegida recebe uma chamada sem token ou com token expirado, quando a API autorizar a chamada, então a API deve responder 401 sem executar a operação.
2. Dado que um usuário autenticado não tem o perfil exigido, quando chamar uma operação administrativa, então a API deve responder 403 e não alterar o recurso.
3. Dado que um usuário com papel autorizado chama a operação permitida, quando o token for validado, então a operação deve prosseguir e registrar o ator responsável.

**Predecessores técnicos:** Nenhum predecessor técnico.

**Critério de pronto para este item**

- As regras de rota estão documentadas por perfil.
- Os testes cobrem token ausente, expirado e perfil insuficiente.
- Os tokens nunca aparecem nos logs.

##### PBI-3.1.2 · Isolar registros por concessionária com RLS

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 2

**Como:** Administrador de concessionária.

**Quero:** garantir que cada concessionária consulte somente seus próprios clientes e leads.

**Para:** evitar exposição cruzada de dados entre lojas.

**Arquitetura relacionada:** Supabase Postgres; RLS por dealership; clients, vehicles, leads, predictions e acoes_retencao.

**Critérios de aceite**

1. Dado que um analista autenticado pertence à concessionária A, quando consultar registros da concessionária A, então o banco deve retornar apenas registros permitidos para A.
2. Dado que o mesmo analista tenta consultar um registro exclusivo da concessionária B, quando a consulta chegar ao banco, então a política RLS deve negar o acesso mesmo se a API não enviar um filtro de dealership.
3. Dado que um usuário com permissão de administrador da organização, quando executar uma operação administrativa prevista, então a política deve permitir somente o escopo descrito para esse perfil.

**Predecessores técnicos:** PBI-3.1.1

**Critério de pronto para este item**

- As políticas RLS cobrem leitura e escrita das tabelas com dados de loja.
- Testes verificam acesso permitido e bloqueado.
- Nenhum teste usa dado pessoal real.

#### FT-3.2 · Contratos REST e fluxos web/mobile

Manter respostas previsíveis e fluxos equivalentes nos clientes web e mobile.

**Critérios de aceite**

1. Dado que um cliente web ou mobile chama uma operação, quando a API processar a chamada, então o contrato OpenAPI, o status e o corpo da resposta devem ser previsíveis.

**Critérios de pronto**

- A documentação descreve autenticação, dados e erros.
- Os fluxos de uso críticos foram conferidos em web e mobile.

##### PBI-3.2.1 · Documentar contratos REST e padronizar validação e erros

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 3 SP · **Sprint:** Sprint 1

**Como:** Desenvolvedor de aplicações.

**Quero:** consultar contratos OpenAPI e respostas de erro consistentes.

**Para:** integrar web, mobile e consumidores da API sem adivinhar o comportamento.

**Arquitetura relacionada:** API REST OpenAPI 3.0; Fastify; Zod; Swagger UI em /docs.

**Critérios de aceite**

1. Dado que um cliente chama uma rota com entrada inválida, quando a validação Zod rejeitar o payload, então a API deve retornar status e corpo de erro documentados sem stack trace.
2. Dado que uma operação foi concluída, quando o cliente consultar a resposta, então o status HTTP deve corresponder à operação e ao recurso afetado.
3. Dado que uma rota está disponível na API, quando a documentação OpenAPI for consultada, então o schema, a autenticação e os erros conhecidos devem estar descritos.

**Predecessores técnicos:** Nenhum predecessor técnico.

**Critério de pronto para este item**

- A documentação OpenAPI corresponde às rotas registradas.
- Os cenários de validação e erro têm exemplos.
- A API não retorna stack trace nem segredo em ambiente produtivo.

##### PBI-3.2.2 · Concluir os fluxos principais nos clientes web e mobile

**Prioridade:** Necessário (Azure Priority 2) · **Esforço:** 5 SP · **Sprint:** Sprint 2

**Como:** Vendedor da concessionária.

**Quero:** entrar no sistema e abrir carteira, cliente e comparação nos dispositivos usados pela loja.

**Para:** usar a plataforma durante o atendimento sem perder o contexto de autorização.

**Arquitetura relacionada:** Faro AI Web Next.js; Faro AI Mobile Expo; API Gateway; Supabase Auth.

**Critérios de aceite**

1. Dado que um usuário válido está autenticado, quando abrir as telas de carteira, cliente e comparação, então cada tela deve usar a API com o token atual e exibir estados de carregamento, sucesso e erro.
2. Dado que a sessão expira ou o usuário encerra a sessão, quando abrir uma rota protegida, então o cliente deve solicitar nova autenticação e não manter dados privados visíveis.
3. Dado que o usuário não tem acesso a um recurso, quando abrir esse recurso pelo app, então o app deve apresentar a negação sem expor conteúdo em cache.

**Predecessores técnicos:** PBI-3.1.1, PBI-3.2.1, PBI-2.2.1, PBI-1.2.1

**Critério de pronto para este item**

- Os caminhos críticos foram verificados em web e mobile.
- O armazenamento de sessão segue a política documentada do cliente.
- As falhas de API têm mensagem recuperável e não exibem dados privados.

#### FT-3.3 · Auditoria e observabilidade

Registrar eventos de segurança e negócio com contexto útil e sem dados pessoais desnecessários.

**Critérios de aceite**

1. Dado que ocorre um evento relevante de segurança ou negócio, quando a equipe consultar o log, então o evento deve mostrar ator, horário, resultado e correlação sem revelar PII.

**Critérios de pronto**

- Eventos críticos têm estrutura comum e redação de dados sensíveis.
- O registro de ação permite distinguir sucesso, falha e timeout.

##### PBI-3.3.1 · Registrar eventos estruturados com redação de dados pessoais

**Prioridade:** Necessário (Azure Priority 2) · **Esforço:** 5 SP · **Sprint:** Sprint 3

**Como:** Administrador da organização.

**Quero:** consultar eventos de autenticação, mudanças críticas e ações de retenção.

**Para:** investigar falhas e provar quem fez cada ação sem expor dados pessoais nos logs.

**Arquitetura relacionada:** Pino; Audit Log Service; audit_log; email_logs; observabilidade da API, ML e web.

**Critérios de aceite**

1. Dado que um usuário realiza login, falha de autenticação ou alteração crítica, quando o sistema registrar o evento, então o log deve incluir data, resultado, identificador de correlação e ator autorizado.
2. Dado que um evento contém CPF, e-mail, telefone, token ou VIN identificável, quando o logger serializar o evento, então o valor sensível deve ser omitido ou pseudonimizado conforme a política.
3. Dado que uma ação externa de retenção falha, quando a equipe consultar auditoria, então o registro deve mostrar resultado e código de erro sem armazenar segredo do provedor.

**Predecessores técnicos:** PBI-3.1.1

**Critério de pronto para este item**

- O schema de evento e as regras de redação estão documentados.
- Os eventos de risco previstos podem ser localizados por correlação.
- A verificação de logs não encontra PII nem segredo nos exemplos de teste.

### EP-4 · Qualidade, conformidade e entrega

Planejar e demonstrar a qualidade do produto desde os critérios de aceite até a validação final da Sprint.

**Rastreabilidade:** Todos os componentes FaroAI: web, mobile, API, ML, Supabase, provedores externos, Auth, RBAC e trilha de auditoria.

**Critérios de aceite**

1. Dado que um requisito obrigatório está no backlog, quando a equipe avaliar sua entrega, então deve existir prioridade, esforço, dependências, cenário BDD e evidência verificável.
2. Dado que a Sprint 4 está pronta para apresentação, quando a equipe concluir a entrega, então o plano cloud, as permissões e o vídeo pitch/técnico devem atender aos critérios do PDF.

**Critérios de pronto**

- Epics, Features, PBIs e tarefas estão ligados e priorizados.
- A carga de pontos está distribuída entre Sprints com premissas registradas.
- O plano final tem evidência, riscos e link Azure DevOps após publicação.

#### FT-4.1 · Estratégia de teste e automação

Definir rastreabilidade BDD e cobrir contratos e fluxos críticos com verificações repetíveis.

**Critérios de aceite**

1. Dado que uma mudança altera web, mobile, API ou ML, quando a equipe submeter a alteração, então os testes e gates aplicáveis devem produzir um resultado visível.

**Critérios de pronto**

- Os cenários BDD estão ligados a arquitetura e componentes.
- Os testes repetíveis cobrem os fluxos de maior risco.

##### PBI-4.1.1 · Definir estratégia de testes e rastreabilidade da arquitetura ao aceite

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 3 SP · **Sprint:** Sprint 3

**Como:** Equipe Faro AI.

**Quero:** relacionar elementos ArchiMate, requisitos, PBIs, cenários de teste e evidências.

**Para:** demonstrar que o backlog cobre os fluxos e riscos do projeto.

**Arquitetura relacionada:** FaroAI_Architecture.archimate; fluxos de Comparação Competitiva, Classificação Preditiva e Ação de Retenção.

**Critérios de aceite**

1. Dado que cada Epic e Feature está ligado a um componente ou fluxo da arquitetura, quando a matriz de rastreabilidade for revisada, então cada PBI obrigatório deve apontar pelo menos um critério de aceite e uma evidência esperada.
2. Dado que um requisito de qualidade não tem cobertura planejada, quando a equipe revisar a matriz, então o requisito deve receber um responsável e uma decisão de escopo.

**Predecessores técnicos:** Nenhum predecessor técnico.

**Critério de pronto para este item**

- A matriz liga arquitetura, backlog, cenários e evidências.
- Definition of Ready e Definition of Done estão registradas no plano.
- A equipe revisou a estratégia e os pontos em Planning Poker.

##### PBI-4.1.2 · Automatizar testes de contrato da API REST

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 3

**Como:** Desenvolvedor de API.

**Quero:** executar cenários automatizados de sucesso, erro, autenticação e autorização.

**Para:** detectar regressões nos endpoints usados por web, mobile e serviços externos.

**Arquitetura relacionada:** Fastify; Zod; OpenAPI; rotas clients, vehicles, leads, insights, metrics e acoes.

**Critérios de aceite**

1. Dado que uma rota recebe uma requisição válida de um perfil autorizado, quando o teste de integração executar, então o teste deve verificar status, schema e efeito esperado.
2. Dado que uma rota recebe entrada inválida, token ausente ou papel insuficiente, quando o teste executar, então o teste deve verificar o status e a resposta de erro sem alteração de dados.

**Predecessores técnicos:** PBI-3.1.1, PBI-3.2.1, PBI-4.1.1

**Critério de pronto para este item**

- Os cenários críticos têm dados sintéticos e são repetíveis.
- A suíte roda por comando local e pode ser chamada pelo CI.
- Falhas mostram rota, cenário e resultado esperado.

##### PBI-4.1.3 · Validar os fluxos críticos da aplicação web e mobile

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 3

**Como:** Vendedor da concessionária.

**Quero:** executar os fluxos de login, comparação, carteira, cliente e ação.

**Para:** encontrar falhas que testes isolados de API não mostram.

**Arquitetura relacionada:** Faro AI Web Next.js; Faro AI Mobile Expo; API Gateway; Auth.

**Critérios de aceite**

1. Dado que um usuário sintético tem acesso à concessionária de teste, quando executar login, abrir carteira, abrir cliente e iniciar comparação, então o fluxo deve concluir e mostrar os dados esperados em cada cliente suportado.
2. Dado que a sessão termina ou a API devolve erro, quando o usuário continua o fluxo, então a interface deve proteger os dados e oferecer uma saída recuperável.

**Predecessores técnicos:** PBI-3.2.2, PBI-4.1.1, PBI-4.1.2

**Critério de pronto para este item**

- Os caminhos críticos têm resultado para web e mobile.
- Os defeitos bloqueadores têm item ligado e responsável.
- As evidências não usam dados de clientes reais.

##### PBI-4.1.4 · Automatizar testes de contrato e regressão do serviço ML

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 4

**Como:** Desenvolvedor de Machine Learning.

**Quero:** validar entrada, saída, limites e comportamento de falha do serviço ML.

**Para:** evitar que mudanças no modelo quebrem a priorização de clientes.

**Arquitetura relacionada:** FastAPI; XGBoost; API Gateway; pipeline de pseudonimização; predictions.

**Critérios de aceite**

1. Dado que o serviço recebe um payload válido e sem PII, quando a inferência executar, então a resposta deve corresponder ao schema e manter os limites definidos.
2. Dado que o serviço recebe campo inválido ou assinatura HMAC incorreta, quando validar a requisição, então deve rejeitar a chamada sem produzir uma predição.
3. Dado que o conjunto sintético de regressão é executado em uma versão fixada, quando o teste comparar as métricas e classes esperadas, então qualquer desvio além do limite acordado deve falhar e mostrar a diferença.

**Predecessores técnicos:** PBI-2.1.1, PBI-4.1.1

**Critério de pronto para este item**

- Testes cobrem payload, autenticação entre serviços e resposta.
- O teste usa conjunto sintético ou anonimizado versionado.
- O relatório registra versão do código e do modelo.

##### PBI-4.1.5 · Executar gates de qualidade para os componentes no CI

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 3

**Como:** Equipe Faro AI.

**Quero:** executar verificações de qualidade para API, web, mobile, ML e segredos em pull requests.

**Para:** bloquear regressões antes de integrar mudanças.

**Arquitetura relacionada:** GitHub Actions; apps/api; apps/web; apps/mobile; services/ml; Gitleaks.

**Critérios de aceite**

1. Dado que uma pull request altera um componente, quando o workflow de CI executar, então as verificações aplicáveis ao componente devem rodar e publicar resultado.
2. Dado que typecheck, testes ou secret scanning falham, quando o CI concluir, então a verificação deve falhar e impedir o merge protegido.
3. Dado que a execução passa, quando a equipe abrir o resultado do workflow, então o resumo deve indicar commit, jobs executados e artefatos de evidência.

**Predecessores técnicos:** PBI-4.1.2, PBI-4.1.3

**Critério de pronto para este item**

- O workflow cobre API, web, mobile, ML e secret scanning.
- O comando de cada job funciona no ambiente do CI.
- A política de branch protege o merge com os gates acordados.

#### FT-4.2 · Conformidade, integração e confiabilidade

Relacionar controles de segurança e privacidade a evidências e validar a solução integrada.

**Critérios de aceite**

1. Dado que um controle OWASP ou LGPD se aplica ao fluxo, quando a equipe revisar a solução, então o controle deve ter evidência ou uma lacuna com responsável e ação.
2. Dado que um fluxo integrado está na lista de release, quando a equipe executar a validação, então o resultado deve registrar ambiente, build, falhas e limites medidos.

**Critérios de pronto**

- A checklist cobre os controles e fluxos relevantes.
- Os resultados distinguem meta planejada de medida comprovada.

##### PBI-4.2.1 · Mapear controles OWASP e LGPD a evidências da FaroAI

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 3 SP · **Sprint:** Sprint 3

**Como:** Responsável por segurança e privacidade.

**Quero:** relacionar riscos e controles do projeto a OWASP ASVS, OWASP API Top 10, OWASP Mobile Top 10 e LGPD.

**Para:** demonstrar cobertura, lacunas e ações de segurança contínua.

**Arquitetura relacionada:** docs/SECURITY.md; STRIDE; Auth/RBAC; RLS; API; Mobile; ML; audit_log; dados de cliente.

**Critérios de aceite**

1. Dado que um controle aplicável foi selecionado, quando a equipe preencher a matriz, então a matriz deve indicar requisito, componente, evidência, estado e responsável.
2. Dado que um controle não está implementado ou não tem evidência, quando a revisão for concluída, então a lacuna deve ter risco, prioridade e ação de tratamento.
3. Dado que um fluxo trata dado pessoal ou telemetria, quando a equipe avaliar LGPD, então a finalidade, acesso, retenção e descarte devem estar descritos.

**Predecessores técnicos:** PBI-3.1.1, PBI-3.1.2, PBI-3.3.1, PBI-4.1.1

**Critério de pronto para este item**

- A matriz cobre API, mobile, ML, banco, integrações e dados pessoais.
- As lacunas têm prioridade e ação responsável.
- A checklist final é revisada pela equipe.

##### PBI-4.2.2 · Validar os fluxos integrados de comparação e retenção

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 8 SP · **Sprint:** Sprint 4

**Como:** Equipe Faro AI.

**Quero:** executar os fluxos de comparação e retenção através de web/mobile, API, ML e banco.

**Para:** confirmar que os componentes da arquitetura funcionam juntos antes da demonstração final.

**Arquitetura relacionada:** Faro AI Web; Faro AI Mobile; API Gateway; Aggregator; ML Service; Supabase; provedores externos.

**Critérios de aceite**

1. Dado que um usuário sintético inicia comparação de veículos, quando o fluxo passa pelo cliente, API e serviços de dados, então a comparação deve exibir campos, fontes e erros esperados.
2. Dado que um usuário autorizado abre um lead de teste, quando consultar perfil, visão 360 e ação de retenção, então o sistema deve respeitar a autorização e registrar o resultado da ação.
3. Dado que um serviço externo está indisponível, quando executar o fluxo dependente, então o sistema deve mostrar a falha conhecida e preservar dados já confirmados.

**Predecessores técnicos:** PBI-1.2.1, PBI-2.3.1, PBI-3.2.2, PBI-4.1.2, PBI-4.1.3, PBI-4.1.4

**Critério de pronto para este item**

- Os dois fluxos passam em ambiente de demonstração controlado.
- Os defeitos bloqueadores estão corrigidos ou têm decisão explícita.
- A equipe guarda evidência de execução com versão do build.

##### PBI-4.2.3 · Verificar metas de desempenho e comportamento sob falha

**Prioridade:** Necessário (Azure Priority 2) · **Esforço:** 5 SP · **Sprint:** Sprint 4

**Como:** Gestor de pós-venda.

**Quero:** verificar o tempo das telas e do ranking em uma carga representativa.

**Para:** identificar gargalos antes de apresentar a solução.

**Arquitetura relacionada:** Painel de Carteira; API; Supabase Postgres; ML Service; observabilidade.

**Critérios de aceite**

1. Dado que um conjunto de demonstração representativo está carregado, quando a equipe medir abertura de tela e ordenação dos leads, então os resultados devem ser comparados às metas de menos de 2 s para tela e menos de 1 s para ranking indicadas no pitch.
2. Dado que o serviço ML, o provedor de IA ou o e-mail não responde, quando a equipe executar o cenário de falha, então o sistema deve apresentar fallback seguro e registrar o evento.
3. Dado que o produto ainda não tem telemetria de produção, quando a equipe avaliar disponibilidade de 99,5%, então o valor deve ser registrado como meta pendente de medição, não como resultado comprovado.

**Predecessores técnicos:** PBI-4.2.2, PBI-3.3.1

**Critério de pronto para este item**

- O relatório mostra ambiente, volume, método e resultados observados.
- Metas sem ambiente de produção aparecem como pendentes de medição.
- As falhas simuladas não expõem dados nem criam ações duplicadas.

##### PBI-4.2.4 · Consolidar checklist de release e evidências de qualidade

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 4

**Como:** Scrum Master.

**Quero:** consultar resultados, riscos abertos, versões e aprovação da equipe em um único registro.

**Para:** entregar uma demonstração verificável e reduzir dúvidas sobre o estado da solução.

**Arquitetura relacionada:** Azure Boards; GitHub Actions; documentação de qualidade; FaroAI_Architecture.archimate.

**Critérios de aceite**

1. Dado que as verificações previstas para release terminaram, quando o responsável fechar o checklist, então o registro deve listar build, testes, evidências, riscos conhecidos e decisão da equipe.
2. Dado que um gate obrigatório falhou ou não foi executado, quando a equipe avaliar a entrega, então o checklist não pode marcar a solução como aprovada sem uma decisão registrada.

**Predecessores técnicos:** PBI-4.2.1, PBI-4.2.2, PBI-4.2.3

**Critério de pronto para este item**

- Os resultados apontam para evidências no repositório ou Azure Boards.
- Riscos aceitos têm justificativa e responsável.
- O checklist foi revisado pela equipe.

#### FT-4.3 · Projeto Azure DevOps e apresentação final

Publicar o plano na nuvem com as permissões exigidas e apresentar a solução no vídeo final.

**Critérios de aceite**

1. Dado que a equipe publicou o backlog na organização, quando o professor abrir o projeto, então ele deve ter acesso Basic e permissão Project Administrator.
2. Dado que o roteiro técnico foi validado, quando a equipe entregar o vídeo, então o conteúdo deve cobrir pitch e demonstração técnica em até seis minutos.

**Critérios de pronto**

- O link e a permissão do professor foram conferidos.
- O vídeo final está publicado e disponível nas tarefas da Sprint 4.

##### PBI-4.3.1 · Publicar o plano Scrum no Azure DevOps e conceder acesso ao professor

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 2 SP · **Sprint:** Sprint 4

**Como:** Scrum Master.

**Quero:** ter um plano acessível na nuvem com o professor como membro Basic e administrador do projeto.

**Para:** cumprir a forma de entrega indicada para a atividade.

**Arquitetura relacionada:** Azure DevOps Boards; backlog Scrum; organização e projeto da equipe.

**Critérios de aceite**

1. Dado que a organização e o projeto Azure DevOps estão disponíveis, quando a equipe importar a hierarquia e conferir os campos, então o backlog deve conter Epics, Features e PBIs com as relações pai/filho corretas.
2. Dado que a equipe informa a conta institucional correta do professor, quando o administrador adicioná-lo à organização e ao projeto, então o professor deve ter nível Basic e permissão de Project Administrator.
3. Dado que o plano foi publicado e o acesso foi conferido, quando a equipe registrar a evidência, então o item deve conter o link acessível e uma captura das permissões.

**Predecessores técnicos:** PBI-4.1.1

**Critério de pronto para este item**

- A equipe conferiu a hierarquia, iterações, dependências e estimativas no Azure Boards.
- O professor tem o nível Basic e a função Project Administrator.
- O link do projeto foi testado em uma sessão autorizada e anexado à entrega.

##### PBI-4.3.2 · Gravar e entregar o vídeo pitch/técnico final

**Prioridade:** Obrigatório (Azure Priority 1) · **Esforço:** 5 SP · **Sprint:** Sprint 4

**Como:** Equipe Faro AI.

**Quero:** apresentar problema, solução, diferenciais, arquitetura, tecnologia e demonstração.

**Para:** entregar a visão de negócio e a explicação técnica da solução dentro do limite da Sprint 4.

**Arquitetura relacionada:** Fluxos completos FaroAI; Faro AI Web e Mobile; API; ML; Supabase; arquitetura TOGAF/ArchiMate.

**Critérios de aceite**

1. Dado que a equipe finalizou o roteiro e validou a demonstração, quando gravar o vídeo, então o vídeo deve durar no máximo 6 minutos e cobrir pitch e parte técnica.
2. Dado que o vídeo final foi aprovado pela equipe, quando a equipe entregar a Sprint 4, então o mesmo link deve estar publicado na tarefa de cada disciplina participante no Teams.

**Predecessores técnicos:** PBI-4.2.4, PBI-4.3.1

**Critério de pronto para este item**

- O vídeo respeita o limite de 6 minutos do Ford_V2.pdf.
- Todos os participantes e componentes técnicos previstos aparecem ou são citados.
- O link foi verificado e entregue nos espaços requeridos.

## Detalhamento da Sprint atual

**Sprint:** Sprint 3 · **Meta:** Completar ações auditáveis e estabelecer a estratégia de testes, os gates de CI e a revisão de conformidade. · **Total:** 31 SP.

As estimativas das tarefas também são pontos Planning Poker para atender à rubrica. No processo Scrum do Azure Boards, Task costuma ser estimada em horas. Guarde os pontos na descrição ou crie um campo de pontos se a organização já tiver esse padrão.

| ID | PBI pai | Tarefa | Descrição | SP | Dependências técnicas | Saída verificável |
|---|---|---|---|---:|---|---|
| T-401.1 | PBI-4.1.1 | Montar a matriz de rastreabilidade BDD | Relacionar elementos do ArchiMate, riscos e requisitos a PBIs, cenários Dado/Quando/Então e evidências. | 2 | Nenhuma | Matriz revisável com responsável por lacuna. |
| T-401.2 | PBI-4.1.1 | Definir critérios de pronto e saída da Sprint | Acordar Definition of Ready, Definition of Done e regras para aceitar uma evidência de teste. | 1 | T-401.1 | Critérios registrados no plano do Azure Boards. |
| T-402.1 | PBI-4.1.2 | Escrever cenários de contrato para as rotas críticas | Cobrir resposta válida, schema inválido, autenticação ausente e papel sem permissão nas rotas usadas por leads, clientes, veículos e ações. | 2 | T-401.1, PBI-3.2.1 | Cenários executáveis e dados sintéticos. |
| T-402.2 | PBI-4.1.2 | Automatizar os cenários de autorização e isolamento | Verificar token ausente, token inválido, papel insuficiente e tentativa de leitura entre concessionárias. | 3 | T-402.1, PBI-3.1.1, PBI-3.1.2 | Suíte API com resultados positivos e negativos. |
| T-403.1 | PBI-4.1.3 | Preparar cenários web e mobile de maior risco | Definir passos e resultado esperado para login, comparação, carteira, visão do cliente e ação de retenção. | 2 | T-401.1, PBI-3.2.2 | Roteiro de aceitação com dados sintéticos. |
| T-403.2 | PBI-4.1.3 | Executar regressão web/mobile e guardar evidências | Executar os cenários no ambiente combinado, registrar versão, resultado e defeitos sem usar dados reais de clientes. | 3 | T-403.1, T-402.2 | Resultados por plataforma e itens de defeito vinculados. |
| T-405.1 | PBI-4.1.5 | Ampliar os jobs de CI para os componentes web e mobile | Adicionar verificações de typecheck e build para web e mobile e manter os jobs existentes de API, ML e Gitleaks. | 3 | T-402.1, T-403.1 | Workflow executável em pull request. |
| T-405.2 | PBI-4.1.5 | Publicar resultados e definir condições de bloqueio | Configurar o resumo dos jobs e acordar quais falhas impedem integração do código. | 2 | T-405.1 | Resultado do CI visível e política de branch registrada. |
| T-406.1 | PBI-4.2.1 | Mapear OWASP e LGPD aos controles do projeto | Relacionar ASVS, OWASP API Top 10, OWASP Mobile Top 10 e LGPD aos componentes, controles e evidências existentes. | 2 | T-401.1 | Checklist com estado e referência de evidência. |
| T-406.2 | PBI-4.2.1 | Revisar fluxos de dados pessoais e registrar lacunas | Revisar payload ML, logs, cadastro, envio de e-mail, retenção e acesso por concessionária; atribuir responsável às lacunas. | 1 | T-406.1, T-305.1 | Riscos priorizados com ação e responsável. |
| T-305.1 | PBI-3.3.1 | Definir schema de evento e regras de redação | Definir campos de auditoria, identificador de correlação, resultados e tratamento de CPF, e-mail, telefone, VIN e tokens. | 2 | T-401.1, PBI-3.1.1 | Schema de auditoria e exemplos sem PII. |
| T-305.2 | PBI-3.3.1 | Instrumentar eventos de autenticação e mudanças críticas | Verificar emissão de logs para falhas de login, alterações administrativas e resultado de ações externas. | 3 | T-305.1 | Eventos localizáveis por correlação e sem segredo. |
| T-205.1 | PBI-2.3.1 | Validar autorização e base legal antes do envio | Impedir envio por perfil sem permissão ou quando o registro de contato autorizado estiver ausente. | 3 | PBI-3.1.1, T-406.2 | Cenários de envio autorizado e bloqueado. |
| T-205.2 | PBI-2.3.1 | Persistir resultado da comunicação sem duplicação | Registrar sucesso, falha ou timeout e garantir que a repetição da mesma solicitação não envie e-mail duplicado. | 2 | T-205.1, T-305.1 | Registro de ação auditável com chave de idempotência. |

### Dependências entre PBIs

| PBI | Predecessores que devem ser ligados no Azure Boards |
|---|---|
| PBI-1.1.2 | PBI-1.1.1 |
| PBI-1.2.1 | PBI-1.1.2 |
| PBI-1.2.2 | PBI-1.1.1, PBI-1.1.2 |
| PBI-2.1.1 | PBI-3.1.1, PBI-3.1.2 |
| PBI-2.1.2 | PBI-2.1.1 |
| PBI-2.2.1 | PBI-2.1.1, PBI-2.1.2, PBI-3.1.2 |
| PBI-2.2.2 | PBI-2.2.1, PBI-3.1.2 |
| PBI-2.3.1 | PBI-2.2.2, PBI-3.1.1, PBI-3.3.1 |
| PBI-3.1.2 | PBI-3.1.1 |
| PBI-3.2.2 | PBI-3.1.1, PBI-3.2.1, PBI-2.2.1, PBI-1.2.1 |
| PBI-3.3.1 | PBI-3.1.1 |
| PBI-4.1.2 | PBI-3.1.1, PBI-3.2.1, PBI-4.1.1 |
| PBI-4.1.3 | PBI-3.2.2, PBI-4.1.1, PBI-4.1.2 |
| PBI-4.1.4 | PBI-2.1.1, PBI-4.1.1 |
| PBI-4.1.5 | PBI-4.1.2, PBI-4.1.3 |
| PBI-4.2.1 | PBI-3.1.1, PBI-3.1.2, PBI-3.3.1, PBI-4.1.1 |
| PBI-4.2.2 | PBI-1.2.1, PBI-2.3.1, PBI-3.2.2, PBI-4.1.2, PBI-4.1.3, PBI-4.1.4 |
| PBI-4.2.3 | PBI-4.2.2, PBI-3.3.1 |
| PBI-4.2.4 | PBI-4.2.1, PBI-4.2.2, PBI-4.2.3 |
| PBI-4.3.1 | PBI-4.1.1 |
| PBI-4.3.2 | PBI-4.2.4, PBI-4.3.1 |

## Publicação no Azure DevOps

O ambiente não tem uma conexão Azure Boards disponível. O projeto, os work items e o convite do professor ainda não foram publicados. Use o CSV para importar a hierarquia depois de selecionar ou criar a organização e o projeto.

1. Crie ou selecione um projeto Azure DevOps com o processo Scrum.
2. Abra Boards > Queries > Import work items e selecione Backlog_FaroAI_Azure_Boards.csv.
3. Confira o preview, corrija campos incompatíveis e salve os itens.
4. Configure Area Path e Iteration Path com os nomes reais da organização.
5. Adicione os links Predecessor indicados neste plano. O CSV cria a hierarquia pai/filho, mas não importa os demais tipos de link.
6. Confirme os pontos por Planning Poker e revise o balanceamento das Sprints.
7. Adicione o professor à organização com acesso Basic e ao projeto como Project Administrator.
8. Teste o link do projeto e anexe o link e a evidência de permissão à entrega.

Os arquivos consultados não identificam a organização nem o e-mail institucional do professor. A pessoa responsável pela organização precisa inserir a conta correta. Não registre credenciais ou tokens no repositório.

O importador CSV do Azure Boards cria hierarquias por títulos indentados. Os campos e tipos disponíveis variam conforme o processo e a organização. Confira o preview antes de salvar. Consulte a documentação oficial de [import CSV do Azure Boards](https://learn.microsoft.com/en-us/azure/devops/boards/queries/import-work-items-from-csv?view=azure-devops).

## Evidências usadas

- [Arquitetura FaroAI no repositório](FaroAI_Architecture.archimate)
- [README e visão do produto FaroAI](../../README.md)
- [Política de segurança e privacidade](../SECURITY.md)
- [Workflow CI atual](../../.github/workflows/ci.yml)
- [Checklist de entregas existente](CHECKLIST_ENTREGAS.md)
- [Documentação oficial de import CSV no Azure Boards](https://learn.microsoft.com/en-us/azure/devops/boards/queries/import-work-items-from-csv?view=azure-devops)

## Entrega da atividade

Após publicar o plano, registre o link Azure DevOps nesta linha: **Link do projeto:** a inserir após a publicação.

Confirme no projeto cloud os cinco critérios de 20% do PDF: hierarquia de backlog; descrições, critérios de aceite e pronto em BDD; prioridade, esforço, dependências e ordenação; release plan; e tarefas detalhadas da Sprint atual.
