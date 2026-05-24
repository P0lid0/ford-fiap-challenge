/**
 * PerfilBadge + tokens de cor por perfil (Fiel, Esquecido, Econômico, Abandono).
 * PERFIL_COLOR_BG é exportado pra uso em barras/gráficos sem replicar nas páginas.
 */

export type Perfil = 'fiel' | 'abandono' | 'esquecido' | 'economico';

const COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  fiel:      { bg: 'bg-emerald-50', fg: 'text-emerald-700', border: 'border-emerald-600' },
  abandono:  { bg: 'bg-rose-50',    fg: 'text-rose-700',    border: 'border-rose-600' },
  esquecido: { bg: 'bg-amber-50',   fg: 'text-amber-800',   border: 'border-amber-500' },
  economico: { bg: 'bg-blue-50',    fg: 'text-ford-blue',   border: 'border-ford-blue' },
};

/** Cor de fundo sólida (pra barras de progresso/gráficos) por perfil. */
export const PERFIL_BAR_COLOR: Record<Perfil, string> = {
  fiel:      'bg-emerald-500',
  abandono:  'bg-rose-500',
  esquecido: 'bg-amber-500',
  economico: 'bg-blue-500',
};

/** Cor de texto sólida por perfil. */
export const PERFIL_TEXT_COLOR: Record<Perfil, string> = {
  fiel:      'text-emerald-600',
  abandono:  'text-rose-600',
  esquecido: 'text-amber-600',
  economico: 'text-blue-600',
};

/** Label legível (capitalized) por perfil. */
export const PERFIL_LABEL: Record<Perfil, string> = {
  fiel: 'Fiel',
  abandono: 'Abandono',
  esquecido: 'Esquecido',
  economico: 'Econômico',
};

/** Descrição curta por perfil — usado em tooltips/empty states. */
export const PERFIL_DESC: Record<Perfil, string> = {
  fiel: 'Retorna consistente à rede oficial',
  abandono: 'Sumiu após a 1ª revisão',
  esquecido: 'Perde timing das revisões',
  economico: 'Sensível a preço, baixa loyalty',
};

export function PerfilBadge({ perfil, size = 'md' }: { perfil: string; size?: 'sm' | 'md' }) {
  const c = COLORS[perfil] ?? COLORS.economico;
  const label = PERFIL_LABEL[perfil as Perfil] ?? (perfil.charAt(0).toUpperCase() + perfil.slice(1));
  const sizing = size === 'sm'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-3 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border ${c.bg} ${c.fg} ${c.border} font-bold uppercase tracking-wider ${sizing}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.fg.replace('text-', 'bg-')}`} />
      {label}
    </span>
  );
}
