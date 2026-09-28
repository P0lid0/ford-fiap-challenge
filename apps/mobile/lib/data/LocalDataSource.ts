/**
 * Implementação de DataSource do MODO DEMONSTRAÇÃO (EXPO_PUBLIC_DATA_MODE=local).
 *
 * Funciona 100% offline — é o modo usado no APK de entrega (ver eas.json):
 *  - login fixo de demonstração;
 *  - carteira = 20 clientes de exemplo + clientes cadastrados (salvos no AsyncStorage);
 *  - métricas e leads calculados a partir da carteira (mesmas regras da API);
 *  - classificação por regras (LocalRiskClassifier) no lugar do serviço de ML;
 *  - insights em texto gerado por regras no lugar da IA generativa.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CANAIS_AQUISICAO, ESTADOS_CIVIS, FINANCIAMENTOS, FORD_MODELS, GENEROS, PERFIS, REGIOES,
  type Client,
  type ClientDetail,
  type ClientPage,
  type ClientSummary,
  type ComparisonResult,
  type CreatedClient,
  type DealershipMetrics,
  type Insight,
  type Lead,
  type LeadSinal,
  type NewClientInput,
  type Perfil,
  type PortfolioInsight,
  type Prediction,
  type UserSession,
  type Vehicle,
} from '../types';
import { DataSourceError, type DataSource, type SessionListener } from './DataSource';
import { buildPrediction, classify, toPrediction } from './LocalRiskClassifier';
import { compareVehicles } from './LocalVehicleComparator';
import { DEMO_CLIENT_SEEDS } from './mock/clients';
import { DEMO_VEHICLES } from './mock/vehicles';

/** Mesmo login de demonstração documentado para a web e a API (README §7). */
export const DEMO_CREDENTIALS = {
  email: 'admin@faroai.com.br',
  password: 'Ford2026!',
} as const;

const SESSION_STORAGE_KEY = 'faroai.demo.session';
const CLIENTS_STORAGE_KEY = 'faroai.demo.clients';

const LATENCY_MIN_MS = 300;
const LATENCY_MAX_MS = 600;

const DAY_MS = 24 * 60 * 60 * 1000;
const WARRANTY_YEARS = 3;

/** Pesos dos sinais no risco composto — mesmos da função SQL leads_ranqueados. */
const SINAL_WEIGHT: Partial<Record<LeadSinal, number>> = {
  revisao_atrasada: 0.10,
  garantia_vencida: 0.05,
  dealer_loyalty_baixa: 0.05,
  veiculo_veterano: 0.03,
  sem_revisao_alguma: 0.07,
};

const PERFIL_LABEL: Record<Perfil, string> = {
  fiel: 'fiel',
  abandono: 'abandono',
  esquecido: 'esquecido',
  economico: 'econômico',
};

const SINAL_LABEL: Record<LeadSinal, string> = {
  revisao_atrasada: 'revisão atrasada há mais de 1 ano',
  garantia_vencida: 'garantia de fábrica vencida',
  garantia_vencendo: 'garantia vencendo nos próximos 90 dias',
  dealer_loyalty_baixa: 'baixa fidelidade à concessionária',
  veiculo_veterano: 'veículo com 5 anos ou mais',
  sem_revisao_alguma: 'nenhuma revisão feita na rede',
};

/** Registro da carteira: cliente + predição mais recente. */
type PortfolioEntry = { client: Client; prediction: Prediction };

export class LocalDataSource implements DataSource {
  readonly mode = 'local' as const;

  private session: UserSession | null = null;
  private sessionLoaded = false;
  private readonly listeners = new Set<SessionListener>();

  private createdEntries: PortfolioEntry[] | null = null;
  private readonly seedEntries: PortfolioEntry[] = DEMO_CLIENT_SEEDS.map(
    ({ perfil, risco, confianca, ...client }) => ({
      client: {
        ...client,
        predictions: [{ perfil_predito: perfil, risco_evasao: risco, confianca, created_at: client.created_at }],
      },
      prediction: buildPrediction({ clientId: client.id, perfil, risco, confianca, createdAt: client.created_at }),
    }),
  );

  // ─── Autenticação ─────────────────────────────────────────

  async getSession(): Promise<UserSession | null> {
    if (!this.sessionLoaded) {
      this.session = await readJson<UserSession>(SESSION_STORAGE_KEY);
      this.sessionLoaded = true;
    }
    return this.session;
  }

