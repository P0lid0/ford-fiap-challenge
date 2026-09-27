# Segurança do Faro AI

Este documento descreve os controles do Sprint 3 para a API Fastify, o app Expo,
o site Next.js, o serviço ML FastAPI e o banco Supabase. O escopo não inclui IoT,
MQTT ou dispositivos conectados.

| Área do sprint | Peso | Estado neste repositório |
|---|---:|---|
| DevSecOps e pipeline | 3,0 | Workflow de CI, análise estática, auditoria de dependências e secret scan configurados |
| Segurança de código e infraestrutura | 2,5 | Validação, RBAC, RLS, gestão de segredos e controles de rede no código |
| Monitoramento e resposta a incidentes | 2,0 | Logs estruturados e trilha de auditoria; alertas e centralização dependem do deploy |
| Compliance e segurança contínua | 2,5 | Minimização e controles de acesso; retenção, avaliação legal e operação contínua pendentes |

Um controle marcado como configurado existe no código ou no workflow. Isso não
significa que a execução do CI ou a configuração de produção já foi verificada.

## DevSecOps e pipeline

O workflow `.github/workflows/ci.yml` roda em pull requests e pushes para `main`.
Ele verifica tipos no API, no site e no app mobile. O job ML treina o modelo e
roda os testes que já faziam parte do workflow.

O pipeline também configura estes controles:

- **SAST:** Semgrep analisa API, site, app e serviço ML.
- **SCA:** `pnpm audit` e `pip-audit` verificam dependências vulneráveis.
- **Secret scanning:** Gitleaks analisa o histórico completo do Git.
- **Atualizações:** Dependabot abre pull requests semanais para pacotes e GitHub Actions.
- **Instalação reproduzível:** CI instala JavaScript com `pnpm install --frozen-lockfile`.

Configure proteção de branch no GitHub para exigir os jobs antes do merge. O
workflow, sozinho, não bloqueia merges pelas configurações do repositório.

## Segurança de código e infraestrutura

### Entrada, acesso e banco

- As rotas Fastify validam parâmetros, consultas e corpos com Zod.
- O plugin de autenticação valida o bearer token no Supabase Auth e carrega o
  perfil do usuário.
- `requireRole` limita operações de escrita do catálogo, importação e gestão de
  clientes a `gestor` e `admin`. Configuração de chaves de IA exige `admin`.
- A política de perfil não permite que um usuário altere o próprio role ou a
  própria concessionária.
- Consultas de clientes, leads, métricas, ações e modelos usam o JWT do usuário
  para que o RLS do Supabase aplique o escopo. Gestores mantêm o acesso de rede
  definido na política existente.
- Funções SQL de leads e métricas usam `SECURITY INVOKER`, limitam resultados e
  não concedem execução a `anon` ou `PUBLIC`.
- Operações que precisam da chave `service_role` fazem verificações de papel e
  concessionária na API. A chave ignora RLS e fica somente no backend.
- Chaves de provedores configuradas pela tela admin ficam na tabela `ai_keys`;
  o app retorna apenas se estão configuradas, sem mostrar fragmentos. Antes de
  produção, mova esses valores para um secret manager e defina rotação.

### Rede, serviços e conteúdo remoto

- Fastify usa uma lista explícita de origens CORS, Helmet e limite de requisições
  por IP. `TRUST_PROXY` fica `false` por padrão.
- A API e o serviço ML não expõem Swagger em produção. O serviço ML não aceita
  CORS de qualquer origem.
- O ML exige bearer token com pelo menos 32 caracteres. O gateway assina o corpo
  de `/predict` com HMAC, timestamp e nonce. O serviço rejeita assinaturas
  vencidas e nonces repetidos.
- O cache de nonces do ML fica na memória do processo. Uma implantação com mais
  de um worker precisa de um armazenamento compartilhado para manter essa
  proteção entre workers.
- URLs de e-books aceitam apenas HTTPS nos domínios oficiais de fabricantes. O
  downloader valida cada redirecionamento e interrompe downloads acima de 30 MB.

