'use client';
import { useState, useEffect } from 'react';
import {
  BookOpen, Users, Car, Sparkles, Settings, Shield, BarChart3, AlertTriangle,
  Megaphone, Brain, Database, ChevronRight, ChevronDown, Search, ArrowRight,
  CheckCircle2, Info, Zap, Lock, Eye, Target, Activity, Building2, Award,
  Wrench, Mail,
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

        <H3>Mapa do sistema (sidebar)</H3>
        <p>
          A sidebar está organizada por desafio:
        </p>
        <Grid cols={2}>
          <FeatureCard icon={BarChart3} title="Retenção (D2) — 4 telas">
            <ul className="text-xs mt-1 space-y-0.5">
              <li>· <Code>/carteira</Code> — painel UNIFICADO: KPIs + perfis + leads + anomalias + briefing IA + ML stats</li>
              <li>· <Code>/leads</Code> — lead feed com 175k+ candidatos e sinais explícitos</li>
              <li>· <Code>/clientes</Code> — lista filtrável + Visão 360 por cliente</li>
              <li>· <Code>/acoes</Code> — histórico de toques + envio de e-mail real (Resend)</li>
            </ul>
          </FeatureCard>
          <FeatureCard icon={Car} title="Catálogo (D1) — 2 telas">
            <ul className="text-xs mt-1 space-y-0.5">
              <li>· <Code>/veiculos</Code> — catálogo competitivo com schema canônico 262 atributos</li>
              <li>· <Code>/veiculos/adicionar</Code> — 3 fluxos: manual, busca IA, PDF</li>
            </ul>
          </FeatureCard>
        </Grid>

        <H3>Capacidades principais</H3>
        <Grid cols={2}>
          <FeatureCard icon={Car} title="Catálogo competitivo">
            Cadastrar veículos próprios e da concorrência com dados verificados de
            5+ fontes (FIPE, scraping da fabricante, e-book PDF, 411 API, IA).
            Comparar 2-5 lado a lado com análise IA + dados de venda BR via web search.
          </FeatureCard>
          <FeatureCard icon={Users} title="175k VINs Ford reais">
            Base oficial vin_share_Desafio_02.xlsx importada. Sistema classifica
            em 1 de 4 perfis comportamentais via XGBoost real (62.7% accuracy).
          </FeatureCard>
          <FeatureCard icon={AlertTriangle} title="Leads automáticos">
            135k+ leads detectados via risco composto (perfil_real + 6 sinais
            operacionais). Cada lead mostra POR QUE está no topo.
          </FeatureCard>
          <FeatureCard icon={Mail} title="E-mail real via Resend">
            Ação tipo &quot;e-mail&quot; manda mensagem real pro cliente via API Resend,
            com templates por perfil. Sem chave → modo simulação claramente sinalizado.
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

        <H3>Cobertura dos 3 blocos do briefing Ford</H3>
        <p>
          O slide oficial pede 3 capacidades. Como a gente cobre cada uma:
        </p>
        <Grid cols={3}>
          <FeatureCard icon={BarChart3} title="1. Análise e visualização">
            <Code>/carteira</Code> mostra VIN Share, aderência, perfis, distribuição
            <b>por modelo</b> e <b>por idade do veículo</b> (0-2a / 2-5a / 5+a).
            Filtros granulares: <Code>dealer_code</Code>, <Code>model_name</Code>,
            <Code>idade_bucket</Code> via <Code>GET /metrics/dealership?...</Code>.
          </FeatureCard>
          <FeatureCard icon={Sparkles} title="2. Leads + modelagem preditiva">
            <ul className="text-xs mt-1 space-y-1">
              <li>· <b>XGBoost real</b> classifica perfil de evasão (175k VINs)</li>
              <li>· <b>Próxima revisão estimada</b> (12 meses do último serviço) — <Code>/metrics/proximas-revisoes</Code></li>
              <li>· <b>Status de garantia</b> (vencendo em 90d / 180d) — <Code>/metrics/garantia-status</Code></li>
              <li>· <b>Leads priorizados por risco</b> — <Code>/leads</Code></li>
            </ul>
          </FeatureCard>
          <FeatureCard icon={Target} title="3. Jornada do cliente (360)">
            <Code>/clientes/[id]</Code> consolida ficha + predição + sinais
            (próxima revisão · garantia · idade do veículo) com <b>sugestões
            automáticas de ação</b>. Tudo registrado em <Code>/acoes</Code>.
          </FeatureCard>
        </Grid>

        <H3>Detecção de anomalias</H3>
        <p>
          O slide pede explicitamente &quot;identificar padrões, tendências e
          anomalias&quot;. Calculamos isso em <Code>GET /metrics/anomalias-dealer</Code>:
        </p>
        <ul className="list-disc list-inside text-sm text-slate ml-2 space-y-1">
          <li>Para cada dealer com ≥50 clientes, % de clientes &quot;fiéis&quot;</li>
          <li>Z-score vs média da rede</li>
          <li>Anomalia = z &lt; -1 (significativamente abaixo)</li>
          <li>Devolve também top performers como benchmark</li>
        </ul>

        <Callout type="info">
          <b>O que NÃO conseguimos cobrir (limitação do dataset):</b> &quot;dados de veículos conectados&quot;
          e &quot;tipo de serviço&quot; granular não estão no <Code>vin_share_Desafio_02.xlsx</Code>.
          O sistema está pronto pra consumir essas fontes quando a Ford disponibilizar — os campos
          {' '}<Code>km_max</Code>, <Code>num_revisoes</Code> e <Code>dias_desde_ultima_revisao</Code>
          {' '}são placeholders pra dados telemáticos reais.
        </Callout>
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
    title: 'Leads priorizados — como funcionam',
    summary: 'Da onde vêm, como o risco é calculado e o fluxo de atendimento',
    body: (
      <>
        <Lead>
          A página <Code>/leads</Code> é o <b>feed diário do consultor</b>. Lista
          automaticamente os clientes que mais provavelmente vão sair da rede oficial
          Ford, com explicação de <b>POR QUE</b> cada um está naquela posição.
        </Lead>

        <H3>De onde vêm os leads (a fonte)</H3>
        <p>
          O sistema percorre os <b>175k VINs reais</b> + cadastros manuais e calcula
          em tempo real (via função SQL <Code>leads_ranqueados</Code>) um <b>risco composto</b>
          pra cada um. Não depende de nenhum batch ou cron — é sempre live contra o banco.
        </p>

        <H3>Como o risco é calculado</H3>
        <p>
          A fórmula combina <b>perfil_real</b> (do ETL via XGBoost) com <b>sinais operacionais</b>:
        </p>
        <Formula>
          risco_composto = risco_base(perfil_real) + Σ bonificações(sinais)
        </Formula>

        <H3>Risco base por perfil</H3>
        <Grid cols={4}>
          <StatBlock value="85%" label="Abandono — base alta, candidato natural a lead" />
          <StatBlock value="65%" label="Esquecido — perde timing, recuperável" />
          <StatBlock value="35%" label="Econômico — vínculo frágil mas presente" />
          <StatBlock value="15%" label="Fiel — improvável (mas vira lead se sinais críticos)" />
        </Grid>

        <H3>Bonificações por sinal (somam ao risco base)</H3>
        <ul className="list-disc list-inside text-sm text-slate ml-2 space-y-1">
          <li><b>+0.10</b> Revisão atrasada (mais de 365d sem serviço na rede)</li>
          <li><b>+0.07</b> Sem 1ª revisão (entregue há 15+ meses, nunca passou)</li>
          <li><b>+0.05</b> Garantia já vencida</li>
          <li><b>+0.05</b> Dealer loyalty baixa (&lt;40% das revisões no dealer original)</li>
          <li><b>+0.03</b> Veículo veterano (5+ anos)</li>
        </ul>
        <p className="text-xs text-slate mt-2">
          Cap em 0.99 — risco nunca passa de 99%. Empate em risco desempata por
          número de revisões (menos revisões = mais prioritário).
        </p>

        <H3>Os 6 sinais detectados — o porquê visível</H3>
        <p>
          Cada lead na lista mostra <b>chips coloridos</b> com os sinais que dispararam.
          O operador entende imediatamente <i>por que aquele cliente é prioridade</i>:
        </p>
        <Grid cols={3}>
          <FeatureCard icon={Wrench} title="Revisão atrasada">
            Mais de 365 dias sem voltar à rede. Pode estar fazendo manutenção em oficina externa.
          </FeatureCard>
          <FeatureCard icon={AlertTriangle} title="Sem 1ª revisão">
            Entrega +15 meses, num_revisoes = 0. Crítico — provavelmente já foi pra fora.
          </FeatureCard>
          <FeatureCard icon={Shield} title="Garantia vencida/vencendo">
            Janela curta pra oferecer pacote pós-garantia antes que ele saia.
          </FeatureCard>
          <FeatureCard icon={Building2} title="Dealer loyalty baixa">
            Cliente tem revisões, mas espalhadas — não casou com nenhum dealer específico.
          </FeatureCard>
          <FeatureCard icon={Car} title="Veículo veterano">
            5+ anos — fator natural de migração pra oficinas multimarca.
          </FeatureCard>
          <FeatureCard icon={Sparkles} title="(combinações)">
            Quanto mais sinais um lead acumular, mais alto o risco e mais ao topo da lista.
          </FeatureCard>
        </Grid>

        <H3>Filtros disponíveis</H3>
        <ul className="list-disc list-inside text-sm text-slate ml-2 space-y-1">
          <li><b>Risco mínimo</b>: 40% / 50% / 60% / 70% / 80% / 90%</li>
          <li><b>Perfil real</b>: fiel / abandono / esquecido / econômico</li>
          <li><b>Modelo Ford</b>: foco em RANGER, ECOSPORT, TERRITORY etc.</li>
          <li><b>Dealer code</b>: leads de uma concessionária específica (gestor regional)</li>
          <li><b>Sinal específico</b>: clique num chip pra ver só leads com aquele sinal</li>
        </ul>

        <H3>Fluxo de atendimento (passo a passo)</H3>
        <Steps>
          <Step n={1} title="Comece pelos KPIs no topo">
            Os 4 cards mostram quantos leads existem em cada faixa de risco.
            Clique num card → filtra direto pra aquela faixa.
          </Step>
          <Step n={2} title="Aplique filtros pro seu escopo">
            Gerente de loja: filtra por <Code>dealer_code</Code> da sua loja.
            Foco em modelo específico (ex: campanha Ranger): filtra por <Code>modelo</Code>.
          </Step>
          <Step n={3} title="Leia os sinais antes de abrir">
            Os chips coloridos no card de cada lead dizem POR QUE ele está ali.
            Lead com "Sem 1ª revisão" + "Garantia vencendo" é prioridade absoluta.
          </Step>
          <Step n={4} title="Abra a ficha → registre ação">
            Clica em <b>"Abrir ficha"</b> → vai pra <Code>/clientes/[id]</Code>.
            Lá tem Visão 360 (próxima revisão, garantia, idade) e o botão
            <b>"+ Nova ação"</b> pra registrar ligação, WhatsApp, ou enviar e-mail real.
          </Step>
          <Step n={5} title="Acompanhe o desfecho">
            Em <Code>/acoes</Code> você vê todo o histórico, taxa de conversão por tipo,
            tempo médio de resolução.
          </Step>
        </Steps>

        <H3>Sinais de cor no cartão</H3>
        <Grid cols={3}>
          <ColorChip color="bg-rose-500" label="≥ 70% risco" desc="Ação no mesmo dia" />
          <ColorChip color="bg-amber-500" label="50-69%" desc="Ação em até 48h" />
          <ColorChip color="bg-blue-500" label="40-49%" desc="Acompanhar semanal" />
        </Grid>

        <Callout type="info">
          <b>Por que isto importa pra Ford?</b> O slide D2 pede explicitamente
          &quot;modelagem preditiva que identifique veículos com alta probabilidade de
          precisar de serviço OU em risco de sair da rede&quot;. O endpoint
          <Code>GET /clients/leads</Code> entrega exatamente isso, com sinais
          transparentes em vez de uma black box.
        </Callout>
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

        <H3>Adicionar um veículo — 3 fluxos novos</H3>
        <p>
          Em <Code>/veiculos/adicionar</Code>. Todos os fluxos pedem só identificação
          (marca/modelo/versão/ano) — a ficha técnica completa fica no schema canônico
          (262 atributos) que é preenchido depois.
        </p>
        <Grid cols={3}>
          <FeatureCard icon={Users} title="Manual">
            Só identificação. Marcado como &quot;verificado por humano&quot;. Checkbox opcional
            roda <b>auto-fill canônico via IA</b> logo após criar (draft revisável).
          </FeatureCard>
          <FeatureCard icon={Sparkles} title="Buscar (FIPE + IA)">
            Inputs marca/modelo. Sistema consulta FIPE → e-book oficial → site da
            fabricante → NHTSA → LLM com web search. Mostra preview, você confirma,
            e a IA preenche os 262 atributos.
          </FeatureCard>
          <FeatureCard icon={Database} title="Arquivo (PDF/IA, JSON, CSV)">
            <b>PDF/Imagem:</b> IA extrai todos os trims dum e-book, você seleciona quais
            salvar, e o auto-fill canônico roda em série pra cada um.
            {' '}<b>JSON/CSV:</b> bulk insert por identificação (canônico fica vazio,
            preenche depois).
          </FeatureCard>
        </Grid>
        <Callout type="info">
          <b>Confirmações obrigatórias:</b> qualquer ação que chame IA paga, sobrescreva
          dados, ou apague entrada passa por um modal de confirmação com estimativa
          de custo. Você nunca executa nada sem clicar &quot;Sim&quot;.
        </Callout>

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
          <li><b>Schema canônico Ford D1</b> — tabela fixa de 262 atributos em 14 seções (Wheels, Connectivity, Safety, High tech, 4X4, …) preenchidos com X / 0 / valor por veículo</li>
          <li><b>Tabela vencedor por campo quantitativo</b> (troféu verde no melhor de cada categoria)</li>
          <li><b>Diferenciais exclusivos</b> agrupados por categoria (segurança, conforto, tech, off-road…)</li>
          <li><b>Análise IA</b> focada em features que distinguem versões — formato de showroom</li>
        </ul>

        <H3>Schema canônico Ford 26MY (262 atributos × 14 seções) — onde mora o coração do D1</H3>
        <p>
          A Ford forneceu no template oficial uma <b>matriz fixa</b> de 262 atributos pra
          padronizar comparações. Cada concorrente cadastrado preenche os mesmos
          campos (X = tem, 0 = não tem, valor numérico, ou <i>não disponível</i>).
          Vantagem: comparação 1:1 entre Ranger Limited+ e qualquer Hilux/Amarok/SW4 sem ambiguidade.
        </p>
        <Grid cols={3}>
          <FeatureCard icon={Database} title="catalog_items (262 linhas)">
            Schema imutável: 14 seções (Wheels, Connectivity, Safety, High tech, 4X4…)
            com atributos pré-definidos no template Ford.
            Endpoint <Code>GET /competitive/catalog-items</Code>.
          </FeatureCard>
          <FeatureCard icon={Car} title="vehicle_catalog_values">
            Bridge veículo × atributo. Cada veículo do catálogo preenche
            os 262 valores. Confiança e fonte rastreáveis por valor (manual / IA / Ford D1).
          </FeatureCard>
          <FeatureCard icon={Sparkles} title="POST /compare/canonico">
            Devolve a matriz 262×N pra qualquer combinação de veículos —
            usado pelo bloco &quot;Comparativo Ford 26MY&quot; em <Code>/veiculos/comparar</Code>.
          </FeatureCard>
        </Grid>

        <H3>Como editar / preencher os 262 atributos de um veículo</H3>
        <p>
          Abra qualquer veículo em <Code>/veiculos/[id]</Code>. O bloco
          <b> &quot;Especificações canônicas Ford D1&quot;</b> aparece logo abaixo das specs gerais:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li>Indicador <b>X/262 preenchidos</b> + barra de progresso</li>
          <li>Cada seção colapsável mostra os atributos com <b>✓ tem</b> / <b>✗ não tem</b> / valor numérico / <b>&quot;não disponível&quot;</b></li>
          <li>Botão <b>Editar</b> habilita edição inline (switch pra flags, input pra numérico)</li>
          <li>Botão <b>Preencher com IA</b> (Sparkles) chama o LLM pra completar as lacunas — mantém o que já está manual, marca novos como confiança &quot;baixa&quot;</li>
        </ul>
        <Callout type="info">
          As 3 versões da Ranger 26MY (XLT, Limited, Limited +) já chegam com os 262 valores
          preenchidos a partir do datasheet oficial. Modelos da concorrência (Hilux, Amarok, SW4…)
          herdam o schema vazio — operador preenche manualmente ou aciona &quot;Preencher com IA&quot;
          pra um draft de baixa confiança que ele revisa antes de salvar.
        </Callout>

        <H3>Validação Ford — Ranger Raptor</H3>
        <p>
          O slide oficial pede que a solução entregue <b>todas as especificações</b> apresentadas
          no slide da Ranger Raptor. Fluxo recomendado:
        </p>
        <PipelineList>
          <PipelineStep n={1} name="Cadastrar Ranger Raptor" desc="/veiculos/adicionar com marca=Ford, modelo=Ranger, versao=Raptor" />
          <PipelineStep n={2} name="Reanalisar" desc='abre detalhe, clica "Reanalisar" — sistema busca FIPE + e-book + site Ford + IA' />
          <PipelineStep n={3} name="Preencher canônico" desc='no bloco canônico, clica "Preencher com IA" — IA propõe valores pros 262 atributos do template' />
          <PipelineStep n={4} name="Revisar" desc='operador valida atributo por atributo (especialmente os marcados "ai:auto-fill") e edita o que estiver errado' />
          <PipelineStep n={5} name="Comparar" desc='/veiculos/comparar mostra a tabela 262 × N veículos selecionados — formato fixo independente do modelo' />
        </PipelineList>
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
          Disponível no painel <Code>/carteira</Code> seção <b>5 — Briefing executivo da IA</b>
          {' '}(antes era <Code>/insights</Code>, agora unificado). Dá uma análise
          estratégica considerando:
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

  {
    id: 'email-real',
    icon: Mail,
    title: 'E-mail real (Resend)',
    summary: 'Como configurar envio real de e-mail nas ações de retenção',
    body: (
      <>
        <Lead>
          O slide D2 pede &quot;lembretes de serviço e ofertas&quot; — a gente implementou
          isso como <b>envio REAL de e-mail</b> via provider Resend, com templates por perfil
          comportamental, registro em <Code>email_logs</Code> e auditoria LGPD.
        </Lead>

        <H3>Como configurar (3 minutos)</H3>
        <Steps>
          <Step n={1} title="Cria conta na Resend">
            <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-ford-blue underline">resend.com</a>
            {' '}— grátis 100 e-mails/dia. Login com GitHub.
          </Step>
          <Step n={2} title="Pega a API key">
            Resend Console → <b>API Keys</b> → <b>Create API Key</b> → copia o token
            (<Code>re_xxxxx</Code>).
          </Step>
          <Step n={3} title="Cola em /configuracoes">
            Aba <b>Chaves de API</b> → campo <b>Resend (e-mail)</b> → cola e salva.
          </Step>
          <Step n={4} title="Opcional: define remetente">
            Campo <b>Remetente de e-mail</b>. Pra sandbox use
            {' '}<Code>FordIQ &lt;onboarding@resend.dev&gt;</Code>. Pra produção precisa
            de domínio verificado no Resend.
          </Step>
        </Steps>

        <H3>Como enviar e-mail real</H3>
        <Steps>
          <Step n={1} title="Abre ficha do cliente">
            Em <Code>/leads</Code> ou <Code>/clientes</Code>, clica em qualquer um.
          </Step>
          <Step n={2} title="Botão + NOVA AÇÃO">
            No bloco &quot;Histórico de ações&quot;.
          </Step>
          <Step n={3} title="Tipo = E-mail">
            Sistema carrega o template do perfil do cliente (fiel = convite VIP,
            esquecido = lembrete de revisão, abandono = oferta de 30% desconto,
            econômico = pacote preço fechado). Você pode editar o HTML antes de enviar.
          </Step>
          <Step n={4} title="Verifica o banner verde/amarelo">
            Banner verde = Resend OK, envio vai REAL. Banner amarelo = não tem chave,
            modo simulação (registra ação mas não envia).
          </Step>
          <Step n={5} title="Clica ENVIAR E-MAIL REAL">
            E-mail sai pro destinatário, ação fica em <Code>/acoes</Code> com
            status <code>concluida_sucesso</code> e Message ID do Resend no desfecho.
          </Step>
        </Steps>

        <H3>Modo simulação (sem chave Resend)</H3>
        <Callout type="warning">
          Se não configurar Resend, o sistema <b>NÃO envia e-mail</b> — mas continua
          funcionando em modo simulação: registra a ação no histórico com status
          <Code>planejada</Code> e desfecho explícito <i>&quot;SIMULAÇÃO — e-mail NÃO foi
          enviado&quot;</i>. Nada de status verde enganoso.
        </Callout>

        <H3>Auditoria LGPD</H3>
        <p>
          Cada envio cria 1 linha em <Code>public.email_logs</Code>:
        </p>
        <ul className="list-disc list-inside text-sm text-slate ml-2 space-y-1">
          <li>Remetente + destinatário + assunto</li>
          <li>Preview do corpo (200 chars — não loga corpo completo se contém dados sensíveis)</li>
          <li>Provider (resend/mock), Message ID, status (sent/delivered/bounced/failed)</li>
          <li>sent_by_user_id (quem disparou) + timestamps</li>
        </ul>
        <p className="text-xs text-slate">
          RLS: usuário comum vê só os e-mails que ele mesmo mandou. Admin/gestor vê tudo.
        </p>
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

  // ===== DADOS REAIS =====
  {
    id: 'dados-reais-ford',
    icon: Database,
    title: 'Dados reais Ford BR (175k VINs)',
    summary: '174.554 VINs reais importados — sistema rodando 100% sobre o dataset Ford',
    body: (
      <>
        <Lead>
          A Ford disponibilizou dois arquivos oficiais com dados reais que substituem
          os dados sintéticos no nosso pipeline: o catálogo da Ranger 26MY (D1) e o
          log de manutenção de 175k veículos no Brasil (D2).
        </Lead>

        <H3>📋 Arquivo D1 — Data sheet da Ranger 26MY</H3>
        <p>
          Planilha oficial Ford com <b>262 itens de equipamento</b> organizados em
          14 seções (Engine, Wheels, Connectivity, Safety, High tech, 4X4, Comfort,
          Lights, etc.) para as 3 versões da Ranger 26MY:
        </p>
        <Grid cols={3}>
          <FeatureCard icon={Car} title="XLT 3.0L V6">
            Versão de entrada · 78 equipamentos de série · 2283 kg · rodas aro 17
          </FeatureCard>
          <FeatureCard icon={Car} title="Limited 3.0L V6">
            Versão intermediária · 93 equipamentos · 2357 kg · rodas aro 18 ·
            ar climatizador, retrovisor cromado
          </FeatureCard>
          <FeatureCard icon={Car} title="Limited + 3.0L V6">
            Topo da linha · 95 equipamentos · rodas aro 20 · centralização de faixa, MyKey
          </FeatureCard>
        </Grid>
        <Callout type="success">
          Importadas via <Code>scripts/import-ford-d1-ranger.py</Code> com confiança ALTA
          e source <Code>manufacturer:ford-official</Code>. Aparecem em <Code>/veiculos</Code>
          marcadas como verificadas por humano.
        </Callout>

        <H3>🆕 Schema Ford agora é o oficial do sistema</H3>
        <p>
          A tabela <Code>clients</Code> foi adaptada pra usar EXATAMENTE os mesmos campos
          do dataset Ford BR. Cadastros antigos sintéticos continuam coexistindo, mas:
        </p>
        <Grid cols={2}>
          <FeatureCard icon={Database} title="Campos canônicos Ford">
            <Code>vin_hash</Code>, <Code>model_name</Code>, <Code>model_year</Code>,
            {' '}<Code>dealer_code_venda</Code>, <Code>sales_date</Code>,
            {' '}<Code>warranty_start_date</Code>, <Code>km_max</Code>, <Code>num_revisoes</Code>,
            {' '}<Code>dealer_loyalty</Code>, <Code>perfil_real</Code>.
          </FeatureCard>
          <FeatureCard icon={Users} title="Cadastro com dropdown de modelos Ford">
            <Code>/clientes/novo</Code> agora pede só campos disponíveis no faturamento real:
            modelo (RANGER/KA/EcoSport/Territory/...), ano, DealerCode, datas. Sócio-demográfico
            é opcional (collapsed).
          </FeatureCard>
          <FeatureCard icon={Search} title="Filtros por modelo + origem">
            Lista de clientes agora distingue <b>Ford BR real</b> (174k VINs) vs
            <b>cadastros manuais</b>. Filtros: modelo, perfil_real, origem.
          </FeatureCard>
          <FeatureCard icon={Award} title="Bloco Ford BR na ficha">
            Quando o cliente é real, <Code>/clientes/[id]</Code> mostra: KM máx, revisões,
            dealer loyalty, dias desde última revisão, datas de venda/entrega/garantia.
          </FeatureCard>
        </Grid>

        <H3>📊 Arquivo D2 — vin_share_Desafio_02.xlsx</H3>
        <Grid cols={4}>
          <StatBlock value="175k" label="VINs únicos no Brasil" />
          <StatBlock value="600k" label="Service orders" />
          <StatBlock value="435" label="Concessionárias" />
          <StatBlock value="20" label="Modelos diferentes" />
        </Grid>
        <p>
          Modelos mais frequentes: <b>Ranger</b> (342k orders), <b>Ka</b> (134k),
          {' '}EcoSport (45k), Territory (27k), Bronco Sport (17k), Maverick (15k),
          Transit (12k), F-150, Mustang, Edge, Mach-E.
          {' '}Período: vendas <i>02/2020 → 09/2025</i>, serviços <i>01/2022 → 04/2024</i>.
        </p>

        <H3>Pipeline ETL</H3>
        <PipelineList>
          <PipelineStep n={1} name="Conversão XLSX → Parquet" desc="600k linhas comprimidas em 48 MB · 100× mais rápido pra carregar" />
          <PipelineStep n={2} name="Agregação por VIN_Hash" desc="cada VIN vira 1 linha com 18 features comportamentais" />
          <PipelineStep n={3} name="Derivação de labels reais" desc="regras heurísticas geram perfis (fiel/esquecido/econômico/abandono) a partir do comportamento observado" />
          <PipelineStep n={4} name="Re-treino XGBoost" desc="modelo classifier_real_v1 treinado com 140k amostras reais" />
          <PipelineStep n={5} name="Pré-computa KPIs" desc="agregados servidos via /metrics/ford-real (cache 5min)" />
        </PipelineList>

        <H3>Modelo treinado nos dados reais</H3>
        <Grid cols={4}>
          <StatBlock value="62.7%" label="accuracy no test set" />
          <StatBlock value="0.60" label="F1 weighted" />
          <StatBlock value="76%" label="F1 esquecido (classe forte)" />
          <StatBlock value="0%" label="data leakage — auditado" />
        </Grid>

        <H3>Insights de negócio extraídos</H3>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li><b>55% dos clientes Ford BR são &quot;esquecidos&quot;</b> — perdem timing de revisão mas não abandonam por completo. Estratégia certa: lembretes proativos via WhatsApp + ofertas de busca/entrega.</li>
          <li><b>Ka tem o maior abandono absoluto</b> (14.697 VINs) — modelo de entrada, perfil mais propenso a buscar oficina barata.</li>
          <li><b>Ranger é a base de fidelização</b> — 20.873 fiéis de 78k VINs. Picape engaja por uso profissional.</li>
          <li><b>F-150 e Mustang têm churn praticamente zero</b> — clientes premium fidelizados naturalmente.</li>
        </ul>

        <Callout type="info">
          Veja todos os números em <Code>/visao-ford</Code> — dashboard agregado sobre
          a base real.
        </Callout>
      </>
    ),
  },

  // ===== HYBRID =====
  {
    id: 'classificacao-hibrida',
    icon: Brain,
    title: 'Classificação híbrida ML + IA',
    summary: 'Por que combinamos os dois e quando cada um pesa mais',
    body: (
      <>
        <Lead>
          ML puro tem limites (60% de acurácia, ignora texto). IA pura também (caro, lento,
          não-determinístico). O sistema combina os dois — ML é baseline rápido e barato,
          IA é crítico contextual quando você pede ou quando o ML está em zona cinza.
        </Lead>

        <H3>Por que o ensemble?</H3>
        <Grid cols={2}>
          <FeatureCard icon={Activity} title="ML sozinho">
            Rápido (50ms), grátis, determinístico — mas ignora texto livre,
            histórico de ações, e tem confiança limitada em casos ambíguos.
          </FeatureCard>
          <FeatureCard icon={Sparkles} title="IA sozinha">
            Vê contexto rico, explica o raciocínio — mas custa $$$, demora 2-5s,
            pode alucinar, e LGPD trata decisão totalmente automatizada por LLM
            com mais rigor.
          </FeatureCard>
        </Grid>

        <H3>Como funciona o ensemble</H3>
        <Steps>
          <Step n={1} title="ML roda primeiro (sempre)">
            XGBoost dá a predição baseline com confiança. Custo zero, latência baixa.
          </Step>
          <Step n={2} title="IA roda se você pediu OU se ML está incerto">
            Quando o vendedor clica em <b>Reclassificar ML + IA</b> na ficha do cliente,
            OU quando a confiança do ML é &lt; 60%, o LLM é acionado com contexto
            completo: features + notas livres do vendedor + histórico de ações.
          </Step>
          <Step n={3} title="Concordância → fusão de probabilidades">
            Se ML e IA chegam no mesmo perfil, as probabilidades viram uma média
            ponderada (peso da IA cresce com sua confiança auto-reportada).
            Resultado é mais robusto que cada modelo sozinho.
          </Step>
          <Step n={4} title="Divergência → revisão humana">
            Se discordam, o sistema mostra <b>os dois lados a lado</b> + raciocínio
            da IA + sinais qualitativos detectados. O perfil final vai com quem tem
            maior confiança individual, mas marca <code>human_review_needed=true</code>
            pra você confirmar antes de tomar ação.
          </Step>
        </Steps>

        <H3>O que a IA enxerga que o ML não vê</H3>
        <Grid cols={3}>
          <StatBlock value="Notas" label="Texto livre do vendedor — reclamações, intenções, contexto" />
          <StatBlock value="Ações" label="Histórico de toques anteriores + desfechos (sucesso/recusa)" />
          <StatBlock value="Sinais" label="Tags qualitativas extraídas do texto (ex: menciona_preco_alto)" />
        </Grid>

        <H3>Custos por chamada</H3>
        <SourceTable2 />

        <Callout type="success">
          <b>Defaults seguros:</b> em listagens (carteira/leads), você vê só o ML
          (rápido + grátis). Pra abrir o crítico de IA, é 1 clique na ficha do cliente
          — quando você precisa da resposta robusta antes de uma ligação importante.
        </Callout>

        <H3>Onde isso está no código</H3>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate ml-2">
          <li><Code>apps/api/src/modules/retention/ai-classifier.ts</Code> — prompt + chamada LLM</li>
          <li><Code>apps/api/src/modules/retention/hybrid-classifier.ts</Code> — lógica do ensemble</li>
          <li><Code>POST /clients/:id/reclassify</Code> — endpoint que dispara o híbrido</li>
          <li><Code>PATCH /clients/:id/notas</Code> — atualiza notas livres do consultor</li>
          <li>Migration <Code>20260514_010_hybrid_classifier.sql</Code> — colunas <code>source</code>,
            {' '}<code>raciocinio</code>, <code>signals_detected</code>, <code>ml_perfil</code>,
            {' '}<code>ai_perfil</code>, <code>concordancia</code></li>
        </ul>
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
function SourceTable2() {
  const rows = [
    ['ML (XGBoost)',           'Sempre, em background',                     'Sem custo',          '50ms'],
    ['IA crítico (gpt-4o-mini)', 'Quando solicitado ou ML confidence < 60%','~$0.01-0.05',        '2-5s'],
    ['Ensemble (ML + IA)',     'Quando IA roda',                            'Custo do LLM apenas','+1s pra mesclar'],
  ];
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-ford-blue text-white">
            <th className="px-3 py-2 text-left rounded-tl-lg">Componente</th>
            <th className="px-3 py-2 text-left">Quando roda</th>
            <th className="px-3 py-2 text-left">Custo</th>
            <th className="px-3 py-2 text-left rounded-tr-lg">Latência</th>
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
