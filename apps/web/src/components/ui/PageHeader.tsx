/**
 * Header de página — bloco padrão "eyebrow + título + descrição + ação".
 * Substitui o padrão duplicado em 7 páginas.
 */
type PageHeaderProps = {
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, action, className = '' }: PageHeaderProps) {
  return (
    <header className={`flex items-end justify-between mb-8 flex-wrap gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-xs uppercase tracking-[0.2em] text-ford-blue font-bold mb-2 flex items-center gap-2">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-bold text-charcoal leading-tight">{title}</h1>
        {description && (
          <p className="text-slate mt-1.5 max-w-2xl">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </header>
  );
}
