'use client';
/**
 * Modal de confirmação reutilizável pra qualquer ação destrutiva ou de alto custo
 * (excluir, sobrescrever, chamar IA paga, reanalisar, etc).
 *
 * Uso:
 *   const { confirm, dialog } = useConfirm();
 *
 *   <button onClick={async () => {
 *     if (await confirm({
 *       title: 'Excluir veículo?',
 *       message: 'Esta ação é permanente.',
 *       confirmLabel: 'Sim, excluir',
 *       variant: 'danger',
 *     })) {
 *       await delete();
 *     }
 *   }}>Excluir</button>
 *   {dialog}
 */
import { useState, useCallback, type ReactNode } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

type Variant = 'danger' | 'warning' | 'info' | 'ai';

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  details?: ReactNode;
};

type State = ConfirmOptions & {
  open: boolean;
  resolver?: (ok: boolean) => void;
};

const VARIANT_STYLES: Record<Variant, { ring: string; icon: string; btn: string; iconBg: string }> = {
  danger:  { ring: 'ring-rose-200',    icon: 'text-rose-600',   iconBg: 'bg-rose-100',    btn: 'bg-rose-600 hover:bg-rose-700' },
  warning: { ring: 'ring-amber-200',   icon: 'text-amber-600',  iconBg: 'bg-amber-100',   btn: 'bg-amber-600 hover:bg-amber-700' },
  info:    { ring: 'ring-blue-200',    icon: 'text-ford-blue',  iconBg: 'bg-ford-blue/10', btn: 'bg-ford-blue hover:bg-ford-blue-dark' },
  ai:      { ring: 'ring-purple-200',  icon: 'text-purple-600', iconBg: 'bg-purple-100',  btn: 'bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90' },
};

export function useConfirm() {
  const [state, setState] = useState<State>({ open: false, title: '' });
  const [working, setWorking] = useState(false);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      setState({ ...opts, open: true, resolver: resolve });
      setWorking(false);
    });
  }, []);

  const handleClose = useCallback((ok: boolean) => {
    state.resolver?.(ok);
    setState(s => ({ ...s, open: false, resolver: undefined }));
  }, [state]);

  const dialog = state.open ? (
    <ConfirmModal
      title={state.title}
      message={state.message}
      details={state.details}
      confirmLabel={state.confirmLabel ?? 'Confirmar'}
      cancelLabel={state.cancelLabel ?? 'Cancelar'}
      variant={state.variant ?? 'warning'}
      working={working}
      onCancel={() => handleClose(false)}
      onConfirm={() => { setWorking(true); handleClose(true); }}
    />
  ) : null;

  return { confirm, dialog };
}

function ConfirmModal({
  title, message, details, confirmLabel, cancelLabel, variant, working, onCancel, onConfirm,
}: {
  title: string;
  message?: ReactNode;
  details?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  variant: Variant;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
      onKeyDown={e => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') onConfirm(); }}
    >
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 ring-4 ${styles.ring} relative`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button onClick={onCancel}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
          aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl ${styles.iconBg} flex items-center justify-center flex-shrink-0`}>
            <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-charcoal">{title}</h2>
            {message ? <div className="text-sm text-slate mt-1.5 leading-relaxed">{message as any}</div> : null}
            {details ? (
              <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700">
                {details as any}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onCancel} disabled={working}
            className="px-4 py-2 text-sm font-bold text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={working} autoFocus
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl transition disabled:opacity-50 ${styles.btn}`}>
            {working && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
