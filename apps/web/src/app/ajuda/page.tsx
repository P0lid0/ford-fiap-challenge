'use client';
import { useState, useEffect } from 'react';
import {
  BookOpen, Users, Car, Sparkles, Settings, Shield, BarChart3, AlertTriangle,
  Megaphone, Brain, Database, ChevronRight, ChevronDown, Search, ArrowRight,
  CheckCircle2, Info, Zap, Lock, Eye, Target, Activity, Building2,
} from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PerfilBadge } from '@/components/PerfilBadge';

const GLOSSARY: { term: string; def: string }[] = [
  { term: 'VIN', def: 'Vehicle Identification Number — código único de 17 caracteres que identifica cada veículo individual.' },
  { term: 'VIN Share', def: 'Fração dos veículos vendidos pela rede Ford que continuam sendo atendidos pela rede oficial. Métrica principal de retenção pós-venda.' },
  { term: 'Churn', def: 'Taxa de abandono — % de clientes que deixaram de usar a rede num período. Inverso do VIN Share.' },
  { term: 'Perfil comportamental', def: 'Um dos 4 arquétipos descobertos via clustering: Fiel, Esquecido, Econômico, Abandono.' },
  { term: 'Risco de evasão', def: 'Score 0-1 que mistura probabilidade de Abandono + 60% da probabilidade de Esquecido. Quanto maior, mais urgente é a ação de retenção.' },
  { term: 'Data leakage', def: 'Erro de modelagem onde o modelo aprende com dados que ele não teria no momento da predição real (ex: usar revisões futuras pra prever quem vai voltar). Invalida o modelo.' },
  { term: 'Base 1 / Base 2', def: 'Base 1 = histórico completo (uso pra clustering). Base 2 = apenas dados da compra (uso pro classificador). Separação obrigatória pra evitar leakage.' },
  { term: 'XAI', def: 'eXplainable AI — fazer a IA explicar suas decisões em linguagem natural. No FordIQ, cada classificação tem um insight gerado em PT-BR.' },
  { term: 'FIPE', def: 'Tabela de preço médio de veículos no Brasil, mantida pela Fundação Instituto de Pesquisas Econômicas. Atualizada mensalmente.' },
  { term: '411 Vehicle Data', def: 'API comercial (RapidAPI) com specs detalhadas de veículos USA — bom pra Ford, Chevrolet, RAM, Jeep. Cobertura BR limitada.' },
  { term: 'NHTSA vPIC', def: 'Vehicle Product Information Catalog do governo americano. Free, global, ótimo pra decodificar VIN.' },
  { term: 'RLS', def: 'Row Level Security — recurso nativo do Postgres. Garante que analistas de uma loja só veem dados da loja deles, mesmo se tentarem queries diretas.' },
  { term: 'HMAC', def: 'Hash-based Message Authentication Code. Usamos HMAC-SHA256 pra assinar payloads entre API gateway e ML service — garante integridade e previne manipulação.' },
  { term: 'Pseudonimização', def: 'Substituir identificadores diretos (UUID da loja, nome) por hashes irreversíveis antes de mandar pra modelo. LGPD compliance.' },
  { term: 'Tier rápido / smart', def: 'Convenção interna: tier "fast" usa modelos baratos (gpt-4o-mini, claude-haiku) pra extração e gap-fill. Tier "smart" usa modelos topo (gpt-4o, claude-sonnet) pra análises complexas.' },
  { term: 'Provenance', def: 'Rastreamento de origem de cada dado. Cada spec do catálogo carrega o tag da fonte que o produziu (manufacturer.com.br, fipe, 411, ai:gpt-4o-mini).' },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Por que a acurácia do modelo é "só" 60%?',
    a: 'O problema é socio-comportamental — dois clientes idênticos no papel podem ter comportamentos opostos. 60% é honesto. Modelos que clamam 90%+ pra esse tipo de problema geralmente têm data leakage (usaram dados que não estariam disponíveis no momento real da predição).',
  },
  {
    q: 'O cliente precisa saber que foi classificado?',
    a: 'Não. A classificação é interna, pra orientar a ação do consultor. O cliente vê apenas o resultado: lembretes, ofertas, convites a programas. Conforme LGPD, predições automatizadas são tratadas como decisão de suporte, não decisão final.',
  },
  {
    q: 'Posso confiar 100% nos specs dos carros?',
    a: 'Olhe o badge de fonte de cada campo. Verde = fonte oficial confirmada. Amarelo = 1 fonte oficial. Vermelho/âmbar = estimativa IA. Você decide se aceita ou edita manualmente — todo campo é editável.',
  },
  {
    q: 'Quanto custa rodar o sistema por mês?',
    a: 'MVP: ~US$ 50-100/mês. Supabase Pro $25 + hosting $20 + LLMs (gpt-4o-mini sob demanda) $30-100 + RapidAPI 411 free/$19. Custo escalável conforme uso de IA — fácil baixar removendo modelos premium se necessário.',
  },
  {
    q: 'Posso usar o sistema sem chave OpenAI?',
    a: 'Parcialmente. FIPE, scraping de fabricante e 411 funcionam sem IA. Mas comparativos IA, extração de PDF e insights XAI exigem pelo menos uma chave (OpenAI ou Anthropic).',
  },
  {
    q: 'Como adiciono uma nova marca ao scraping?',
    a: 'Edite o switch em apps/api/src/lib/data-sources/manufacturer.ts no case da marca, retornando a URL padrão da página do modelo. O extractor IA cuida do resto. Marcas que bloqueiam UA (ex: Honda) caem no fallback IA + 411 automaticamente.',
  },
];

