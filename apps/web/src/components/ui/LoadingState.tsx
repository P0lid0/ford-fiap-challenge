import { Loader2 } from 'lucide-react';

/**
 * Loading state padrão — spinner + texto opcional.
 * Substitui os "Carregando…" plain text e Loader2 inline ad-hoc.
 */
type LoadingStateProps = {
  text?: string;
  /** Inline pequeno, sem padding extra (uso em botões) */
  inline?: boolean;
  className?: string;
};

export function LoadingState({ text = 'Carregando…', inline = false, className = '' }: LoadingStateProps) {
  if (inline) {
    return (
      <span className={`inline-flex items-center gap-2 text-slate ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="text-sm">{text}</span>
      </span>
    );
  }
  return (
    <div className={`flex items-center justify-center gap-2 py-16 text-slate ${className}`}>
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
