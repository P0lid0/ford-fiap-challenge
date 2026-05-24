/**
 * Wrapper de seção em formulários — ícone + título + descrição + children agrupados.
 * Usado em /clientes/novo e /veiculos/adicionar.
 */
type SectionProps = {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function FormSection({ icon: Icon, title, description, children }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-soft">
      <div className="flex items-center gap-3 mb-4">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-ford-blue-soft flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-ford-blue" />
          </div>
        )}
        <div>
          <h2 className="text-base font-bold text-charcoal">{title}</h2>
          {description && <p className="text-xs text-slate mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** Field rotulado pra formulários (label + desc opcional + children). */
export function Field({
  label, desc, required, children,
}: {
  label: string; desc?: string; required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-gray-600 font-bold mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {desc && <span className="block text-[11px] text-slate mb-1.5">{desc}</span>}
      {children}
    </label>
  );
}
