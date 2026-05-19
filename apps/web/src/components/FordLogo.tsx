/**
 * Logo Ford — usa os SVGs oficiais hospedados em /public/brand/.
 *
 * Assets (Wikipedia Commons, CC):
 *   - /brand/ford-logo.svg       → oval completo com gradients (uso primário)
 *   - /brand/ford-logo-flat.svg  → versão flat (uso secundário, contextos menores)
 *
 * Trademark Ford Motor Company. Uso autorizado neste projeto desenvolvido PARA
 * a Ford no contexto do Ford×FIAP Challenge 2026.
 */
import Image from 'next/image';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<Size, { w: number; h: number }> = {
  xs: { w: 60,  h: 22 },
  sm: { w: 96,  h: 36 },
  md: { w: 140, h: 52 },
  lg: { w: 200, h: 75 },
  xl: { w: 300, h: 112 },
};

export function FordLogo({
  size = 'md',
  className = '',
  flat = false,
  priority = false,
}: {
  size?: Size;
  className?: string;
  /** Usa a versão flat (mais leve). Default: gradient/3D. */
  flat?: boolean;
  /** Para logos above-the-fold (login). */
  priority?: boolean;
}) {
  const { w, h } = SIZES[size];
  const src = flat ? '/brand/ford-logo-flat.svg' : '/brand/ford-logo.svg';
  return (
    <Image
      src={src}
      alt="Ford"
      width={w}
      height={h}
      priority={priority}
      className={className}
      style={{ height: 'auto', maxWidth: '100%' }}
    />
  );
}

/**
 * Mini-mark: oval pequeno (sem texto detalhado).
 * Útil pra avatares, breadcrumbs, microcopy.
 * Usa o flat por padrão (renderiza melhor em tamanho reduzido).
 */
export function FordOvalMark({
  size = 28,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/ford-logo-flat.svg"
      alt="Ford"
      width={size}
      height={Math.round(size * 0.375)}
      className={className}
      style={{ height: 'auto' }}
    />
  );
}