const SECTIONS: Section[] = [
  // ===== INTRO =====
  {
    id: 'visao-geral',
    icon: BookOpen,
    title: 'Visão geral',
    summary: 'O que é o FordIQ e o que ele resolve',
    body: (
      <>
        <Lead>
          O <b>FordIQ</b> é a plataforma de inteligência da rede Ford brasileira. Centraliza
          duas frentes do <i>Ford × FIAP Challenge 2026</i>: <b>Inteligência Competitiva</b>
          {' '}(catálogo de veículos próprios e concorrentes com comparativo IA) e <b>Retenção VIN Share</b>
          {' '}(predição de perfil do cliente no ato da compra e ações de retenção orientadas por dados).
        </Lead>

        <H3>O que você consegue fazer aqui</H3>
        <Grid cols={2}>
          <FeatureCard icon={Car} title="Catálogo competitivo">
            Cadastrar veículos próprios e da concorrência com dados verificados de
            5+ fontes (FIPE, scraping da fabricante, e-book PDF, 411 API, IA).
            Comparar 2-5 lado a lado com análise IA.
          </FeatureCard>
          <FeatureCard icon={Users} title="Carteira de clientes">
            Cadastrar a venda no ato. Sistema classifica em 1 de 4 perfis
            comportamentais e sugere ações específicas pra cada um.
          </FeatureCard>
          <FeatureCard icon={AlertTriangle} title="Leads priorizados">
            Lista automática de clientes em alto risco de evasão, ordenada por
            probabilidade. Vendedor consegue agir antes do cliente sumir.
          </FeatureCard>
          <FeatureCard icon={Sparkles} title="Insights IA">
            Explicação em linguagem natural de cada classificação + análise
            estratégica da carteira da concessionária.
          </FeatureCard>
        </Grid>
      </>
    ),
  },

  // ===== CONCEITOS =====
  {
    id: 'os-4-perfis',
    icon: Users,
    title: 'Os 4 perfis de cliente',
    summary: 'Fiel, Esquecido, Econômico e Abandono — quem são e como tratar',
    body: (
      <>
        <Lead>
          Toda a estratégia de retenção é organizada em torno de 4 arquétipos de
          comportamento. Eles foram descobertos via clustering não-supervisionado
          (K-Means k=4) sobre o histórico completo de clientes Ford.
        </Lead>

        <div className="space-y-4">
          <PerfilCard
            perfil="fiel"
            descr="Retorna consistentemente à rede oficial pra revisão, mesmo quando aparece opção mais barata fora. Cliente de alto valor — vale investir em fidelização premium."
            sinais={['Renda > R$ 12k', 'Score > 750', 'Concessionária = canal principal', 'Idade média 45-55']}
            acoes={[
              'Convite ao programa de fidelidade premium',
              'Oferta de upgrade no próximo modelo com condições preferenciais',
              'Convite para eventos da marca',
            ]}
            cor="emerald"
          />
          <PerfilCard
            perfil="esquecido"
            descr="Quer ser fiel mas perde o timing das revisões. Quando lembra, já está fora da janela e se frustra. Resgatável com lembretes proativos e facilidades."
            sinais={['Idade variável', 'Histórico de revisões intermitente', 'Tempo até última visita > 6 meses']}
            acoes={[
              'Campanha SMS+WhatsApp lembrando próxima revisão',
              'Bônus por trazer o carro nos próximos 30 dias',
              'Oferta de busca/entrega domiciliar do veículo',
            ]}
            cor="amber"
          />
          <PerfilCard
            perfil="economico"
            descr="Mantém vínculo mas é altamente sensível a preço. Comparou orçamentos antes de aceitar. Precisa sentir que está pagando justo — pacote fechado funciona."
            sinais={['Renda < R$ 8k', 'Sensível a desconto', 'Canal de aquisição mais comum: online/comparador', 'Financiamento longo']}
            acoes={[
              'Pacote de revisão com preço fechado',
              'Programa de assinatura de manutenção (mensalidade baixa)',
              'Cross-sell de peças genuínas com desconto progressivo',
            ]}
            cor="blue"
          />
          <PerfilCard
            perfil="abandono"
            descr="Faz no máximo a primeira revisão dentro da rede e migra rapidamente pra oficinas externas. Janela crítica de retenção: primeiros 6 meses pós-compra."
            sinais={['Renda < R$ 7,5k', 'Score < 650', 'Financiamento longo (60-72x)', 'Primeira compra']}
            acoes={[
              'Contato proativo do consultor sênior em até 7 dias',
              'Pacote de revisão com desconto agressivo (até -30%)',
              'Cashback em primeira manutenção fora da garantia',
              'Pesquisa qualitativa pra entender motivo de saída',
            ]}
            cor="red"
          />
        </div>

        <Callout type="info">
          Esses perfis foram <b>descobertos</b> pelos dados, não definidos a priori. O sistema
          valida a estrutura todo treino: silhouette score atual <b>0.290</b>, indicando separação
          razoável para um problema socio-comportamental real.
        </Callout>
      </>
    ),
  },

  {
    id: 'vin-share',
    icon: Target,
    title: 'VIN Share',
    summary: 'A métrica norte: % de carros vendidos que retorna à rede oficial',
    body: (
      <>
        <Lead>
          <b>VIN Share</b> é a fatia de veículos (identificados pelo VIN — número de chassi)
          que continua sendo atendida pela rede autorizada Ford ao longo do tempo. É o KPI
          principal do Desafio 2.
        </Lead>

        <H3>Como o sistema estima o VIN Share</H3>
        <p>Definição operacional usada na <Code>/carteira</Code>:</p>
        <Formula>
          VIN Share = clientes ativos na rede / total de clientes vendidos
        </Formula>
        <p className="text-sm text-slate">
          Onde &quot;ativos&quot; significa: número de revisões realizadas &gt; 0 nos
          últimos 12 meses. O cálculo roda em <Code>/metrics/dealership</Code>.
        </p>

        <H3>Por que isso importa</H3>
        <Grid cols={3}>
          <StatBlock value="+R$ 2-5k" label="Receita anual de pós-venda por veículo retido" />
          <StatBlock value="60%" label="Margem média de peças e serviços vs venda de carro novo" />
          <StatBlock value="3x" label="Mais barato reter que adquirir novo cliente" />
        </Grid>
      </>
    ),
  },

  // ===== HOW-TO =====
  {
    id: 'cadastrar-cliente',
    icon: Users,
    title: 'Como cadastrar um cliente',
    summary: 'Passo a passo: do test-drive ao perfil predito',
    body: (
      <>
        <Lead>
          O cadastro de cliente é feito no momento da venda. A predição do perfil acontece
          em segundos, automaticamente, ainda na concessionária.
        </Lead>

        <Steps>
          <Step n={1} title="Acesse Clientes → Novo cliente">
            Menu lateral → <b>Clientes</b> → botão <b>+ Novo cliente</b> no topo da página.
          </Step>
          <Step n={2} title="Preencha os dados pré-compra">
            Apenas os campos disponíveis no ato da venda: dados demográficos, score de crédito,
            modelo escolhido, forma de pagamento, primeiro carro, test drive realizado.
            <ImportantNote>
              O sistema <b>nunca pede</b> dados pós-compra (revisões futuras, gasto, churn).
              Isso é proposital — o classificador foi treinado <i>sem</i> esses campos pra
              evitar data leakage.
            </ImportantNote>
          </Step>
          <Step n={3} title="Sistema dispara predição automática">
            Ao salvar, o backend chama o serviço de ML que retorna em &lt;1s:
            <ul className="list-disc list-inside text-sm mt-2 space-y-1 text-slate">
              <li><b>Perfil predito</b> (fiel/esquecido/econômico/abandono)</li>
              <li><b>Probabilidades por classe</b> (top-1 + alternativas)</li>
              <li><b>Score de risco de evasão</b> (0 a 1)</li>
              <li><b>Lista de ações sugeridas</b> pra esse perfil</li>
            </ul>
          </Step>
          <Step n={4} title="Cliente aparece na carteira">
            Redirecionamento automático pra ficha do cliente. Se o risco for &gt; 60%,
            ele também aparece na lista de <b>Leads priorizados</b>.
          </Step>
        </Steps>

        <Callout type="success">
          <b>Privacidade:</b> nome e CPF são opcionais. Se informados, o CPF é hasheado
          com SHA-256 + pepper antes de ir pro banco; não é armazenado em claro.
        </Callout>
      </>
    ),
  },

  {
    id: 'leads-acao',
    icon: AlertTriangle,
    title: 'Trabalhando os leads de alto risco',
    summary: 'Como priorizar contatos e registrar ações',
    body: (
      <>
        <Lead>
          A página <Code>/leads</Code> lista todos os clientes com risco de evasão acima de 40%,
          ordenados do mais crítico ao menos crítico. É o feed diário do consultor.
        </Lead>

        <Steps>
          <Step n={1} title="Filtre por risco e perfil">
            Use os controles do topo da página pra ver só perfis específicos ou risco mínimo
            mais alto (ex: ≥70% pra emergências).
          </Step>
          <Step n={2} title="Abra a ficha do cliente">
            Clique no card → vai pra <Code>/clientes/[id]</Code>. Lá você vê o histórico
            completo + ações sugeridas pra esse perfil específico.
          </Step>
          <Step n={3} title="Registre a ação tomada">
            Botão <b>+ Nova ação</b> permite logar qualquer tentativa de contato:
            ligação, WhatsApp, e-mail, visita, oferta enviada. Isso alimenta o histórico
            e o painel de gestão.
          </Step>
          <Step n={4} title="Acompanhe o desfecho">
            Quando o cliente responde (volta pra revisão, recusa a oferta, pede mais info),
            atualize o status da ação. Ações com desfecho ajudam a calibrar o modelo no
            próximo treino.
          </Step>
        </Steps>

        <H3>Sinais de cor</H3>
        <Grid cols={3}>
          <ColorChip color="bg-red-500" label="≥ 70% risco" desc="Ação no mesmo dia" />
          <ColorChip color="bg-amber-500" label="50-69%" desc="Ação em até 48h" />
          <ColorChip color="bg-blue-500" label="40-49%" desc="Acompanhar semanalmente" />
        </Grid>
      </>
    ),
  },

  {
    id: 'comparativo-veiculos',
    icon: Car,
    title: 'Comparativo de veículos (Desafio 1)',
    summary: 'Como gerar um comparativo competitivo com análise IA',
    body: (
      <>
        <Lead>
          O catálogo combina 5 fontes pra entregar specs e equipamentos confiáveis pra
          qualquer modelo do mercado BR. Útil tanto pra cliente em loja quanto pra
          inteligência competitiva interna.
        </Lead>

        <H3>Adicionar um veículo</H3>
        <p>Três caminhos em <Code>/veiculos/adicionar</Code>:</p>
        <Grid cols={3}>
          <FeatureCard icon={Users} title="Manual">
            Preenchimento campo a campo. Marcado como &quot;verificado por humano&quot; — máxima confiança.
          </FeatureCard>
          <FeatureCard icon={Database} title="JSON / CSV">
            Importar em lote uma lista pronta. Bom pra migração inicial.
          </FeatureCard>
          <FeatureCard icon={Sparkles} title="PDF / Imagem (IA)">
            Solta um e-book da fabricante (F-150 etc.). IA extrai automaticamente
            todas as versões com specs e equipamentos por trim.
          </FeatureCard>
        </Grid>

        <H3>Pipeline de busca automática</H3>
        <p>Quando você busca um modelo, o sistema consulta nesta ordem:</p>
        <PipelineList>
          <PipelineStep n={1} name="FIPE.online v2" desc="preço oficial BR + identidade exata" />
          <PipelineStep n={2} name="E-book PDF oficial" desc="extração via IA do catálogo PDF da fabricante (quando registry tem URL)" />
          <PipelineStep n={3} name="Site oficial (HTML)" desc="scraping da página do modelo (Toyota, VW, Chevrolet, RAM, Renault, Jeep…)" />
          <PipelineStep n={4} name="411 Vehicle Data" desc="specs detalhadas USA (Ford F-150, Mustang, RAM 1500 etc.)" />
          <PipelineStep n={5} name="NHTSA vPIC" desc="catálogo global + decode de VIN" />
          <PipelineStep n={6} name="IA + web search" desc="último fallback com citações de fonte" />
        </PipelineList>

        <Callout type="info">
          Cada campo no card do veículo carrega um <b>badge da fonte</b> (verde = fonte oficial,
          azul = API, âmbar = estimativa IA). Você sabe sempre de onde veio cada dado.
        </Callout>

        <H3>Comparar 2-5 veículos</H3>
        <p>
          Em <Code>/veiculos</Code>, marque até 5 com checkbox → botão <b>Comparar</b>.
          Vai pra <Code>/veiculos/comparar?ids=...</Code> com:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li><b>Tabela vencedor por campo</b> (troféu verde no melhor de cada categoria)</li>
          <li><b>Diferenciais exclusivos</b> agrupados por categoria (segurança, conforto, tech, off-road…)</li>
          <li><b>Análise IA</b> focada em features que distinguem versões — formato de showroom</li>
        </ul>
      </>
    ),
  },

  {
    id: 'insights-ia',
    icon: Sparkles,
    title: 'Insights de IA',
    summary: 'XAI por cliente + análise estratégica de carteira',
    body: (
      <>
        <Lead>
          Os insights traduzem números em recomendação prática. Dois tipos disponíveis:
        </Lead>

        <H3>Insight por cliente (XAI)</H3>
        <p>
          Na ficha de cada cliente, clique em <b>Explicar classificação com IA</b>.
          Em PT-BR, em 2-3 parágrafos, a IA explica:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li>Por que esse cliente foi classificado naquele perfil</li>
          <li>Quais variáveis mais pesaram (idade, score, modelo escolhido…)</li>
          <li>Qual a próxima ação concreta recomendada</li>
        </ul>

        <H3>Insight de carteira (gestor)</H3>
        <p>
          Página <Code>/insights</Code>. Dá uma análise estratégica considerando:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li>Distribuição de perfis na sua concessionária</li>
          <li>VIN Share atual vs. potencial</li>
          <li>Onde concentrar esforço de retenção essa semana</li>
        </ul>

        <Callout type="info">
          Insights ficam em cache (24h por cliente, 6h por carteira) — não gera custo a cada
          abertura. Custo médio: $0,002-0,01 por insight com gpt-4o-mini.
        </Callout>
      </>
    ),
  },

  // ===== TECH =====
  {
    id: 'como-funciona-ml',
    icon: Brain,
    title: 'Como o modelo de ML funciona',
    summary: 'Pipeline completo: dados → clusters → classificador → predição',
    body: (
      <>
        <Lead>
          O coração do Desafio 2 é um pipeline de duas etapas: aprendizado
          não-supervisionado descobre os perfis, e aprendizado supervisionado aprende
          a predizê-los a partir de dados disponíveis na compra.
        </Lead>

        <H3>Etapa 1 — Segmentação (não-supervisionada)</H3>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li><b>Algoritmo:</b> K-Means com k=4 escolhido por elbow method (SSE)</li>
          <li><b>Validação:</b> silhouette score 0.290 (estrutura presente)</li>
          <li><b>Base usada:</b> Base 1 — histórico completo (incluindo comportamento pós-compra)</li>
          <li><b>Mapeamento cluster → persona:</b> análise das médias intra-cluster — quem volta muito vira &quot;Fiel&quot;, quem some virou &quot;Abandono&quot;, etc.</li>
        </ul>

        <H3>Etapa 2 — Classificação (supervisionada)</H3>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li><b>Algoritmo:</b> XGBoost (multi:softprob, 300 estimadores, max_depth=6)</li>
          <li><b>Target:</b> o cluster atribuído a cada cliente na Base 1</li>
          <li><b>Features:</b> apenas Base 2 — dados disponíveis na compra (zero data leakage)</li>
          <li><b>Métricas:</b> accuracy 60%, F1 macro 0.56, F1 weighted 0.59</li>
          <li><b>Forte em:</b> identificar clientes Fiéis (precisão 0.76, recall 0.82) — o que mais importa pra programa de fidelidade</li>
        </ul>

        <H3>Por que essas métricas?</H3>
        <p>
          O problema é socio-comportamental: dois clientes com perfis demográficos parecidos
          podem ter comportamentos diferentes por motivos não capturáveis nos dados
          (mudança de cidade, troca de emprego…). 60% é um número honesto pra esse tipo
          de problema — modelos que clamam &gt;90% normalmente têm data leakage ou
          overfitting.
        </p>

        <Callout type="info">
          <b>Quer mais detalhe?</b> O relatório técnico completo está em
          {' '}<Code>docs/deliverables/Relatorio_Desafio_2_ML.pdf</Code>. O notebook do
          treino está em <Code>services/ml/notebooks/ford_segmentation.ipynb</Code>.
        </Callout>
      </>
    ),
  },

  {
    id: 'fontes-dados',
    icon: Database,
    title: 'Fontes de dados de veículos',
    summary: 'De onde vêm os specs e como confiar em cada um',
    body: (
      <>
        <H3>5 camadas de fonte</H3>
        <SourceTable />

        <Callout type="info">
          O sistema mostra um <b>badge de fonte</b> ao lado de cada campo em
          {' '}<Code>/veiculos/[id]</Code>. Você nunca fica no escuro sobre de onde veio cada número.
        </Callout>

        <H3>Confiança</H3>
        <Grid cols={3}>
          <BadgeRow color="bg-emerald-100 text-emerald-700 border-emerald-300" label="ALTA" desc="Fonte oficial + FIPE confirmam" />
          <BadgeRow color="bg-amber-100 text-amber-700 border-amber-300" label="MÉDIA" desc="1 fonte oficial OU API" />
          <BadgeRow color="bg-rose-100 text-rose-700 border-rose-300" label="BAIXA" desc="Apenas estimativa IA" />
        </Grid>
      </>
    ),
  },

  {
    id: 'configuracoes-ia',
    icon: Settings,
    title: 'Configurações de IA',
    summary: 'Como configurar chaves OpenAI/Anthropic/Gemini + escolher modelo por função',
    body: (
      <>
        <Lead>
          Em <Code>/configuracoes</Code> você gerencia chaves de API e escolhe qual modelo
          de IA roda em cada função.
        </Lead>

        <H3>Aba &quot;Chaves de API&quot;</H3>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li><b>OpenAI</b> — necessária pra GPT-4o-mini (extração + vision)</li>
          <li><b>Anthropic</b> — necessária pra Claude com PDF nativo</li>
          <li><b>Google Gemini</b> — opcional (texto)</li>
          <li><b>FIPE.online</b> — token aumenta limite de 500 → 1000 req/dia</li>
          <li><b>411 Vehicle Data</b> — RapidAPI key pra specs USA</li>
        </ul>

        <Callout type="success">
          Chaves são armazenadas <b>criptografadas</b> no Supabase com RLS admin-only.
          Apenas o service_role do backend lê pra fazer as chamadas.
        </Callout>

        <H3>Aba &quot;Modelo por função&quot;</H3>
        <p>5 funções, cada uma pode usar modelo diferente:</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li><b>vehicle_search</b> — fallback de IA na busca de veículo (tier rápido)</li>
          <li><b>manufacturer_extract</b> — extração de HTML/PDF da fabricante (tier rápido)</li>
          <li><b>compare_analysis</b> — análise comparativa executiva (tier smart)</li>
          <li><b>client_insight</b> — XAI por cliente (tier rápido)</li>
          <li><b>portfolio_insight</b> — análise estratégica da carteira (tier smart)</li>
        </ul>
      </>
    ),
  },

  {
    id: 'seguranca',
    icon: Shield,
    title: 'Segurança e privacidade',
    summary: 'O que o sistema faz pra proteger dados (LGPD-ready)',
    body: (
      <>
        <H3>Em uma frase</H3>
        <Lead>
          Validação Zod em tudo, JWT + RBAC, pseudonimização de PII no pipeline de ML,
          HMAC nas chamadas entre serviços, RLS por concessionária e trilha de auditoria
          de toda ação crítica.
        </Lead>

        <Grid cols={2}>
          <SecCard icon={Eye} title="Validação de entrada">
            Todas as rotas usam Zod schemas. SQL injection impossível (prepared statements
            via PostgREST). XSS bloqueado (React escapa automaticamente).
          </SecCard>
          <SecCard icon={Lock} title="Autenticação">
            JWT Supabase validado contra <Code>/auth/v1/user</Code>. RBAC com 3 papéis
            (analista/gestor/admin). Rotas sensíveis exigem admin.
          </SecCard>
          <SecCard icon={Shield} title="Pseudonimização">
            <Code>dealership_id</Code> vira hash HMAC-SHA256 antes de sair pro ML.
            Nome/CPF/email <b>nunca</b> entram no payload do modelo.
          </SecCard>
          <SecCard icon={Activity} title="Auditoria">
            Toda alteração de chave de IA, criação/exclusão de cliente, exclusão de veículo
            é logada em <Code>audit_log</Code> com IP + user-agent. RLS admin-only na leitura.
          </SecCard>
        </Grid>

        <Callout type="info">
          Política de segurança completa em <Code>docs/SECURITY.md</Code>. Cobre os 5
          eixos avaliativos da disciplina de Cybersecurity.
        </Callout>
      </>
    ),
  },

  {
    id: 'glossario',
    icon: BookOpen,
    title: 'Glossário',
    summary: 'Termos técnicos do projeto, explicados',
    body: (
      <dl className="divide-y divide-gray-200">
        {GLOSSARY.map(({ term, def }) => (
          <div key={term} className="py-3">
            <dt className="font-bold text-charcoal">{term}</dt>
            <dd className="text-sm text-slate mt-1">{def}</dd>
          </div>
        ))}
      </dl>
    ),
  },

  {
    id: 'faq',
    icon: Info,
    title: 'Perguntas frequentes',
    summary: 'As dúvidas que aparecem mais',
    body: (
      <div className="space-y-4">
        {FAQ.map((q, i) => <Faq key={i} {...q} />)}
      </div>
    ),
  },
];

