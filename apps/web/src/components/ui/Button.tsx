import { Loader2 } from 'lucide-react';
import Link from 'next/link';

/**
 * Button unificado — variants pra primary, secondary, ghost, danger.
 * Suporta <button>, <Link> e <a> via prop `as`.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-ford-blue text-white hover:bg-ford-blue-dark shadow-card hover:shadow-elevated hover:-translate-y-0.5',
  secondary: 'bg-white text-charcoal border border-gray-300 hover:border-ford-blue hover:text-ford-blue hover:bg-ford-blue-soft/30',
  ghost: 'bg-transparent text-slate hover:bg-gray-100 hover:text-charcoal',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-card',
  subtle: 'bg-ford-blue-soft text-ford-blue hover:bg-ford-blue-soft/70 font-bold',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconRight?: React.ComponentType<{ className?: string }>;
  className?: string;
  /** Adiciona uppercase tracking-wider — visual "comando" */
  uppercase?: boolean;
  /** Full width */
  block?: boolean;
};

type ButtonProps = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;
type LinkProps = CommonProps & {
  href: string;
  external?: boolean;
  children?: React.ReactNode;
};

function classes({
  variant = 'primary', size = 'md', uppercase = false, block = false, loading = false, className = '',
}: CommonProps & { loading?: boolean }) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-2xl font-bold',
    'transition-all duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    uppercase ? 'uppercase tracking-wider' : '',
    block ? 'w-full' : '',
    loading ? 'pointer-events-none' : '',
    className,
  ].filter(Boolean).join(' ');
}

function content({ icon: Icon, iconRight: IconRight, loading, children }: {
  icon?: any; iconRight?: any; loading?: boolean; children: React.ReactNode;
}) {
  return (
    <>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon && <Icon className="w-3.5 h-3.5" />}
      <span>{children}</span>
      {!loading && IconRight && <IconRight className="w-3.5 h-3.5" />}
    </>
  );
}

export function Button({
  variant, size, loading, icon, iconRight, uppercase, block, className,
  children, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={classes({ variant, size, uppercase, block, loading, className })}
    >
      {content({ icon, iconRight, loading, children })}
    </button>
  );
}

export function LinkButton({
  variant, size, icon, iconRight, uppercase, block, className,
  href, external, children,
}: LinkProps) {
  const cls = classes({ variant, size, uppercase, block, className });
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {content({ icon, iconRight, children })}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {content({ icon, iconRight, children })}
    </Link>
  );
}
