/**
 * Carteira de demonstração — 20 clientes FICTÍCIOS de uma concessionária Ford.
 *
 * Usada apenas no modo demonstração (EXPO_PUBLIC_DATA_MODE=local).
 * Nomes e dados são inventados; não representam pessoas reais.
 *
 * Cada seed traz os dados do cliente (formato de GET /clients/:id) mais o
 * resultado esperado do modelo (perfil, risco e confiança). As probabilidades,
 * ações sugeridas e sinais de lead são derivados no LocalDataSource.
 */
import type {
  CanalAquisicao, Client, EstadoCivil, Financiamento, FordModel, Genero, Perfil, Regiao,
} from '../../types';

export type ClientSeed = Omit<Client, 'predictions'> & {
  perfil: Perfil;
  risco: number;       // 0..1
  confianca: number;   // 0..1
};

type SeedInput = {
  id: string;
  nome: string;
  modelo: FordModel;
  versao: string;
  ano: number;
  preco: number;
  vendaEm: string;                  // AAAA-MM-DD
  idade: number;
  genero: Genero;
  regiao: Regiao;
  renda: number;
  estadoCivil: EstadoCivil;
  score: number;
  financiamento: Financiamento;
  parcelas: number;
  canal: CanalAquisicao;
  primeiroCarro: boolean;
  testDrive: boolean;
  revisoes: number;
  diasSemRevisao: number | null;
  perfil: Perfil;
  risco: number;
  confianca: number;
};

function seed(input: SeedInput): ClientSeed {
  return {
    id: input.id,
    nome_cliente: input.nome,
    model_name: input.modelo,
    model_year: input.ano,
    modelo_comprado: input.modelo,
    versao_comprada: input.versao,
    preco_pago_brl: input.preco,
    perfil_real: input.perfil,
    created_at: `${input.vendaEm}T12:00:00.000Z`,
    sales_date: input.vendaEm,
    idade: input.idade,
    genero: input.genero,
    regiao: input.regiao,
    renda_mensal_brl: input.renda,
    estado_civil: input.estadoCivil,
    score_credito: input.score,
    financiamento: input.financiamento,
    parcelas: input.parcelas,
    canal_aquisicao: input.canal,
    primeiro_carro: input.primeiroCarro,
    test_drive_realizado: input.testDrive,
    num_revisoes: input.revisoes,
    dias_desde_ultima_revisao: input.diasSemRevisao,
    perfil: input.perfil,
    risco: input.risco,
    confianca: input.confianca,
  };
}

