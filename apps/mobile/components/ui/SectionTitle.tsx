import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing, surface } from '../../lib/theme';
import { AppText } from './AppText';

type SectionTitleProps = {
  title: string;
  subtitle?: string;
  /** Link opcional à direita (ex.: "Ver todos"). */
  action?: { label: string; onPress: () => void };
};

/** Título de seção dentro de uma tela. */
export function SectionTitle({ title, subtitle, action }: SectionTitleProps) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <AppText variant="h3" accessibilityRole="header">{title}</AppText>
        {subtitle && <AppText variant="small" color={surface.textSecondary}>{subtitle}</AppText>}
      </View>
      {action && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="link"
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <AppText variant="smallStrong" color={colors.fordBlue}>{action.label}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  texts: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
});
