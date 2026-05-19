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

  // Equipamentos: parse de "categoria:item" → agrupar exclusivos por categoria
  const eqByVehicle = vehicles.map(v =>
    parseEquipamentosByCategory(v.equipamentos ?? [])
  );
  const allCategories = new Set<string>();
  for (const cat of eqByVehicle) for (const k of Object.keys(cat)) allCategories.add(k);

  // Itens em COMUM por categoria (todos os veículos têm)
  const equipamentos_comparativo: EquipamentoCategoria[] = [];
  for (const cat of [...allCategories].sort()) {
    const perVehicle = eqByVehicle.map(e => new Set(e[cat] ?? []));
    const intersect = perVehicle.length > 0
      ? [...perVehicle[0]!].filter(item => perVehicle.every(s => s.has(item))).sort()
      : [];
    const exclusivosPerVehicle = perVehicle.map((set, i) => {
      const outros = new Set<string>();
      for (let j = 0; j < perVehicle.length; j++) {
        if (j === i) continue;
        for (const it of perVehicle[j]!) outros.add(it);
      }
      return [...set].filter(it => !outros.has(it)).sort();
    });
    equipamentos_comparativo.push({
      categoria: cat,
      comuns: intersect,
      exclusivos_por_veiculo: vehicles.map((v, i) => ({
        vehicle_id: v.id,
        marca: v.marca, modelo: v.modelo, versao: v.versao,
        itens: exclusivosPerVehicle[i] ?? [],
      })),
    });
  }

  // Mantém o resumo legado em fields[] pra UI antiga ainda funcionar
  for (let i = 0; i < vehicles.length; i++) {
    const exclusivosTotal: string[] = [];
    for (const grp of equipamentos_comparativo) {
      const my = grp.exclusivos_por_veiculo[i]?.itens ?? [];
      exclusivosTotal.push(...my.map(it => `${grp.categoria}:${it}`));
    }
    if (!exclusivosTotal.length) continue;
    const vals: (string | null)[] = vehicles.map(() => null);
    vals[i] = exclusivosTotal.slice(0, 10).join(', ') + (exclusivosTotal.length > 10 ? `... (+${exclusivosTotal.length - 10})` : '');
    fields.push({
      label: `Exclusivos ${vehicles[i]!.marca} ${vehicles[i]!.modelo}`,
      path: 'equipamentos.exclusivos',
      values: vals,
      winner_index: null,
      criterion: 'none' as const,
    });
  }

  return { vehicles, fields, equipamentos_comparativo, summary: null };
}

export type EquipamentoCategoria = {
  categoria: string;
  comuns: string[];
  exclusivos_por_veiculo: Array<{
    vehicle_id: string;
    marca: string; modelo: string; versao: string;
    itens: string[];
  }>;
};

/**
 * Parse "categoria:item_nome" → { categoria: [item_nome, ...] }.
 * Itens legados sem prefixo caem em "geral".
 */
function parseEquipamentosByCategory(itens: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const raw of itens) {
    const m = raw.match(/^([a-z_]+):(.+)$/);
    if (m) {
      const cat = m[1]!;
      const item = m[2]!;
      (out[cat] ??= []).push(item);
    } else {
      (out['geral'] ??= []).push(raw);
    }
  }
  return out;
}
