import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { surface, toneColors, type Tone } from '../../lib/theme';

type ProgressBarProps = {
  /** Valor entre 0 e 1 (valores fora da faixa são limitados). */
  value: number;
  tone?: Tone;
  /** Cor explícita — sobrescreve `tone`. */
  color?: string;
  height?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Barra horizontal de progresso/risco — substitui as barras feitas à mão em cada tela. */
export function ProgressBar({ value, tone = 'default', color, height = 6, accessibilityLabel, style }: ProgressBarProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(clamped * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      style={[styles.track, { height, borderRadius: height / 2 }, style]}
    >
      <View
        style={{
          width: `${percent}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? toneColors[tone].fg,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: surface.divider, overflow: 'hidden', width: '100%' },
});
