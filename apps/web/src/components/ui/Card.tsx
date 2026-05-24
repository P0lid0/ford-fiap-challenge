/**
 * Card primitivo — fundo branco, borda sutil, padding e shadow consistentes.
 * Toda página deve usar este componente em vez de replicar bg-white/border/rounded inline.
 */
type CardProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Remove padding interno (caso a child queira controlar) */
  noPadding?: boolean;
  /** Reduz padding interno */
  compact?: boolean;
  /** Bordas/sombra mais discretas — use em cards aninhados */
  flat?: boolean;
  children: React.ReactNode;
};

export function Card({
  title, description, action, className = '', bodyClassName = '',
  noPadding = false, compact = false, flat = false, children,
}: CardProps) {
  const padding = noPadding ? '' : compact ? 'p-4' : 'p-6';
  const surface = flat
    ? 'bg-gray-50 border border-gray-100'
    : 'bg-white border border-gray-200 shadow-soft';
  return (
    <section className={`${surface} rounded-2xl ${className}`}>
      {(title || action) && (
        <header className={`flex items-start justify-between gap-4 flex-wrap ${noPadding ? 'p-6 pb-0' : padding + ' pb-0'}`}>
          <div className="flex-1 min-w-0">
            {title && <h2 className="text-lg font-bold text-charcoal leading-tight">{title}</h2>}
            {description && <p className="text-sm text-slate mt-1">{description}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </header>
      )}
      <div className={`${padding} ${(title || action) ? 'pt-5' : ''} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