export const DEMO_CLIENT_SEEDS: ClientSeed[] = [
  // ─── Fiéis — revisam na concessionária, baixo risco ──────────────────────
  seed({ id: 'demo-cli-01', nome: 'Ana Beatriz Lima', modelo: 'RANGER', versao: 'Limited V6', ano: 2024, preco: 318_000, vendaEm: '2024-03-12', idade: 44, genero: 'F', regiao: 'sudeste', renda: 32_000, estadoCivil: 'casado', score: 860, financiamento: 'a_vista', parcelas: 0, canal: 'indicacao', primeiroCarro: false, testDrive: true, revisoes: 3, diasSemRevisao: 95, perfil: 'fiel', risco: 0.08, confianca: 0.91 }),
  seed({ id: 'demo-cli-02', nome: 'Carlos Eduardo Rocha', modelo: 'RANGER', versao: 'XLT', ano: 2023, preco: 255_000, vendaEm: '2023-06-20', idade: 52, genero: 'M', regiao: 'sul', renda: 24_000, estadoCivil: 'casado', score: 810, financiamento: 'financiado', parcelas: 36, canal: 'concessionaria', primeiroCarro: false, testDrive: true, revisoes: 4, diasSemRevisao: 140, perfil: 'fiel', risco: 0.12, confianca: 0.87 }),
  seed({ id: 'demo-cli-03', nome: 'Juliana Martins', modelo: 'TERRITORY', versao: 'Titanium', ano: 2025, preco: 215_000, vendaEm: '2025-01-15', idade: 38, genero: 'F', regiao: 'sudeste', renda: 21_000, estadoCivil: 'casado', score: 790, financiamento: 'financiado', parcelas: 24, canal: 'concessionaria', primeiroCarro: false, testDrive: true, revisoes: 2, diasSemRevisao: 60, perfil: 'fiel', risco: 0.10, confianca: 0.84 }),
  seed({ id: 'demo-cli-04', nome: 'Roberto Almeida', modelo: 'F-150', versao: 'Lariat', ano: 2024, preco: 520_000, vendaEm: '2024-08-02', idade: 57, genero: 'M', regiao: 'centro_oeste', renda: 65_000, estadoCivil: 'casado', score: 900, financiamento: 'a_vista', parcelas: 0, canal: 'indicacao', primeiroCarro: false, testDrive: true, revisoes: 2, diasSemRevisao: 120, perfil: 'fiel', risco: 0.06, confianca: 0.93 }),
  seed({ id: 'demo-cli-05', nome: 'Patrícia Souza', modelo: 'BRONCO SPORT', versao: 'Wildtrak', ano: 2024, preco: 265_000, vendaEm: '2024-05-18', idade: 41, genero: 'F', regiao: 'sul', renda: 26_000, estadoCivil: 'divorciado', score: 820, financiamento: 'leasing', parcelas: 36, canal: 'concessionaria', primeiroCarro: false, testDrive: true, revisoes: 3, diasSemRevisao: 110, perfil: 'fiel', risco: 0.15, confianca: 0.82 }),
  seed({ id: 'demo-cli-06', nome: 'Marcelo Tavares', modelo: 'MAVERICK', versao: 'Lariat FX4', ano: 2025, preco: 245_000, vendaEm: '2025-02-27', idade: 35, genero: 'M', regiao: 'sudeste', renda: 19_500, estadoCivil: 'casado', score: 770, financiamento: 'financiado', parcelas: 48, canal: 'online', primeiroCarro: false, testDrive: true, revisoes: 2, diasSemRevisao: 75, perfil: 'fiel', risco: 0.18, confianca: 0.79 }),
  seed({ id: 'demo-cli-07', nome: 'Fernanda Castro', modelo: 'MUSTANG', versao: 'GT Performance', ano: 2024, preco: 530_000, vendaEm: '2024-10-09', idade: 46, genero: 'F', regiao: 'sudeste', renda: 58_000, estadoCivil: 'solteiro', score: 880, financiamento: 'a_vista', parcelas: 0, canal: 'concessionaria', primeiroCarro: false, testDrive: true, revisoes: 2, diasSemRevisao: 150, perfil: 'fiel', risco: 0.09, confianca: 0.90 }),

  // ─── Abandono — pararam de revisar na rede, alto risco ──────────────────
  seed({ id: 'demo-cli-08', nome: 'Diego Nascimento', modelo: 'RANGER', versao: 'XLS', ano: 2021, preco: 198_000, vendaEm: '2021-04-10', idade: 33, genero: 'M', regiao: 'nordeste', renda: 11_000, estadoCivil: 'solteiro', score: 610, financiamento: 'financiado', parcelas: 60, canal: 'online', primeiroCarro: false, testDrive: false, revisoes: 1, diasSemRevisao: 780, perfil: 'abandono', risco: 0.91, confianca: 0.88 }),
  seed({ id: 'demo-cli-09', nome: 'Luciana Ferreira', modelo: 'ECOSPORT', versao: 'Freestyle', ano: 2020, preco: 98_000, vendaEm: '2020-09-14', idade: 29, genero: 'F', regiao: 'sudeste', renda: 7_800, estadoCivil: 'solteiro', score: 580, financiamento: 'financiado', parcelas: 60, canal: 'online', primeiroCarro: true, testDrive: false, revisoes: 1, diasSemRevisao: 1150, perfil: 'abandono', risco: 0.94, confianca: 0.90 }),
  seed({ id: 'demo-cli-10', nome: 'Rafael Gomes', modelo: 'RANGER', versao: 'XL Cabine Simples', ano: 2022, preco: 205_000, vendaEm: '2022-02-03', idade: 48, genero: 'M', regiao: 'centro_oeste', renda: 15_000, estadoCivil: 'casado', score: 640, financiamento: 'consorcio', parcelas: 72, canal: 'frota', primeiroCarro: false, testDrive: false, revisoes: 2, diasSemRevisao: 520, perfil: 'abandono', risco: 0.82, confianca: 0.81 }),
  seed({ id: 'demo-cli-11', nome: 'Thiago Barbosa', modelo: 'KA', versao: 'SE Plus', ano: 2020, preco: 62_000, vendaEm: '2020-11-22', idade: 26, genero: 'M', regiao: 'norte', renda: 5_200, estadoCivil: 'solteiro', score: 540, financiamento: 'financiado', parcelas: 60, canal: 'online', primeiroCarro: true, testDrive: false, revisoes: 0, diasSemRevisao: null, perfil: 'abandono', risco: 0.96, confianca: 0.92 }),
  seed({ id: 'demo-cli-12', nome: 'Camila Ribeiro', modelo: 'TERRITORY', versao: 'SEL', ano: 2022, preco: 189_000, vendaEm: '2022-07-30', idade: 37, genero: 'F', regiao: 'nordeste', renda: 13_500, estadoCivil: 'casado', score: 650, financiamento: 'financiado', parcelas: 48, canal: 'online', primeiroCarro: false, testDrive: false, revisoes: 1, diasSemRevisao: 610, perfil: 'abandono', risco: 0.78, confianca: 0.76 }),

  // ─── Esquecidos — atrasam revisão, mas ainda voltam ─────────────────────
  seed({ id: 'demo-cli-13', nome: 'Gustavo Pereira', modelo: 'RANGER', versao: 'XLT', ano: 2023, preco: 248_000, vendaEm: '2023-01-25', idade: 39, genero: 'M', regiao: 'sul', renda: 17_000, estadoCivil: 'casado', score: 720, financiamento: 'financiado', parcelas: 48, canal: 'concessionaria', primeiroCarro: false, testDrive: true, revisoes: 2, diasSemRevisao: 410, perfil: 'esquecido', risco: 0.58, confianca: 0.72 }),
  seed({ id: 'demo-cli-14', nome: 'Beatriz Carvalho', modelo: 'BRONCO SPORT', versao: 'Big Bend', ano: 2023, preco: 228_000, vendaEm: '2023-04-08', idade: 31, genero: 'F', regiao: 'sudeste', renda: 14_000, estadoCivil: 'solteiro', score: 700, financiamento: 'financiado', parcelas: 60, canal: 'concessionaria', primeiroCarro: false, testDrive: true, revisoes: 2, diasSemRevisao: 390, perfil: 'esquecido', risco: 0.55, confianca: 0.70 }),
  seed({ id: 'demo-cli-15', nome: 'Eduardo Monteiro', modelo: 'MAVERICK', versao: 'Hybrid', ano: 2023, preco: 225_000, vendaEm: '2023-09-11', idade: 45, genero: 'M', regiao: 'sudeste', renda: 20_000, estadoCivil: 'divorciado', score: 740, financiamento: 'a_vista', parcelas: 0, canal: 'concessionaria', primeiroCarro: false, testDrive: true, revisoes: 1, diasSemRevisao: 440, perfil: 'esquecido', risco: 0.62, confianca: 0.68 }),
  seed({ id: 'demo-cli-16', nome: 'Mariana Duarte', modelo: 'TRANSIT', versao: 'Van Furgão', ano: 2023, preco: 295_000, vendaEm: '2023-03-19', idade: 50, genero: 'F', regiao: 'nordeste', renda: 28_000, estadoCivil: 'casado', score: 760, financiamento: 'leasing', parcelas: 36, canal: 'frota', primeiroCarro: false, testDrive: false, revisoes: 3, diasSemRevisao: 370, perfil: 'esquecido', risco: 0.51, confianca: 0.66 }),

  // ─── Econômicos — sensíveis a preço de revisão ─────────────────────────
  seed({ id: 'demo-cli-17', nome: 'Paulo Henrique Dias', modelo: 'RANGER', versao: 'XLS', ano: 2022, preco: 210_000, vendaEm: '2022-10-05', idade: 42, genero: 'M', regiao: 'centro_oeste', renda: 12_500, estadoCivil: 'casado', score: 680, financiamento: 'consorcio', parcelas: 80, canal: 'concessionaria', primeiroCarro: false, testDrive: true, revisoes: 3, diasSemRevisao: 250, perfil: 'economico', risco: 0.42, confianca: 0.74 }),
  seed({ id: 'demo-cli-18', nome: 'Aline Moreira', modelo: 'KA', versao: 'SE', ano: 2021, preco: 68_000, vendaEm: '2021-06-17', idade: 34, genero: 'F', regiao: 'sudeste', renda: 6_900, estadoCivil: 'casado', score: 660, financiamento: 'financiado', parcelas: 48, canal: 'concessionaria', primeiroCarro: false, testDrive: true, revisoes: 4, diasSemRevisao: 300, perfil: 'economico', risco: 0.47, confianca: 0.71 }),
  seed({ id: 'demo-cli-19', nome: 'Renato Figueiredo', modelo: 'ECOSPORT', versao: 'SE', ano: 2021, preco: 105_000, vendaEm: '2021-08-21', idade: 55, genero: 'M', regiao: 'sul', renda: 9_800, estadoCivil: 'viuvo', score: 700, financiamento: 'a_vista', parcelas: 0, canal: 'indicacao', primeiroCarro: false, testDrive: true, revisoes: 4, diasSemRevisao: 280, perfil: 'economico', risco: 0.38, confianca: 0.69 }),
  seed({ id: 'demo-cli-20', nome: 'Sofia Andrade', modelo: 'TERRITORY', versao: 'SEL', ano: 2023, preco: 192_000, vendaEm: '2023-11-02', idade: 30, genero: 'F', regiao: 'norte', renda: 11_000, estadoCivil: 'solteiro', score: 690, financiamento: 'financiado', parcelas: 60, canal: 'online', primeiroCarro: true, testDrive: true, revisoes: 2, diasSemRevisao: 210, perfil: 'economico', risco: 0.44, confianca: 0.67 }),
];
