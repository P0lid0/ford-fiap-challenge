// Design system Ford — baseado em ford.com.br
// Princípios: minimalismo automotivo premium, espaço em branco,
// tipografia pesada em azul-marinho. Sem gradientes, sem neon.

export const colors = {
  fordBlue: '#003478',
  fordBlueDark: '#001A3D',
  fordBlueLight: '#1E4B8E',
  white: '#FFFFFF',
  gray50: '#F5F5F5',
  gray100: '#EEEEEE',
  gray300: '#D9D9D9',
  gray400: '#BDBDBD',
  gray600: '#6B6B6B',
  gray800: '#3A3A3A',
  text: '#1A1A1A',
  textInverse: '#FFFFFF',
  success: '#00843D',
  warning: '#F2A900',
  danger: '#D62828',
  info: '#1E4B8E',
} as const;

export const profileColors: Record<string, { bg: string; fg: string; border: string }> = {
  fiel:      { bg: '#E8F5EE', fg: '#00843D', border: '#00843D' },
  abandono:  { bg: '#FDEBEB', fg: '#D62828', border: '#D62828' },
  esquecido: { bg: '#FEF6E0', fg: '#A06B00', border: '#F2A900' },
  economico: { bg: '#E7EEF8', fg: '#003478', border: '#003478' },
};

export const typography = {
  fontFamily: {
    // Antenna não está disponível publicamente; Inter é o substituto recomendado.
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  size: {
    xs: 12, sm: 14, base: 16, lg: 18, xl: 20,
    '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48,
  },
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48, '4xl': 64,
} as const;

export const radius = {
  sm: 4, md: 8, lg: 16, xl: 24, '2xl': 32, full: 9999,
} as const;

export const shadow = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 8px rgba(0,0,0,0.06)',
  lg: '0 10px 20px rgba(0,0,0,0.08)',
} as const;

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export type Theme = {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
};

export const theme: Theme = { colors, typography, spacing, radius };
