import { StyleSheet, Text, View } from 'react-native';
import { profileColors, radius, spacing, typography } from '../lib/theme';

export function PerfilBadge({ perfil }: { perfil: string }) {
  const c = profileColors[perfil] ?? profileColors.economico;
  const label = perfil.charAt(0).toUpperCase() + perfil.slice(1);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: typography.size.xs, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
});
