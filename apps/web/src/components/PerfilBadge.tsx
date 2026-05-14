const COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  fiel:      { bg: 'bg-emerald-50',  fg: 'text-emerald-700',  border: 'border-emerald-600' },
  abandono:  { bg: 'bg-red-50',      fg: 'text-red-700',      border: 'border-red-600' },
  esquecido: { bg: 'bg-amber-50',    fg: 'text-amber-800',    border: 'border-amber-500' },
  economico: { bg: 'bg-blue-50',     fg: 'text-ford-blue',    border: 'border-ford-blue' },
};

export function PerfilBadge({ perfil }: { perfil: string }) {
  const c = COLORS[perfil] ?? COLORS.economico;
  const label = perfil.charAt(0).toUpperCase() + perfil.slice(1);
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${c.bg} ${c.fg} ${c.border} text-xs font-bold uppercase tracking-wider`}>
      <span className={`w-2 h-2 rounded-full ${c.fg.replace('text-', 'bg-')}`} />
      {label}
    </span>
  );
}