  async signIn(email: string, password: string): Promise<UserSession> {
    await simulateLatency();
    const isValid = email.trim().toLowerCase() === DEMO_CREDENTIALS.email
      && password === DEMO_CREDENTIALS.password;
    if (!isValid) {
      throw new DataSourceError('unauthorized', 'E-mail ou senha inválidos.');
    }
    const session: UserSession = {
      userId: 'demo-user',
      email: DEMO_CREDENTIALS.email,
      accessToken: 'demo-token',
    };
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    this.setSession(session);
    return session;
  }

  async signOut(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => undefined);
    this.setSession(null);
  }

  onSessionChange(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // ─── Desafio 2 — Retenção ─────────────────────────────────

  async getMetrics(): Promise<DealershipMetrics> {
    await simulateLatency();
    const entries = await this.portfolio();
    const total = entries.length;

    const perfilCounts = countByPerfil(entries);
    const ativos = entries.filter(({ client }) => isActive(client)).length;
    const aderentes = entries.filter(({ client }) => (client.num_revisoes ?? 0) >= 2).length;

    const porModelo: Record<string, number> = {};
    entries.forEach(({ client }) => {
      porModelo[client.model_name] = (porModelo[client.model_name] ?? 0) + 1;
    });

    return {
      total_clientes: total,
      clientes_ativos: ativos,
      vin_share_estimado: ratio(ativos, total),
      taxa_aderencia_revisoes: ratio(aderentes, total),
      // Mesma heurística da API: abandono + 40% dos esquecidos
      alto_risco_count: perfilCounts.abandono + Math.round(perfilCounts.esquecido * 0.4),
      perfil_counts: perfilCounts,
      por_modelo: porModelo,
    };
  }

  async listClients(): Promise<ClientPage> {
    await simulateLatency();
    const entries = await this.portfolio();
    const results: ClientSummary[] = [...entries]
      .sort((a, b) => b.client.created_at.localeCompare(a.client.created_at))
      .map(({ client }) => client);
    return { total: results.length, results };
  }

  async getClient(id: string): Promise<ClientDetail> {
    await simulateLatency();
    const entry = (await this.portfolio()).find(e => e.client.id === id);
    if (!entry) throw new DataSourceError('not_found', 'Cliente não encontrado.');
    return { client: entry.client, predictions: [entry.prediction] };
  }

  async createClient(input: NewClientInput): Promise<CreatedClient> {
    await simulateLatency();
    validateNewClient(input);

    const id = `demo-new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    const result = classify(input);
    const prediction = toPrediction(id, result, createdAt);

    const client: Client = {
      id,
      nome_cliente: input.nome_cliente?.trim() || null,
      model_name: input.model_name,
      model_year: input.model_year,
      modelo_comprado: input.model_name,
      versao_comprada: input.versao_comprada.trim(),
      preco_pago_brl: input.preco_pago_brl,
      perfil_real: null, // ainda não há histórico pós-venda
      created_at: createdAt,
      sales_date: input.sales_date,
      idade: input.idade,
      genero: input.genero,
      regiao: input.regiao,
      renda_mensal_brl: input.renda_mensal_brl,
      estado_civil: input.estado_civil,
      score_credito: input.score_credito,
      financiamento: input.financiamento,
      parcelas: input.parcelas,
      canal_aquisicao: input.canal_aquisicao,
      primeiro_carro: input.primeiro_carro,
      test_drive_realizado: input.test_drive_realizado,
      num_revisoes: 0,
      dias_desde_ultima_revisao: null,
      predictions: [{
        perfil_predito: prediction.perfil_predito,
        risco_evasao: prediction.risco_evasao,
        confianca: prediction.confianca,
        created_at: createdAt,
      }],
    };

    const created = await this.loadCreatedEntries();
    this.createdEntries = [{ client, prediction }, ...created];
    await AsyncStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(this.createdEntries));

    return { client, prediction };
  }

  async listLeads(riscoMin = 0.5): Promise<Lead[]> {
    await simulateLatency();
    const entries = await this.portfolio();
    return entries
      .map(toLead)
      .filter(lead => lead.risco_composto >= riscoMin)
      .sort((a, b) => b.risco_composto - a.risco_composto || (a.num_revisoes ?? 0) - (b.num_revisoes ?? 0));
  }

  async getClientInsight(clientId: string): Promise<Insight> {
    const { client, predictions } = await this.getClient(clientId);
    const prediction = predictions[0]!;
    return { source: 'local', model: 'demonstração local', output: buildClientInsightText(client, prediction) };
  }

  async getPortfolioInsight(): Promise<PortfolioInsight> {
    await simulateLatency();
    const entries = await this.portfolio();
    const perfilCounts = countByPerfil(entries);
    const avgRisco = entries.length
      ? entries.reduce((sum, e) => sum + e.prediction.risco_evasao, 0) / entries.length
      : 0;
    const leads = entries.map(toLead).filter(lead => lead.risco_composto >= 0.7);

    return {
      source: 'local',
      model: 'demonstração local',
      metrics: { totalClients: entries.length, avgRisco, perfilCounts },
      output: buildPortfolioInsightText(entries.length, avgRisco, perfilCounts, leads),
    };
  }

  // ─── Desafio 1 — Inteligência Competitiva ─────────────────

  async listVehicles(): Promise<Vehicle[]> {
    await simulateLatency();
    return DEMO_VEHICLES;
  }

  async compareVehicles(vehicleIds: string[]): Promise<ComparisonResult> {
    await simulateLatency();
    if (vehicleIds.length < 2 || vehicleIds.length > 5) {
      throw new DataSourceError('validation', 'Selecione de 2 a 5 veículos para comparar.');
    }
    const vehicles = vehicleIds.map(id => DEMO_VEHICLES.find(v => v.id === id));
    if (vehicles.some(v => v === undefined)) {
      throw new DataSourceError('not_found', 'Veículo não encontrado.');
    }
    return compareVehicles(vehicles as Vehicle[]);
  }

  // ─── Estado interno ───────────────────────────────────────

  private async portfolio(): Promise<PortfolioEntry[]> {
    return [...(await this.loadCreatedEntries()), ...this.seedEntries];
  }

  private async loadCreatedEntries(): Promise<PortfolioEntry[]> {
    if (this.createdEntries === null) {
      this.createdEntries = (await readJson<PortfolioEntry[]>(CLIENTS_STORAGE_KEY)) ?? [];
    }
    return this.createdEntries;
  }

  private setSession(session: UserSession | null): void {
    this.session = session;
    this.sessionLoaded = true;
    this.listeners.forEach(listener => listener(session));
  }
}

// ─── Regras de negócio ──────────────────────────────────────

function countByPerfil(entries: PortfolioEntry[]): Record<Perfil, number> {
  const counts = Object.fromEntries(PERFIS.map(p => [p, 0])) as Record<Perfil, number>;
  entries.forEach(({ prediction }) => { counts[prediction.perfil_predito] += 1; });
  return counts;
}

/** Ativo = revisou no último ano, ou comprou há menos de um ano. */
function isActive(client: Client): boolean {
  if (client.dias_desde_ultima_revisao !== null) return client.dias_desde_ultima_revisao <= 365;
  return daysSince(client.sales_date) <= 365;
}

/** Sinais de risco — mesmas regras da função SQL leads_ranqueados. */
function sinaisOf(client: Client): LeadSinal[] {
  const sinais: LeadSinal[] = [];
  const diasDesdeVenda = daysSince(client.sales_date);
  const diasAteFimGarantia = WARRANTY_YEARS * 365 - diasDesdeVenda;

  if ((client.dias_desde_ultima_revisao ?? 0) > 365) sinais.push('revisao_atrasada');
  if (client.sales_date && diasAteFimGarantia < 0) sinais.push('garantia_vencida');
  if (client.sales_date && diasAteFimGarantia >= 0 && diasAteFimGarantia < 90) sinais.push('garantia_vencendo');
  if (client.model_year !== null && new Date().getFullYear() - client.model_year >= 5) sinais.push('veiculo_veterano');
  if (client.num_revisoes === 0 && diasDesdeVenda > 15 * 30) sinais.push('sem_revisao_alguma');
  return sinais;
}

function toLead({ client, prediction }: PortfolioEntry): Lead {
  const sinais = sinaisOf(client);
  const bonus = sinais.reduce((sum, s) => sum + (SINAL_WEIGHT[s] ?? 0), 0);
  return {
    id: client.id,
    nome_cliente: client.nome_cliente,
    model_name: client.model_name,
    model_year: client.model_year,
    perfil_real: prediction.perfil_predito,
    dias_desde_ultima_revisao: client.dias_desde_ultima_revisao,
    num_revisoes: client.num_revisoes,
    risco_composto: Math.min(0.99, round(prediction.risco_evasao + bonus)),
    sinais,
  };
}

function validateNewClient(input: NewClientInput): void {
  const errors: string[] = [];
  const isInt = (v: number) => Number.isInteger(v);
  const inRange = (v: number, min: number, max: number) => isInt(v) && v >= min && v <= max;

  if (input.nome_cliente && input.nome_cliente.trim().length > 120) errors.push('Nome: até 120 caracteres');
  if (!FORD_MODELS.includes(input.model_name)) errors.push('Modelo inválido');
  if (!inRange(input.model_year, 2010, 2030)) errors.push('Ano do modelo: entre 2010 e 2030');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sales_date)) errors.push('Data da venda inválida');
  if (!input.versao_comprada.trim() || input.versao_comprada.length > 60) errors.push('Versão: obrigatória (até 60 caracteres)');
  if (!isInt(input.preco_pago_brl) || input.preco_pago_brl <= 0) errors.push('Preço pago: valor inteiro maior que zero');
  if (!inRange(input.idade, 18, 95)) errors.push('Idade: entre 18 e 95 anos');
  if (!GENEROS.includes(input.genero)) errors.push('Gênero inválido');
  if (!REGIOES.includes(input.regiao)) errors.push('Região inválida');
  if (!isInt(input.renda_mensal_brl) || input.renda_mensal_brl < 0) errors.push('Renda mensal: valor inteiro');
  if (!ESTADOS_CIVIS.includes(input.estado_civil)) errors.push('Estado civil inválido');
  if (!inRange(input.score_credito, 0, 1000)) errors.push('Score de crédito: entre 0 e 1000');
  if (!FINANCIAMENTOS.includes(input.financiamento)) errors.push('Financiamento inválido');
  if (!inRange(input.parcelas, 0, 84)) errors.push('Parcelas: entre 0 e 84');
  if (!CANAIS_AQUISICAO.includes(input.canal_aquisicao)) errors.push('Canal inválido');

  if (errors.length > 0) {
    throw new DataSourceError('validation', `Revise os campos:\n• ${errors.join('\n• ')}`);
  }
}

// ─── Textos de insight (substituem a IA generativa) ─────────

function buildClientInsightText(client: Client, prediction: Prediction): string {
  const nome = client.nome_cliente ?? 'Este cliente';
  const perfil = PERFIL_LABEL[prediction.perfil_predito];
  const risco = percent(prediction.risco_evasao);
  const sinais = sinaisOf(client).map(s => SINAL_LABEL[s]);
  const acao = prediction.recomendacoes_acao[0];

  const partes = [
    `${nome} foi classificado(a) no perfil ${perfil}, com ${percent(prediction.confianca)} de confiança, e tem risco de evasão estimado em ${risco}.`,
  ];
  if (sinais.length > 0) {
    partes.push(`Sinais de atenção: ${sinais.join('; ')}.`);
  } else if (client.num_revisoes === 0) {
    partes.push('Ainda não há histórico de revisões — o primeiro contato pós-venda é decisivo para a retenção.');
  } else {
    partes.push('Não há sinais de alerta no histórico de revisões.');
  }
  if (acao) partes.push(`Ação prioritária: ${acao.charAt(0).toLowerCase()}${acao.slice(1)}.`);
  return partes.join(' ');
}

function buildPortfolioInsightText(
  total: number,
  avgRisco: number,
  counts: Record<Perfil, number>,
  leadsCriticos: Lead[],
): string {
  const maiorGrupoEmRisco = counts.abandono >= counts.esquecido ? 'abandono' : 'esquecido';
  return [
    `A carteira tem ${total} clientes, com risco médio de evasão de ${percent(avgRisco)}.`,
    `${counts.fiel} clientes são fiéis — base para campanhas de upgrade e indicação.`,
    `${counts.abandono} estão em abandono e ${counts.esquecido} são esquecidos; ${leadsCriticos.length} leads têm risco composto acima de 70% e devem ser contatados esta semana.`,
    maiorGrupoEmRisco === 'abandono'
      ? 'Prioridade: contato do consultor sênior e pacote de revisão com desconto para o grupo em abandono.'
      : 'Prioridade: campanha de lembrete de revisão (SMS/WhatsApp) para os clientes esquecidos.',
    `${counts.economico} clientes econômicos respondem melhor a revisão com preço fechado.`,
  ].join(' ');
}

// ─── Utilitários ────────────────────────────────────────────

function simulateLatency(): Promise<void> {
  const ms = LATENCY_MIN_MS + Math.random() * (LATENCY_MAX_MS - LATENCY_MIN_MS);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function daysSince(isoDate: string | null): number {
  if (!isoDate) return 0;
  return Math.floor((Date.now() - new Date(`${isoDate.slice(0, 10)}T00:00:00`).getTime()) / DAY_MS);
}

function ratio(part: number, total: number): number {
  return total > 0 ? round(part / total) : 0;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
