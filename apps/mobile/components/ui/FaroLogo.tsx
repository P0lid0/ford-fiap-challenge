import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Polygon } from 'react-native-svg';
import { colors, fonts } from '../../lib/theme';
import { AppText } from './AppText';

type FaroLogoProps = {
  /** Altura do símbolo em pontos. */
  size?: number;
  /** `color` para fundos claros · `inverse` para fundos escuros. */
  variant?: 'color' | 'inverse';
  /** Mostra o texto "FARO AI" ao lado do símbolo. */
  withWordmark?: boolean;
};

const PALETTES = {
  color: { body: colors.fordBlueDark, light: '#0066B2', word: colors.fordBlueDark, wordAccent: colors.fordBlue },
  inverse: { body: colors.white, light: '#4D9FFF', word: colors.white, wordAccent: 'rgba(255,255,255,0.75)' },
} as const;

/**
 * Logo Faro AI — o farol iluminando a estrada (mesmo desenho do ícone do app
 * e do FaroLogo da web), em SVG para ficar nítido em qualquer tamanho.
 */
export function FaroLogo({ size = 40, variant = 'color', withWordmark = false }: FaroLogoProps) {
  const palette = PALETTES[variant];
  const wordSize = Math.max(12, Math.round(size * 0.55));

  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel="Faro AI">
      <Svg width={size} height={size} viewBox="0 0 64 64">
        {/* Feixes de luz saindo do topo */}
        <Line x1={32} y1={8} x2={32} y2={2} stroke={palette.light} strokeWidth={2.4} strokeLinecap="round" />
        <Line x1={27} y1={10} x2={22} y2={5} stroke={palette.light} strokeWidth={2.4} strokeLinecap="round" />
        <Line x1={37} y1={10} x2={42} y2={5} stroke={palette.light} strokeWidth={2.4} strokeLinecap="round" />
        {/* Corpo do farol */}
        <Polygon points="32,13 40,50 24,50" fill={palette.body} />
        {/* Feixes laterais */}
        <Polygon points="24,50 18,54 32,36" fill={palette.light} />
        <Polygon points="40,50 46,54 32,36" fill={palette.light} />
        {/* Estrada */}
        <Path d="M14 57 Q32 51 50 57" stroke={palette.body} strokeWidth={3} strokeLinecap="round" fill="none" />
      </Svg>
      {withWordmark && (
        <AppText style={[styles.word, { fontSize: wordSize, lineHeight: wordSize * 1.2 }]} color={palette.word}>
          FARO<AppText style={[styles.wordAccent, { fontSize: wordSize, lineHeight: wordSize * 1.2 }]} color={palette.wordAccent}> AI</AppText>
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  word: { fontFamily: fonts.bold, letterSpacing: 1 },
  wordAccent: { fontFamily: fonts.regular, letterSpacing: 1 },
});
