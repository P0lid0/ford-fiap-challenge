/**
 * Catálogo de demonstração — picapes médias vendidas no Brasil.
 *
 * ATENÇÃO: valores APROXIMADOS (fichas técnicas públicas, linha 2025/26),
 * usados apenas no modo demonstração (EXPO_PUBLIC_DATA_MODE=local).
 * Os dados oficiais vêm da API (Desafio 1 — Inteligência Competitiva).
 *
 * Formato idêntico a GET /competitive/vehicles.
 */
import type { Vehicle } from '../../types';

type VehicleSeed = {
  id: string;
  marca: string;
  modelo: string;
  versao: string;
  preco_brl: number;
  pais_origem: string;
  motor: {
    potencia_cv: number;
    torque_nm: number;
    cilindrada_cc: number;
    cilindros: number;
    combustivel: 'diesel' | 'gasolina' | 'flex';
    aspiracao: 'turbo' | 'biturbo';
  };
  transmissao: { tipo: 'automatica'; marchas: number; tracao: '4x4' | 'AWD' };
  desempenho: {
    aceleracao_0_100_s: number;
    velocidade_max_kmh: number;
    consumo_cidade_kml: number;
    consumo_estrada_kml: number;
  };
  dimensoes: {
    comprimento_mm: number;
    entre_eixos_mm: number;
    vao_livre_mm: number;
    peso_kg: number;
    capacidade_cacamba_l: number;
    capacidade_carga_kg: number;
    capacidade_reboque_kg: number;
  };
  equipamentos: string[];
};

