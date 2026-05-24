/**
 * Empty state padrão — ícone grande + título + descrição + CTA opcional.
 * Substitui as 4 variantes ad-hoc espalhadas no app.
 */
type EmptyStateProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Renderiza inline (sem card branco em volta) */
  bare?: boolean;
};

export function EmptyState({ icon: Icon, title, description, action, bare = false }: EmptyStateProps) {
  const inner = (
    <div className="text-center py-10">
      <div className="inline-flex w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="font-bold text-charcoal mb-1.5">{title}</h3>
      {description && <p className="text-sm text-slate max-w-md mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5 flex items-center justify-center">{action}</div>}
    </div>
  );

  if (bare) return inner;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-soft">{inner}</div>
  );
}
