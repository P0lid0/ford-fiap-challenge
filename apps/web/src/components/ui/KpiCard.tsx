/**
 * KpiCard — exibe um KPI (label + valor grande + ícone + subtexto).
 * 2 variantes:
 *   - hero: gradient com ícone decorativo gigante no fundo (uso destaque)
 *   - flat: fundo branco discreto (uso lista)
 */
type Variant = 'hero' | 'flat';
type Accent = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'purple';

// IMPORTANTE: o tailwind.config customiza `slate` pra um único hex (#4D4D4D),
// então `from-slate-700`/`to-slate-900` NÃO existem e o gradiente fica em branco.
// Pra accent='slate' usamos gray-700→gray-900 (palette default mantida).
const HERO_GRADIENTS: Record<Accent, string> = {
  blue:    'from-ford-blue to-ford-blue-light',
  emerald: 'from-emerald-500 to-emerald-700',
  amber:   'from-amber-500 to-amber-700',
  rose:    'from-rose-500 to-rose-700',
  slate:   'from-gray-700 to-gray-900',
  purple:  'from-purple-600 to-purple-800',
};

const FLAT_TEXT_COLORS: Record<Accent, string> = {
  blue:    'text-ford-blue',
  emerald: 'text-emerald-600',
  amber:   'text-amber-600',
  rose:    'text-rose-600',
  slate:   'text-charcoal',
  purple:  'text-purple-600',
};

type KpiCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: string;
  variant?: Variant;
  accent?: Accent;
};

export function KpiCard({
  icon: Icon, label, value, sub, variant = 'flat', accent = 'blue',
}: KpiCardProps) {
  if (variant === 'hero') {
    const grad = HERO_GRADIENTS[accent];
    return (
      <div className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${grad} shadow-card`}>
        <div className="absolute -top-6 -right-6 opacity-10 pointer-events-none">
          <Icon className="w-24 h-24" />
        </div>
        <Icon className="w-5 h-5 opacity-70 mb-3" />
        <div className="text-2xl md:text-3xl font-black tabular leading-none">{value}</div>
        <div className="text-[11px] uppercase tracking-wider opacity-80 mt-2">{label}</div>
        {sub && <div className="text-[10px] opacity-60 mt-1.5">{sub}</div>}
      </div>
    );
  }
  // flat
  const color = FLAT_TEXT_COLORS[accent];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4 shadow-soft">
      <div className="w-10 h-10 rounded-xl bg-ford-blue-soft/50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-ford-blue" />
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-black tabular ${color}`}>{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
