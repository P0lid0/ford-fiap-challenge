import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, surface, toneColors, type Tone } from '../../lib/theme';
import { AppText } from './AppText';
import { Card } from './Card';
import type { IconName } from './types';

type KpiCardProps = {
  label: string;
  value: string;
  icon?: IconName;
  tone?: Tone;
  /** Texto auxiliar abaixo do rótulo (ex.: "de 20 clientes"). */
  hint?: string;
  style?: StyleProp<ViewStyle>;
};

/** Indicador numérico — mesma estrutura do KpiCard "flat" da web (ícone, valor, rótulo). */
export function KpiCard({ label, value, icon, tone = 'default', hint, style }: KpiCardProps) {
  const { fg, bg } = toneColors[tone];
  return (
    <Card
      style={[styles.card, style]}
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
    >
      {icon && (
        <View style={[styles.iconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={18} color={fg} />
        </View>
      )}
      <AppText variant="kpi" color={tone === 'default' ? surface.textPrimary : fg} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="overline" color={surface.textMuted} numberOfLines={2}>
        {label}
      </AppText>
      {hint && (
        <AppText variant="caption" color={surface.textMuted} numberOfLines={1}>
          {hint}
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: 2, padding: spacing.md },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
