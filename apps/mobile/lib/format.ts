/**
 * Formatação e rótulos em português.
 * As telas nunca mostram valores internos (ex.: "a_vista") — sempre passam por aqui.
 */
import type {
  CanalAquisicao, EstadoCivil, Financiamento, Genero, LeadSinal, Perfil, Regiao,
} from './types';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat('pt-BR');

export function formatCurrency(value: number | null | undefined): string {
  return value == null ? '—' : currencyFormatter.format(value);
}

/** R$ 265 mil — para espaços curtos (cards de veículo). */
export function formatCurrencyShort(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return formatCurrency(value);
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? '—' : numberFormatter.format(value);
}

/** 0.456 → "46%" */
export function formatPercent(ratio: number | null | undefined): string {
  return ratio == null || Number.isNaN(ratio) ? '—' : `${Math.round(ratio * 100)}%`;
}

/** "2024-03-12" → "12/03/2024" (sem conversão de fuso). */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
}

/** Data de hoje no formato da API (AAAA-MM-DD), no fuso local. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Converte um valor genérico da tabela de comparação em texto. */
export function formatValue(value: string | number | boolean | null | undefined): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return formatNumber(value);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ─── Rótulos de domínio ─────────────────────────────────────

export const perfilLabel: Record<Perfil, string> = {
  fiel: 'Fiel',
  abandono: 'Abandono',
  esquecido: 'Esquecido',
  economico: 'Econômico',
};

export const perfilDescription: Record<Perfil, string> = {
  fiel: 'Revisa na rede e tende a recomprar',
  abandono: 'Deixou de revisar na rede',
  esquecido: 'Atrasa revisões, mas ainda volta',
  economico: 'Sensível ao preço da manutenção',
};

export const regiaoLabel: Record<Regiao, string> = {
  sul: 'Sul',
  sudeste: 'Sudeste',
  centro_oeste: 'Centro-Oeste',
  nordeste: 'Nordeste',
  norte: 'Norte',
};

export const generoLabel: Record<Genero, string> = {
  M: 'Masculino',
  F: 'Feminino',
  outro: 'Outro',
};

export const estadoCivilLabel: Record<EstadoCivil, string> = {
  solteiro: 'Solteiro(a)',
  casado: 'Casado(a)',
  divorciado: 'Divorciado(a)',
  viuvo: 'Viúvo(a)',
};

export const financiamentoLabel: Record<Financiamento, string> = {
  a_vista: 'À vista',
  financiado: 'Financiado',
  leasing: 'Leasing',
  consorcio: 'Consórcio',
};

export const canalLabel: Record<CanalAquisicao, string> = {
  concessionaria: 'Concessionária',
  online: 'Online',
  frota: 'Frota',
  indicacao: 'Indicação',
};

export const sinalLabel: Record<LeadSinal, string> = {
  revisao_atrasada: 'Revisão atrasada',
  garantia_vencida: 'Garantia vencida',
  garantia_vencendo: 'Garantia vencendo',
  dealer_loyalty_baixa: 'Baixa fidelidade',
  veiculo_veterano: 'Veículo 5+ anos',
  sem_revisao_alguma: 'Nunca revisou',
};

/** "BRONCO SPORT" → "Bronco Sport"; "MUSTANG MACH-E" → "Mustang Mach-E"; "F-150" → "F-150". */
const MODEL_LABEL_OVERRIDES: Record<string, string> = { ECOSPORT: 'EcoSport' };

export function modelLabel(modelName: string | null | undefined): string {
  if (!modelName) return '—';
  const override = MODEL_LABEL_OVERRIDES[modelName.toUpperCase()];
  if (override) return override;
  return modelName
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toUpperCase());
}
