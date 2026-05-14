#!/usr/bin/env node
/**
 * Popula vehicles com seed inicial: Ranger Raptor (validação Ford) + concorrentes.
 * Usa Supabase REST API com service_role (bypassa RLS).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const envPath = join(repoRoot, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente em .env.local');
  process.exit(1);
}
const sb = createClient(url, key);

const VEHICLES = [
  {
    marca: 'Ford', modelo: 'Ranger', versao: 'Raptor', ano: 2025,
    categoria: 'picape_media',
    motor: { cilindrada_cc: 2993, potencia_cv: 397, torque_nm: 583, combustivel: 'gasolina', aspiracao: 'twin_turbo', cilindros: 6 },
    dimensoes: { comprimento_mm: 5381, largura_mm: 2028, altura_mm: 1926, entre_eixos_mm: 3270, vao_livre_mm: 272, peso_kg: 2454, capacidade_cacamba_l: 1232, capacidade_carga_kg: 652, capacidade_reboque_kg: 2500 },
    transmissao: { tipo: 'automatica', marchas: 10, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 5.9, velocidade_max_kmh: 180, consumo_cidade_kml: 5.4, consumo_estrada_kml: 7.2 },
    equipamentos: ['amortecedores_fox_live_valve', 'bloqueio_diferencial_dianteiro', 'bloqueio_diferencial_traseiro', 'modos_terreno_7', 'matrix_led', 'head_up_display', 'bancos_recaro', 'som_b_o_10_alto_falantes', 'sync_4a', 'cluster_digital_12_polegadas', 'tela_central_12_polegadas'],
    preco_brl: 489900, pais_origem: 'Argentina',
    fontes: ['ford.com.br/ranger-raptor', 'seed'],
  },
  {
    marca: 'Toyota', modelo: 'Hilux', versao: 'GR-Sport II', ano: 2025,
    categoria: 'picape_media',
    motor: { cilindrada_cc: 2755, potencia_cv: 224, torque_nm: 550, combustivel: 'diesel_s10', aspiracao: 'turbo', cilindros: 4 },
    dimensoes: { comprimento_mm: 5325, largura_mm: 1900, altura_mm: 1860, entre_eixos_mm: 3085, vao_livre_mm: 265, peso_kg: 2200, capacidade_cacamba_l: 1080, capacidade_carga_kg: 1000, capacidade_reboque_kg: 3500 },
    transmissao: { tipo: 'automatica', marchas: 6, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 10.7, velocidade_max_kmh: 175, consumo_cidade_kml: 8.2, consumo_estrada_kml: 10.1 },
    equipamentos: ['bloqueio_diferencial_traseiro', 'modos_terreno_5', 'led_adaptativo', 'bancos_couro', 'som_jbl_9_alto_falantes', 'tela_central_8_polegadas', 'carplay_wireless', 'android_auto_wireless', 'controle_descida', 'amortecedores_kyb_monotube'],
    preco_brl: 419990, pais_origem: 'Argentina',
    fontes: ['toyota.com.br/hilux', 'seed'],
  },
  {
    marca: 'RAM', modelo: '1500', versao: 'TRX', ano: 2024,
    categoria: 'picape_grande',
    motor: { cilindrada_cc: 6166, potencia_cv: 712, torque_nm: 881, combustivel: 'gasolina', aspiracao: 'supercharged', cilindros: 8 },
    dimensoes: { comprimento_mm: 5915, largura_mm: 2235, altura_mm: 2030, entre_eixos_mm: 3672, vao_livre_mm: 295, peso_kg: 2870, capacidade_cacamba_l: 1620, capacidade_carga_kg: 595, capacidade_reboque_kg: 3628 },
    transmissao: { tipo: 'automatica', marchas: 8, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 4.5, velocidade_max_kmh: 190, consumo_cidade_kml: 3.8, consumo_estrada_kml: 5.6 },
    equipamentos: ['amortecedores_bilstein_blackhawk', 'bloqueio_diferencial_traseiro_eletronico', 'modos_terreno_8', 'launch_control', 'head_up_display', 'bancos_couro_aquecidos_ventilados', 'som_harman_kardon_19_alto_falantes', 'tela_central_12_polegadas', 'teto_solar_panoramico', 'cluster_digital_12_polegadas'],
    preco_brl: 899990, pais_origem: 'Estados Unidos',
    fontes: ['ram.com.br/1500', 'seed'],
  },
  {
    marca: 'Volkswagen', modelo: 'Amarok', versao: 'Highline V6', ano: 2025,
    categoria: 'picape_media',
    motor: { cilindrada_cc: 2967, potencia_cv: 258, torque_nm: 580, combustivel: 'diesel_s10', aspiracao: 'turbo', cilindros: 6 },
    dimensoes: { comprimento_mm: 5350, largura_mm: 1954, altura_mm: 1834, entre_eixos_mm: 3097, vao_livre_mm: 234, peso_kg: 2253, capacidade_cacamba_l: 1080, capacidade_carga_kg: 904, capacidade_reboque_kg: 3500 },
    transmissao: { tipo: 'automatica', marchas: 10, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 7.6, velocidade_max_kmh: 200, consumo_cidade_kml: 7.4, consumo_estrada_kml: 9.5 },
    equipamentos: ['bloqueio_diferencial_traseiro', 'modos_terreno_5', 'matrix_led', 'bancos_couro_aquecidos', 'som_harman_kardon', 'tela_central_12_polegadas', 'app_connect', 'controle_descida'],
    preco_brl: 419990, pais_origem: 'Argentina',
    fontes: ['vw.com.br/amarok', 'seed'],
  },
  {
    marca: 'Ford', modelo: 'Bronco', versao: 'Wildtrack', ano: 2025,
    categoria: 'suv',
    motor: { cilindrada_cc: 2261, potencia_cv: 270, torque_nm: 420, combustivel: 'gasolina', aspiracao: 'turbo', cilindros: 4 },
    dimensoes: { comprimento_mm: 4811, largura_mm: 1932, altura_mm: 1850, entre_eixos_mm: 2950, vao_livre_mm: 222, peso_kg: 2204 },
    transmissao: { tipo: 'automatica', marchas: 10, tracao: '4x4' },
    desempenho: { aceleracao_0_100_s: 8.2, velocidade_max_kmh: 200, consumo_cidade_kml: 7.2, consumo_estrada_kml: 9.8 },
    equipamentos: ['bloqueio_diferencial_traseiro', 'modos_terreno_6', 'matrix_led', 'sync_4a', 'tela_central_12_polegadas'],
    preco_brl: 359900, pais_origem: 'Estados Unidos',
    fontes: ['ford.com.br/bronco', 'seed'],
  },
];

const { error } = await sb.from('vehicles').upsert(VEHICLES, { onConflict: 'hash_dedupe', ignoreDuplicates: false });
if (error) {
  console.error('❌ erro no seed', error);
  process.exit(1);
}
console.log(`✅ ${VEHICLES.length} veículos inseridos/atualizados`);