O repositório não configura o proxy de produção, DNS, certificado TLS, firewall,
rede privada para ML, gestão de segredos ou backup Supabase. Em produção, termine
TLS em um proxy confiável e restrinja o acesso de rede ao ML. Defina
`TRUST_PROXY=true` somente quando a API aceitar tráfego por esse proxy.

### Dados e privacidade

- Novos CPFs são transformados em HMAC-SHA256 com `CLIENT_CPF_PEPPER`. Gere o
  segredo com `openssl rand -hex 32` e mantenha-o estável. O sistema não guarda
  o CPF original para recalcular hashes antigos.
- O app nativo armazena a sessão Supabase com `expo-secure-store`. O app web usa
  armazenamento do navegador.
- Logs HTTP não incluem query strings. O logger redige cabeçalhos de autorização
  e cookies. O plugin de auth não grava JWTs nem corpos de resposta do Supabase.
- O ML recebe atributos de compra e perfil, como idade, renda, score de crédito
  e modelo. O identificador da concessionária é pseudonimizado. Esses atributos
  continuam sendo dados pessoais; pseudonimização não é anonimização.
- A classificação híbrida e os insights podem enviar atributos financeiros e
  demográficos a um provedor de IA. Notas e histórico de ações também podem ser
  enviados à classificação híbrida. Essa rota remove padrões comuns de CPF,
  e-mail, telefone e VIN, mas não detecta todos os identificadores indiretos.

Antes de usar dados reais em produção, aprove os provedores de IA, a base legal,
os termos de tratamento, a transferência internacional e os prazos de retenção.
O repositório não implementa um calendário de retenção nem comprova exclusão
automática de dados.

## Monitoramento e resposta a incidentes

Fastify grava logs estruturados com Pino. Erros de autenticação, falhas do banco,
erros 5xx e falhas de gravação de auditoria aparecem no log. A API limita
requisições e retorna erros sem stack trace.

A tabela `audit_log` registra criação e alteração de clientes, ações de retenção,
envio de e-mail, alterações no catálogo e mudanças de configuração de IA. Só o
backend grava eventos. A gravação é best-effort: uma falha aparece no Pino e não
interrompe a operação. O RLS limita a leitura a administradores.

Este repositório não inclui um agregador de logs, alertas, painel de segurança,
plantão ou automação de resposta. Para um incidente, a equipe precisa conter o
serviço afetado, revogar e substituir as credenciais expostas, revisar os eventos
de auditoria e preservar os logs. O responsável por privacidade deve avaliar se
há obrigação de notificar a ANPD ou as pessoas afetadas.

## Compliance e segurança contínua

O escopo de dados inclui identificadores de cliente, dados de compra,
características demográficas e financeiras, notas de vendedores, previsões e
ações de retenção. O cliente e seus dados ficam vinculados à concessionária por
RLS e verificações da API.

Use os seguintes controles como referência para revisão:

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) para controles da API e do site.
- [OWASP API Security Top 10](https://owasp.org/API-Security/) para autorização por objeto, autenticação e consumo de recursos.
- [OWASP Mobile Application Security](https://owasp.org/www-project-mobile-app-security/) para armazenamento local e sessão no app.
- [Lei Geral de Proteção de Dados](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) para finalidade, necessidade, direitos e resposta a incidentes.

Revise os achados do SAST e do SCA em cada pull request. Atualize dependências
vulneráveis, revise a trilha de auditoria e reavalie o fluxo de dados quando
adicionar um provedor, campo pessoal ou integração.

### Pendências antes de produção

- Exigir os jobs de CI nas regras de proteção da branch `main`.
- Configurar TLS, proxy confiável, firewall e rede privada para o serviço ML.
- Guardar segredos em um secret manager e definir a rotação de cada segredo.
- Definir retenção, descarte, restauração de backup e responsáveis por incidentes.
- Aprovar contratos e fluxos de dados dos provedores de IA.
- Verificar alertas operacionais e executar um exercício de resposta a incidentes.
