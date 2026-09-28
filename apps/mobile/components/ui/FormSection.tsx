import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing, surface } from '../../lib/theme';
import { AppText } from './AppText';
import { Card } from './Card';
import type { IconName } from './types';

type FormSectionProps = {
  title: string;
  description?: string;
  icon?: IconName;
  children: ReactNode;
};

/** Bloco de formulário (ícone + título + campos) — mesmo padrão do FormSection da web. */
export function FormSection({ title, description, icon, children }: FormSectionProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        {icon && (
          <View style={styles.iconBox}>
            <Ionicons name={icon} size={18} color={colors.fordBlue} />
          </View>
        )}
        <View style={styles.texts}>
          <AppText variant="h3" accessibilityRole="header">{title}</AppText>
          {description && <AppText variant="caption" color={surface.textMuted}>{description}</AppText>}
        </View>
      </View>
      {children}
    </Card>
  );
}

/** Rótulo de campo para controles que não são TextField (ex.: ChipGroup). */
export function FieldLabel({ label, error }: { label: string; error?: string | null }) {
  return (
    <View style={styles.label}>
      <AppText variant="overline" color={surface.textSecondary}>{label}</AppText>
      {error && <AppText variant="caption" color="#B91C1C">{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox: {
    width: 36, height: 36, borderRadius: radius.md, backgroundColor: surface.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  label: { gap: 2, marginBottom: -spacing.sm },
});
