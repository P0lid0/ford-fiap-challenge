'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal base — backdrop + caixa branca + header com close button + slot pro corpo.
 * Substitui os 4 modais que cada um fazia o seu wrapper.
 *
 * Uso:
 *   <Modal title="Nova ação" description="..." onClose={...} size="lg">
 *     <form>...</form>
 *     <ModalFooter>
 *       <button ...>Cancelar</button>
 *       <button ...>Salvar</button>
 *     </ModalFooter>
 *   </Modal>
 */
const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
} as const;

type ModalProps = {
  title: string;
  description?: string;
  onClose: () => void;
  size?: keyof typeof SIZES;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  /** Esconde o backdrop (caso outro modal já tenha) */
  noBackdrop?: boolean;
};

export function Modal({
  title, description, onClose, size = 'lg', icon: Icon, children, noBackdrop = false,
}: ModalProps) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${noBackdrop ? '' : 'bg-charcoal/50 backdrop-blur-sm'} animate-fade-in`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-2xl shadow-elevated w-full ${SIZES[size]} max-h-[90vh] overflow-y-auto animate-slide-up`}>
        <header className="px-6 py-5 border-b border-gray-200 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
          <div className="flex items-start gap-3 min-w-0">
            {Icon && (
              <div className="w-9 h-9 rounded-xl bg-ford-blue-soft flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-ford-blue" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-charcoal leading-tight">{title}</h2>
              {description && <p className="text-sm text-slate mt-1">{description}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-charcoal flex-shrink-0 w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Footer padrão pra modais — usar dentro do <Modal>. */
export function ModalFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <footer className={`px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50 ${className}`}>
      {children}
    </footer>
  );
}

/** Body padrão pra modais — usar dentro do <Modal>, antes do footer. */
export function ModalBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}