const SEEDS: VehicleSeed[] = [
  {
    id: 'demo-ranger-xlt', marca: 'Ford', modelo: 'Ranger', versao: 'XLT 2.0 Diesel 4x4',
    preco_brl: 265_000, pais_origem: 'Argentina',
    motor: { potencia_cv: 170, torque_nm: 405, cilindrada_cc: 1996, cilindros: 4, combustivel: 'diesel', aspiracao: 'turbo' },
    transmissao: { tipo: 'automatica', marchas: 6, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 11.5, velocidade_max_kmh: 180, consumo_cidade_kml: 9.8, consumo_estrada_kml: 11.6 },
    dimensoes: { comprimento_mm: 5370, entre_eixos_mm: 3270, vao_livre_mm: 232, peso_kg: 2170, capacidade_cacamba_l: 1233, capacidade_carga_kg: 1000, capacidade_reboque_kg: 3500 },
    equipamentos: ['seguranca:6 airbags', 'seguranca:Frenagem autônoma', 'conforto:Ar-condicionado digital', 'multimidia:Central 10"', 'multimidia:Android Auto / Apple CarPlay sem fio'],
  },
  {
    id: 'demo-ranger-limited', marca: 'Ford', modelo: 'Ranger', versao: 'Limited 3.0 V6 Diesel 4x4',
    preco_brl: 320_000, pais_origem: 'Argentina',
    motor: { potencia_cv: 250, torque_nm: 600, cilindrada_cc: 2993, cilindros: 6, combustivel: 'diesel', aspiracao: 'turbo' },
    transmissao: { tipo: 'automatica', marchas: 10, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 8.9, velocidade_max_kmh: 190, consumo_cidade_kml: 8.4, consumo_estrada_kml: 10.5 },
    dimensoes: { comprimento_mm: 5370, entre_eixos_mm: 3270, vao_livre_mm: 232, peso_kg: 2330, capacidade_cacamba_l: 1233, capacidade_carga_kg: 1000, capacidade_reboque_kg: 3500 },
    equipamentos: ['seguranca:9 airbags', 'seguranca:Frenagem autônoma', 'seguranca:Câmera 360°', 'conforto:Bancos em couro com ajuste elétrico', 'multimidia:Central 12"', 'multimidia:Android Auto / Apple CarPlay sem fio'],
  },
  {
    id: 'demo-ranger-raptor', marca: 'Ford', modelo: 'Ranger', versao: 'Raptor 3.0 V6 Biturbo',
    preco_brl: 460_000, pais_origem: 'Tailândia',
    motor: { potencia_cv: 397, torque_nm: 583, cilindrada_cc: 2956, cilindros: 6, combustivel: 'gasolina', aspiracao: 'biturbo' },
    transmissao: { tipo: 'automatica', marchas: 10, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 5.8, velocidade_max_kmh: 180, consumo_cidade_kml: 6.1, consumo_estrada_kml: 7.9 },
    dimensoes: { comprimento_mm: 5381, entre_eixos_mm: 3270, vao_livre_mm: 272, peso_kg: 2455, capacidade_cacamba_l: 1233, capacidade_carga_kg: 650, capacidade_reboque_kg: 2500 },
    equipamentos: ['seguranca:9 airbags', 'seguranca:Câmera 360°', 'offroad:Suspensão FOX Live Valve', 'offroad:Modo Baja', 'multimidia:Central 12"', 'multimidia:Som B&O'],
  },
  {
    id: 'demo-hilux-srx', marca: 'Toyota', modelo: 'Hilux', versao: 'SRX 2.8 Diesel 4x4',
    preco_brl: 330_000, pais_origem: 'Argentina',
    motor: { potencia_cv: 204, torque_nm: 500, cilindrada_cc: 2755, cilindros: 4, combustivel: 'diesel', aspiracao: 'turbo' },
    transmissao: { tipo: 'automatica', marchas: 6, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 10.4, velocidade_max_kmh: 180, consumo_cidade_kml: 8.9, consumo_estrada_kml: 10.7 },
    dimensoes: { comprimento_mm: 5325, entre_eixos_mm: 3085, vao_livre_mm: 227, peso_kg: 2150, capacidade_cacamba_l: 1100, capacidade_carga_kg: 1000, capacidade_reboque_kg: 3500 },
    equipamentos: ['seguranca:7 airbags', 'seguranca:Frenagem autônoma', 'conforto:Bancos em couro', 'multimidia:Central 9"', 'multimidia:Android Auto / Apple CarPlay'],
  },
  {
    id: 'demo-s10-high-country', marca: 'Chevrolet', modelo: 'S10', versao: 'High Country 2.8 Diesel 4x4',
    preco_brl: 310_000, pais_origem: 'Brasil',
    motor: { potencia_cv: 207, torque_nm: 510, cilindrada_cc: 2776, cilindros: 4, combustivel: 'diesel', aspiracao: 'turbo' },
    transmissao: { tipo: 'automatica', marchas: 6, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 10.2, velocidade_max_kmh: 180, consumo_cidade_kml: 9.1, consumo_estrada_kml: 11.0 },
    dimensoes: { comprimento_mm: 5361, entre_eixos_mm: 3096, vao_livre_mm: 232, peso_kg: 2120, capacidade_cacamba_l: 1061, capacidade_carga_kg: 1000, capacidade_reboque_kg: 3500 },
    equipamentos: ['seguranca:6 airbags', 'seguranca:Alerta de colisão', 'conforto:Bancos em couro', 'multimidia:Central 11"', 'multimidia:Wi-Fi nativo'],
  },
  {
    id: 'demo-frontier-pro4x', marca: 'Nissan', modelo: 'Frontier', versao: 'Pro-4X 2.3 Biturbo Diesel 4x4',
    preco_brl: 300_000, pais_origem: 'Argentina',
    motor: { potencia_cv: 190, torque_nm: 450, cilindrada_cc: 2298, cilindros: 4, combustivel: 'diesel', aspiracao: 'biturbo' },
    transmissao: { tipo: 'automatica', marchas: 7, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 10.8, velocidade_max_kmh: 180, consumo_cidade_kml: 9.5, consumo_estrada_kml: 11.3 },
    dimensoes: { comprimento_mm: 5260, entre_eixos_mm: 3150, vao_livre_mm: 234, peso_kg: 2080, capacidade_cacamba_l: 1054, capacidade_carga_kg: 980, capacidade_reboque_kg: 3500 },
    equipamentos: ['seguranca:7 airbags', 'seguranca:Câmera 360°', 'offroad:Bloqueio do diferencial traseiro', 'multimidia:Central 9"'],
  },
  {
    id: 'demo-amarok-extreme', marca: 'Volkswagen', modelo: 'Amarok', versao: 'Extreme 3.0 V6 Diesel 4Motion',
    preco_brl: 350_000, pais_origem: 'Argentina',
    motor: { potencia_cv: 258, torque_nm: 580, cilindrada_cc: 2967, cilindros: 6, combustivel: 'diesel', aspiracao: 'turbo' },
    transmissao: { tipo: 'automatica', marchas: 8, tracao: 'AWD' },
    desempenho: { aceleracao_0_100_s: 7.9, velocidade_max_kmh: 193, consumo_cidade_kml: 8.2, consumo_estrada_kml: 10.4 },
    dimensoes: { comprimento_mm: 5254, entre_eixos_mm: 3097, vao_livre_mm: 249, peso_kg: 2210, capacidade_cacamba_l: 1280, capacidade_carga_kg: 1000, capacidade_reboque_kg: 3500 },
    equipamentos: ['seguranca:6 airbags', 'conforto:Bancos em couro com ajuste elétrico', 'multimidia:Central 9"', 'offroad:Tração integral permanente'],
  },
  {
    id: 'demo-maverick-lariat', marca: 'Ford', modelo: 'Maverick', versao: 'Lariat FX4 2.0 EcoBoost AWD',
    preco_brl: 245_000, pais_origem: 'México',
    motor: { potencia_cv: 253, torque_nm: 380, cilindrada_cc: 1999, cilindros: 4, combustivel: 'gasolina', aspiracao: 'turbo' },
    transmissao: { tipo: 'automatica', marchas: 8, tracao: 'AWD' },
    desempenho: { aceleracao_0_100_s: 6.9, velocidade_max_kmh: 200, consumo_cidade_kml: 8.6, consumo_estrada_kml: 11.2 },
    dimensoes: { comprimento_mm: 5072, entre_eixos_mm: 3076, vao_livre_mm: 218, peso_kg: 1780, capacidade_cacamba_l: 943, capacidade_carga_kg: 680, capacidade_reboque_kg: 1800 },
    equipamentos: ['seguranca:6 airbags', 'seguranca:Frenagem autônoma', 'conforto:Bancos em couro', 'multimidia:Central 8"', 'multimidia:Android Auto / Apple CarPlay'],
  },
];

export const DEMO_VEHICLES: Vehicle[] = SEEDS.map(seed => ({
  ...seed,
  ano: 2026,
  categoria: 'picape_media',
}));
