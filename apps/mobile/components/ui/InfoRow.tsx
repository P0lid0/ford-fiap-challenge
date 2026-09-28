import { StyleSheet, View } from 'react-native';
import { spacing, surface } from '../../lib/theme';
import { AppText } from './AppText';

type InfoRowProps = {
  label: string;
  value: string;
  /** Linha divisória abaixo. Padrão: true (use false na última linha). */
  divider?: boolean;
};

/** Linha "rótulo — valor" para listas de detalhes (dados da venda, métricas…). */
export function InfoRow({ label, value, divider = true }: InfoRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.row, divider && styles.divider]}
    >
      <AppText variant="small" color={surface.textSecondary} style={styles.label}>{label}</AppText>
      <AppText variant="smallStrong" align="right" style={styles.value}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingVertical: 10,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: surface.border },
  label: { flexShrink: 0, maxWidth: '50%' },
  value: { flex: 1 },
});
