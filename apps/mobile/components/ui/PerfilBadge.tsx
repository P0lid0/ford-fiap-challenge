import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { perfilLabel } from '../../lib/format';
import { perfilTone, radius, spacing, toneColors } from '../../lib/theme';
import type { Perfil } from '../../lib/types';
import { AppText } from './AppText';

type PerfilBadgeProps = {
  perfil: Perfil;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** Selo do perfil de retenção (Fiel, Abandono, Esquecido, Econômico). */
export function PerfilBadge({ perfil, size = 'md', style }: PerfilBadgeProps) {
  const { fg, bg } = toneColors[perfilTone[perfil] ?? 'neutral'];
  const label = perfilLabel[perfil] ?? perfil;
  const isSmall = size === 'sm';
  // O invólucro em linha faz o selo ter a largura do texto e ficar centralizado
  // na vertical quando está ao lado de outro conteúdo.
  return (
    <View style={[styles.wrapper, style]}>
      <View
        accessible
        accessibilityLabel={`Perfil ${label}`}
        style={[styles.badge, isSmall ? styles.small : styles.medium, { backgroundColor: bg }]}
      >
        <View style={[styles.dot, { backgroundColor: fg }]} />
        <AppText variant="overline" color={fg} style={isSmall ? styles.smallText : undefined}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
  },
  medium: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  small: { paddingHorizontal: spacing.sm, paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  smallText: { fontSize: 10, lineHeight: 12 },
});