// =============== component types ===============

type Section = {
  id: string;
  icon: any;
  title: string;
  summary: string;
  body: React.ReactNode;
};

// =============== UI helpers ===============

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-base text-slate leading-relaxed mb-6">{children}</p>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-ford-blue mt-8 mb-3">{children}</h3>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-gray-100 text-ford-blue px-1.5 py-0.5 rounded text-[12px] font-mono">{children}</code>;
}
function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-3 my-4`}>{children}</div>;
}
function FeatureCard({ icon: Icon, title, children }: any) {
  return (
    <div className="bg-ford-blue-soft/30 border border-ford-blue/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-ford-blue" />
        <div className="font-bold text-charcoal text-sm">{title}</div>
      </div>
      <p className="text-sm text-slate leading-relaxed">{children}</p>
    </div>
  );
}
function PerfilCard({
  perfil, descr, sinais, acoes, cor,
}: {
  perfil: 'fiel' | 'esquecido' | 'economico' | 'abandono';
  descr: string;
  sinais: string[];
  acoes: string[];
  cor: 'emerald' | 'amber' | 'blue' | 'red';
}) {
  const borderMap = {
    emerald: 'border-l-emerald-500', amber: 'border-l-amber-500',
    blue: 'border-l-blue-500', red: 'border-l-red-500',
  };
  return (
    <div className={`bg-white border border-gray-200 ${borderMap[cor]} border-l-4 rounded-xl p-5`}>
      <div className="flex items-center gap-3 mb-3">
        <PerfilBadge perfil={perfil} />
      </div>
      <p className="text-sm text-slate mb-4 leading-relaxed">{descr}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-2">Sinais</div>
          <ul className="space-y-1">
            {sinais.map(s => <li key={s} className="text-xs text-slate flex items-start gap-1.5"><span className="text-gray-400 mt-0.5">•</span>{s}</li>)}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-2">Ações sugeridas</div>
          <ul className="space-y-1">
            {acoes.map(a => <li key={a} className="text-xs text-slate flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />{a}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-4 my-4">{children}</ol>;
}
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ford-blue text-white font-bold flex items-center justify-center text-sm">{n}</div>
      <div className="flex-1 pt-1">
        <div className="font-bold text-charcoal mb-1">{title}</div>
        <div className="text-sm text-slate leading-relaxed">{children}</div>
      </div>
    </li>
  );
}
function Callout({ type = 'info', children }: { type?: 'info' | 'success' | 'warning'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
  };
  const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle };
  const Icon = icons[type];
  return (
    <div className={`${styles[type]} border rounded-xl p-4 my-4 flex gap-3`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
function ImportantNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 my-3 rounded-r-lg text-amber-900 text-xs leading-relaxed">
      <b>⚠ Importante:</b> {children}
    </div>
  );
}
function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 my-3 font-mono text-sm text-charcoal text-center">
      {children}
    </div>
  );
}
function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-gradient-to-br from-ford-blue to-ford-blue-light text-white rounded-xl p-5 text-center">
      <div className="text-3xl font-black">{value}</div>
      <div className="text-[11px] uppercase tracking-wider opacity-80 mt-1 leading-tight">{label}</div>
    </div>
  );
}
function ColorChip({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
      <div className={`w-3 h-3 rounded-full ${color} mt-1 flex-shrink-0`} />
      <div>
        <div className="font-bold text-sm text-charcoal">{label}</div>
        <div className="text-xs text-slate">{desc}</div>
      </div>
    </div>
  );
}
function PipelineList({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2 my-4">{children}</ol>;
}
function PipelineStep({ n, name, desc }: { n: number; name: string; desc: string }) {
  return (
    <li className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-ford-blue-soft text-ford-blue font-bold text-xs flex items-center justify-center">{n}</div>
      <div className="flex-1">
        <span className="font-bold text-charcoal text-sm">{name}</span>
        <span className="text-slate text-sm"> — {desc}</span>
      </div>
    </li>
  );
}
function BadgeRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <span className={`inline-block px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider border ${color}`}>{label}</span>
      <p className="text-xs text-slate mt-2 leading-relaxed">{desc}</p>
    </div>
  );
}
function SourceTable() {
  const rows = [
    ['FIPE.online', 'Preço oficial BR + identidade exata', 'Verde', 'Mensal'],
    ['Manufacturer HTML', 'Specs da página do modelo na fabricante', 'Verde', 'Em tempo real'],
    ['E-book PDF', 'Catálogo oficial em PDF, extração via IA', 'Verde', 'Anual'],
    ['411 Vehicle Data', 'API USA — HP, torque, consumo, drivetrain', 'Verde/Azul', 'Em tempo real'],
    ['NHTSA vPIC', 'Catálogo USA + decode de VIN', 'Verde/Azul', 'Em tempo real'],
    ['IA + web search', 'Último fallback com citações', 'Âmbar', 'Em tempo real'],
  ];
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ford-blue text-white">
            <th className="px-3 py-2 text-left rounded-tl-lg">Fonte</th>
            <th className="px-3 py-2 text-left">O que entrega</th>
            <th className="px-3 py-2 text-left">Confiança</th>
            <th className="px-3 py-2 text-left rounded-tr-lg">Atualização</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
              {r.map((c, j) => <td key={j} className="px-3 py-2 border-b border-gray-200 text-slate">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function SecCard({ icon: Icon, title, children }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-ford-blue" />
        <div className="font-bold text-charcoal text-sm">{title}</div>
      </div>
      <p className="text-xs text-slate leading-relaxed">{children}</p>
    </div>
  );
}
function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50">
        <span className="font-bold text-charcoal">{q}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-slate leading-relaxed">{a}</div>
      )}
    </div>
  );
}

// =============== page ===============

export default function Ajuda() {
  const [active, setActive] = useState<string>('visao-geral');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      setActive(window.location.hash.slice(1));
    }
  }, []);

  const filtered = search
    ? SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.summary.toLowerCase().includes(search.toLowerCase()))
    : SECTIONS;

  const current = SECTIONS.find(s => s.id === active) ?? SECTIONS[0];

  return (
    <Shell>
      <div className="flex max-w-7xl mx-auto">
        {/* ===== TOC (sticky) ===== */}
        <aside className="w-72 flex-shrink-0 px-6 py-8 border-r border-gray-200 sticky top-[57px] self-start h-[calc(100vh-57px)] overflow-y-auto">
          <div className="flex items-center gap-2 mb-5">
            <BookOpen className="w-5 h-5 text-ford-blue" />
            <h1 className="font-bold text-lg text-charcoal">Documentação</h1>
          </div>
          <div className="relative mb-4">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-ford-blue" />
          </div>
          <nav className="space-y-0.5">
            {filtered.map(s => (
              <button key={s.id}
                onClick={() => { setActive(s.id); window.history.replaceState(null, '', `#${s.id}`); }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                  active === s.id
                    ? 'bg-ford-blue text-white font-semibold'
                    : 'text-slate hover:bg-gray-100 hover:text-charcoal'
                }`}>
                <s.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 truncate">{s.title}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ===== CONTENT ===== */}
        <div className="flex-1 min-w-0 px-8 py-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-2">
              <current.icon className="w-5 h-5 text-ford-blue" />
              <span className="text-xs uppercase tracking-[0.2em] text-gray-500 font-bold">
                {SECTIONS.indexOf(current) + 1} de {SECTIONS.length}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-charcoal mb-2">{current.title}</h1>
            <p className="text-slate mb-8">{current.summary}</p>

            <div className="prose prose-slate max-w-none">
              {current.body}
            </div>

            {/* navegação inferior */}
            <div className="mt-12 pt-8 border-t border-gray-200 flex items-center justify-between">
              <PrevNext sections={SECTIONS} current={current.id} onSelect={setActive} />
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function PrevNext({ sections, current, onSelect }: { sections: Section[]; current: string; onSelect: (id: string) => void }) {
  const idx = sections.findIndex(s => s.id === current);
  const prev = idx > 0 ? sections[idx - 1] : null;
  const next = idx < sections.length - 1 ? sections[idx + 1] : null;
  return (
    <>
      <div>
        {prev && (
          <button onClick={() => { onSelect(prev.id); window.history.replaceState(null, '', `#${prev.id}`); }}
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-ford-blue">
            <ArrowRight className="w-3.5 h-3.5 rotate-180 group-hover:-translate-x-1 transition-transform" />
            <span>
              <div className="text-[10px] uppercase tracking-wider">Anterior</div>
              <div className="font-bold text-charcoal group-hover:text-ford-blue">{prev.title}</div>
            </span>
          </button>
        )}
      </div>
      <div>
        {next && (
          <button onClick={() => { onSelect(next.id); window.history.replaceState(null, '', `#${next.id}`); }}
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-ford-blue text-right">
            <span>
              <div className="text-[10px] uppercase tracking-wider">Próximo</div>
              <div className="font-bold text-charcoal group-hover:text-ford-blue">{next.title}</div>
            </span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </>
  );
}
