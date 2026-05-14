// Tipos compartilhados entre API, Mobile, e (referência para) ML.
// Mantenha em sincronia com supabase/migrations/*.sql.

export const CLIENT_PROFILES = ['fiel', 'abandono', 'esquecido', 'economico'] as const;
export type ClientProfile = typeof CLIENT_PROFILES[number];

export const REGIOES = ['sul', 'sudeste', 'centro_oeste', 'nordeste', 'norte'] as const;
export type Regiao = typeof REGIOES[number];

export const FINANCIAMENTOS = ['a_vista', 'financiado', 'leasing', 'consorcio'] as const;
export type Financiamento = typeof FINANCIAMENTOS[number];

export const CANAIS = ['concessionaria', 'online', 'frota', 'indicacao'] as const;
export type CanalAquisicao = typeof CANAIS[number];

export const GENEROS = ['M', 'F', 'outro'] as const;
export const ESTADOS_CIVIS = ['solteiro', 'casado', 'divorciado', 'viuvo'] as const;

// =========== DESAFIO 2 — Cliente ===========

export type ClientBase2Input = {
  idade: number;
  genero: 'M' | 'F' | 'outro';
  regiao: Regiao;
  renda_mensal_brl: number;
  estado_civil: 'solteiro' | 'casado' | 'divorciado' | 'viuvo';
  score_credito: number;
  modelo_comprado: string;
  versao_comprada: string;
  preco_pago_brl: number;
  financiamento: Financiamento;
  parcelas: number;
  canal_aquisicao: CanalAquisicao;
  primeiro_carro: boolean;
  test_drive_realizado: boolean;
  dealership_id: string;
};

export type ClientRecord = ClientBase2Input & {
  id: string;
  cpf_hash: string | null;
  nome_cliente: string | null;
  data_compra: string;
  created_at: string;
};

export type Prediction = {
  id: string;
  client_id: string;
  model_version: string;
  perfil_predito: ClientProfile;
  probabilidades: Record<ClientProfile, number>;
  risco_evasao: number;
  confianca: number;
  recomendacoes_acao: string[];
  created_at: string;
};

// =========== DESAFIO 1 — Veículo ===========

export type VehicleMotor = {
  cilindrada_cc: number | null;
  potencia_cv: number | null;
  torque_nm: number | null;
  combustivel: string | null;
  aspiracao: string | null;
  cilindros: number | null;
};

export type VehicleDimensoes = {
  comprimento_mm: number | null;
  largura_mm: number | null;
  altura_mm: number | null;
  entre_eixos_mm: number | null;
  vao_livre_mm: number | null;
  peso_kg: number | null;
  capacidade_porta_malas_l: number | null;
  capacidade_cacamba_l: number | null;
  capacidade_carga_kg: number | null;
  capacidade_reboque_kg: number | null;
};

export type VehicleTransmissao = {
  tipo: string | null;
  marchas: number | null;
  tracao: string | null;
};

export type VehicleDesempenho = {
  aceleracao_0_100_s: number | null;
  velocidade_max_kmh: number | null;
  consumo_cidade_kml: number | null;
  consumo_estrada_kml: number | null;
  autonomia_km: number | null;
};

export type Vehicle = {
  id: string;
  schema_version: string;
  marca: string;
  modelo: string;
  versao: string;
  ano: number;
  categoria: string;
  motor: VehicleMotor;
  dimensoes: VehicleDimensoes;
  transmissao: VehicleTransmissao;
  desempenho: VehicleDesempenho;
  equipamentos: string[];
  preco_brl: number | null;
  pais_origem: string | null;
  fontes: string[];
  created_at: string;
  updated_at: string;
};

// Atributos comparáveis com critério (max/min/none)
export type ComparisonCriterion = 'max' | 'min' | 'none';

export type ComparisonField = {
  label: string;
  path: string;
  values: (string | number | null)[];
  winner_index: number | null;
  criterion: ComparisonCriterion;
};

export type ComparisonResponse = {
  vehicles: Vehicle[];
  fields: ComparisonField[];
  // Resumo gerado por LLM se disponível
  summary: string | null;
};

// =========== Lookup com fields dinâmicos (requisito Ford) ===========
// "A ferramenta deve permitir que o usuário defina livremente a lista
//  de atributos técnicos que deseja pesquisar"
export type FieldKey =
  | 'motor' | 'dimensoes' | 'transmissao' | 'desempenho'
  | 'equipamentos' | 'preco_brl' | 'pais_origem'
  | 'motor.potencia_cv' | 'motor.torque_nm' | 'motor.cilindrada_cc'
  | 'motor.combustivel' | 'motor.aspiracao'
  | 'transmissao.tracao' | 'transmissao.tipo'
  | 'desempenho.aceleracao_0_100_s' | 'desempenho.velocidade_max_kmh'
  | 'desempenho.consumo_cidade_kml' | 'desempenho.consumo_estrada_kml'
  | 'dimensoes.entre_eixos_mm' | 'dimensoes.vao_livre_mm'
  | 'dimensoes.capacidade_reboque_kg' | 'dimensoes.capacidade_carga_kg'
  | 'dimensoes.capacidade_cacamba_l';
