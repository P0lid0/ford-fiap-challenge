/**
 * Comparação de veículos do modo demonstração.
 *
 * Porta direta de apps/api/src/modules/competitive/compare.ts (mesmos campos,
 * mesmos critérios de vitória), para o resultado ser idêntico ao da API.
 * Função pura: sem estado, sem I/O.
 */
import type { ComparisonCriterion, ComparisonField, ComparisonResult, Vehicle } from '../types';

/** (rótulo visível, caminho no objeto, critério de vitória) */
const COMPARABLE_FIELDS: ReadonlyArray<readonly [string, string, ComparisonCriterion]> = [
  ['Potência (cv)',            'motor.potencia_cv',               'max'],
  ['Torque (Nm)',              'motor.torque_nm',                 'max'],
  ['Cilindrada (cc)',          'motor.cilindrada_cc',             'max'],
  ['Cilindros',                'motor.cilindros',                 'max'],
  ['Combustível',              'motor.combustivel',               'none'],
  ['Aspiração',                'motor.aspiracao',                 'none'],
  ['Transmissão',              'transmissao.tipo',                'none'],
  ['Marchas',                  'transmissao.marchas',             'max'],
  ['Tração',                   'transmissao.tracao',              'none'],
  ['0-100 km/h (s)',           'desempenho.aceleracao_0_100_s',   'min'],
  ['Vel. máxima (km/h)',       'desempenho.velocidade_max_kmh',   'max'],
  ['Consumo cidade (km/l)',    'desempenho.consumo_cidade_kml',   'max'],
  ['Consumo estrada (km/l)',   'desempenho.consumo_estrada_kml',  'max'],
  ['Comprimento (mm)',         'dimensoes.comprimento_mm',        'none'],
  ['Entre-eixos (mm)',         'dimensoes.entre_eixos_mm',        'max'],
  ['Vão livre (mm)',           'dimensoes.vao_livre_mm',          'max'],
  ['Peso (kg)',                'dimensoes.peso_kg',               'min'],
  ['Capacidade caçamba (L)',   'dimensoes.capacidade_cacamba_l',  'max'],
  ['Capacidade carga (kg)',    'dimensoes.capacidade_carga_kg',   'max'],
  ['Capacidade reboque (kg)',  'dimensoes.capacidade_reboque_kg', 'max'],
  ['Preço (BRL)',              'preco_brl',                       'min'],
];

type FieldValue = ComparisonField['values'][number];

export function compareVehicles(vehicles: Vehicle[]): ComparisonResult {
  const fields: ComparisonField[] = [];

  for (const [label, path, criterion] of COMPARABLE_FIELDS) {
    const values = vehicles.map(vehicle => resolvePath(vehicle, path));
    if (values.every(value => value === null)) continue;
    fields.push({ label, path, values, criterion, winner_index: winnerIndex(values, criterion) });
  }

  return { vehicles, fields };
}

function resolvePath(vehicle: Vehicle, path: string): FieldValue {
  const value = path.split('.').reduce<unknown>(
    (acc, key) => (acc == null ? null : (acc as Record<string, unknown>)[key]),
    vehicle,
  );
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : null;
}

function winnerIndex(values: FieldValue[], criterion: ComparisonCriterion): number | null {
  if (criterion === 'none') return null;
  let best: { index: number; value: number } | null = null;
  values.forEach((value, index) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    const isBetter = best === null
      || (criterion === 'max' && value > best.value)
      || (criterion === 'min' && value < best.value);
    if (isBetter) best = { index, value };
  });
  return best === null ? null : (best as { index: number }).index;
}
