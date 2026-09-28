/**
 * Design system do app mobile.
 *
 * Base: tokens compartilhados com a web (@ford/ui — cores, espaçamento, raios).
 * Aqui entram só as adaptações nativas:
 *  - tipografia Inter (mesma da web), com uma família por peso — no Android,
 *    fontWeight não troca o arquivo da fonte, por isso cada peso tem seu fontFamily;
 *  - estilos de texto prontos (textStyles) para manter a hierarquia igual em todas as telas;
 *  - sombras nativas (elevation/shadow*) — as de @ford/ui são CSS e não valem no React Native.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { colors, profileColors, radius, spacing, typography } from '@ford/ui';
import type { Perfil } from './types';

export { colors, profileColors, radius, spacing, typography };

/**
 * Arquivos da Inter carregados em app/_layout.tsx (useFonts).
 * 4 pesos (~340 KB cada) — o suficiente para a hierarquia do app.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/**
 * Superfícies e textos — mesmos valores da web (apps/web/tailwind.config.ts):
 * gray-50, gray-200, charcoal, slate, gray-500 e ford-blue-soft.
 */
export const surface = {
  background: '#F8F9FA',
  card: colors.white,
  border: '#E5E7EB',
  divider: '#F0F1F3',
  textPrimary: '#1A1A1A',
  textSecondary: '#4D4D4D',
  textMuted: '#6B7280',
  placeholder: '#9CA3AF',
  headerDark: colors.fordBlueDark,
  accentSoft: '#D6E1F0',
} as const;

/**
 * Tons semânticos: `fg` para texto, ícone e barra; `bg` para fundos.
 * Os `fg` são versões um pouco mais escuras das cores de estado da marca para
 * garantir contraste WCAG AA (≥ 4,5:1) de texto pequeno sobre o próprio `bg` e sobre branco.
 */
export type Tone = 'default' | 'success' | 'warning' | 'danger' | 'neutral';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  default: { fg: colors.fordBlue, bg: surface.accentSoft }, // 9,0:1
  success: { fg: '#006B32', bg: '#E8F5EE' },               // 5,9:1
  warning: { fg: '#8A5C00', bg: '#FEF6E0' },               // 5,4:1
  danger: { fg: '#B91C1C', bg: '#FDEBEB' },                // 5,6:1
  neutral: { fg: surface.textSecondary, bg: surface.divider },
};

/** Cor de cada perfil de retenção — mesma semântica da web (fiel = verde, abandono = vermelho…). */
export const perfilTone: Record<Perfil, Tone> = {
  fiel: 'success',
  abandono: 'danger',
  esquecido: 'warning',
  economico: 'default',
};

/** Faixas de risco usadas em todo o app: < 40% baixo · 40–70% médio · ≥ 70% alto. */
export function riskTone(risk: number): Tone {
  if (risk >= 0.7) return 'danger';
  if (risk >= 0.4) return 'warning';
  return 'success';
}

/** Hierarquia tipográfica única do app. */
export const textStyles = {
  display: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 46, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.bold, fontSize: typography.size['2xl'], lineHeight: 30, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.bold, fontSize: typography.size.xl, lineHeight: 26 },
  h3: { fontFamily: fonts.semibold, fontSize: typography.size.lg, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: typography.size.base, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: typography.size.base, lineHeight: 24 },
  small: { fontFamily: fonts.regular, fontSize: typography.size.sm, lineHeight: 20 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: typography.size.sm, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: typography.size.xs, lineHeight: 16 },
  overline: {
    fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  kpi: { fontFamily: fonts.bold, fontSize: typography.size['2xl'], lineHeight: 30 },
  button: { fontFamily: fonts.semibold, fontSize: typography.size.base, lineHeight: 20, letterSpacing: 0.2 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textStyles;

function nativeShadow(elevation: number, opacity: number, blur: number, offsetY: number): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation },
    default: {
      shadowColor: '#001A3D',
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: { width: 0, height: offsetY },
    },
  });
}

export const shadows = {
  none: {} as ViewStyle,
  sm: nativeShadow(1, 0.05, 2, 1),
  md: nativeShadow(3, 0.08, 8, 3),
  lg: nativeShadow(8, 0.12, 16, 6),
} as const;

/** Área mínima de toque recomendada (Android: 48dp). */
export const MIN_TOUCH_SIZE = 48;
