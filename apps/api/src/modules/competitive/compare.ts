// Lógica de comparação. Independente de Fastify para facilitar testes.

export type Vehicle = {
  id: string;
  marca: string;
  modelo: string;
  versao: string;
  ano: number;
  categoria: string;
  motor: Record<string, unknown>;
  dimensoes: Record<string, unknown>;
  transmissao: Record<string, unknown>;
  desempenho: Record<string, unknown>;
  equipamentos: string[];
  preco_brl: number | null;
  pais_origem: string | null;
};

type Criterion = 'max' | 'min' | 'none';

// (label visível, dot-path, critério de vitória)
export const COMPARABLE_FIELDS: ReadonlyArray<readonly [string, string, Criterion]> = [
  ['Potência (cv)',                'motor.potencia_cv',                'max'],
  ['Torque (Nm)',                  'motor.torque_nm',                  'max'],
  ['Cilindrada (cc)',              'motor.cilindrada_cc',              'max'],
  ['Cilindros',                    'motor.cilindros',                  'max'],
  ['Combustível',                  'motor.combustivel',                'none'],
  ['Aspiração',                    'motor.aspiracao',                  'none'],
  ['Transmissão',                  'transmissao.tipo',                 'none'],
  ['Marchas',                      'transmissao.marchas',              'max'],
  ['Tração',                       'transmissao.tracao',               'none'],
  ['0-100 km/h (s)',               'desempenho.aceleracao_0_100_s',    'min'],
  ['Vel. máxima (km/h)',           'desempenho.velocidade_max_kmh',    'max'],
  ['Consumo cidade (km/l)',        'desempenho.consumo_cidade_kml',    'max'],
  ['Consumo estrada (km/l)',       'desempenho.consumo_estrada_kml',   'max'],
  ['Comprimento (mm)',             'dimensoes.comprimento_mm',         'none'],
  ['Entre-eixos (mm)',             'dimensoes.entre_eixos_mm',         'max'],
  ['Vão livre (mm)',               'dimensoes.vao_livre_mm',           'max'],
  ['Peso (kg)',                    'dimensoes.peso_kg',                'min'],
  ['Capacidade caçamba (L)',       'dimensoes.capacidade_cacamba_l',   'max'],
  ['Capacidade carga (kg)',        'dimensoes.capacidade_carga_kg',    'max'],
  ['Capacidade reboque (kg)',      'dimensoes.capacidade_reboque_kg',  'max'],
  ['Preço (BRL)',                  'preco_brl',                        'min'],
];

function resolvePath(v: Vehicle, path: string): unknown {
  return path.split('.').reduce<any>((acc, part) => (acc == null ? null : acc[part]), v);
}

function winnerIndex(values: unknown[], criterion: Criterion): number | null {
  if (criterion === 'none') return null;
  let best: { idx: number; val: number } | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    if (best === null) best = { idx: i, val: v };
    else if ((criterion === 'max' && v > best.val) || (criterion === 'min' && v < best.val)) {
      best = { idx: i, val: v };
    }
  }
  return best?.idx ?? null;
}

export function compareVehicles(vehicles: Vehicle[], fieldsFilter?: string[]) {
  const fields: any[] = [];
  const fieldsToUse = fieldsFilter && fieldsFilter.length
    ? COMPARABLE_FIELDS.filter(([, path]) => fieldsFilter.some(f => path.startsWith(f) || f.startsWith(path)))
    : COMPARABLE_FIELDS;

  for (const [label, path, criterion] of fieldsToUse) {
    const values = vehicles.map(v => resolvePath(v, path) ?? null);
    if (values.every(x => x === null)) continue;
    fields.push({
      label, path, values,
      winner_index: winnerIndex(values, criterion),
      criterion,
    });
  }

  // Equipamentos exclusivos (por veículo)
  const eqSets = vehicles.map(v => new Set(v.equipamentos ?? []));
  for (let i = 0; i < eqSets.length; i++) {
    const others = new Set<string>();
    for (let j = 0; j < eqSets.length; j++) {
      if (j === i) continue;
      for (const e of eqSets[j]!) others.add(e);
    }
    const exclusivos = [...eqSets[i]!].filter(e => !others.has(e)).sort();
    if (exclusivos.length === 0) continue;
    const vals: (string | null)[] = vehicles.map(() => null);
    vals[i] = exclusivos.slice(0, 8).join(', ') + (exclusivos.length > 8 ? '...' : '');
    fields.push({
      label: `Exclusivos ${vehicles[i]!.marca} ${vehicles[i]!.modelo}`,
      path: 'equipamentos.exclusivos',
      values: vals,
      winner_index: null,
      criterion: 'none' as const,
    });
  }

  return { vehicles, fields, summary: null };
}
