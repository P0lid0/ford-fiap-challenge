/**
 * Logo Faro AI — empresa que construiu o sistema FordIQ pro Ford×FIAP Challenge 2026.
 *
 * Símbolo: um farol estilizado emitindo luz sobre uma estrada — captura o duplo
 * sentido do nome (faro = instinto + farol = luz que ilumina o caminho).
 *
 * Para usar o PNG enviado pelo usuário, salve-o em:
 *   apps/web/public/brand/faro-ai-logo.png
 * Quando o arquivo existir, o componente automaticamente usa ele em vez do SVG.
 */
import Image from 'next/image';
import { useEffect, useState } from 'react';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const SIZES: Record<Size, { w: number; h: number }> = {
  xs: { w: 24,  h: 24 },
  sm: { w: 36,  h: 36 },
  md: { w: 56,  h: 56 },
  lg: { w: 88,  h: 88 },
  xl: { w: 140, h: 140 },
};

export function FaroLogo({
  size = 'md',
  withWordmark = false,
  className = '',
  monochrome = false,
}: {
  size?: Size;
  withWordmark?: boolean;
  className?: string;
  /** Versão branca pra fundos escuros (sidebar) */
  monochrome?: boolean;
}) {
  const { w, h } = SIZES[size];
  const [pngExists, setPngExists] = useState(false);

  // Tenta usar o PNG enviado pelo usuário; se não existir, cai pro SVG inline
  useEffect(() => {
    fetch('/brand/faro-ai-logo.png', { method: 'HEAD' })
      .then(r => setPngExists(r.ok))
      .catch(() => setPngExists(false));
  }, []);

  if (pngExists && !monochrome) {
    return (
      <Image
        src="/brand/faro-ai-logo.png"
        alt="Faro AI"
        width={withWordmark ? w * 3 : w}
        height={h}
        className={className}
        priority
      />
    );
  }

  // SVG fallback — farol estilizado (3 triângulos + base curva + brilho cruz)
  const c = monochrome ? '#FFFFFF' : '#0066CC';
  const cDark = monochrome ? '#FFFFFF' : '#001A3D';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={w} height={h} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Cruz de brilho no topo (farol acendendo) */}
        <path d="M32 4 L32 14 M22 9 L42 9" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        {/* Triângulo central (corpo do farol) — alto e elegante */}
        <path d="M32 12 L40 50 L24 50 Z" fill={cDark} />
        {/* Triângulo lateral esquerdo (sombra) */}
        <path d="M24 50 L18 54 L32 36 Z" fill={c} opacity="0.85" />
        {/* Triângulo lateral direito (luz) */}
        <path d="M40 50 L46 54 L32 36 Z" fill={c} />
        {/* Base curva (estrada) */}
        <path d="M14 56 Q32 50 50 56" stroke={cDark} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
      {withWordmark && (
        <div className="flex items-baseline gap-1">
          <span className={`font-bold tracking-tight ${monochrome ? 'text-white' : 'text-ford-blue-dark'}`}
            style={{ fontSize: h * 0.4 }}>
            FARO
          </span>
          <span className={`font-light tracking-wide ${monochrome ? 'text-white/80' : 'text-ford-blue'}`}
            style={{ fontSize: h * 0.4 }}>
            AI
          </span>
        </div>
      )}
    </div>
  );
}
