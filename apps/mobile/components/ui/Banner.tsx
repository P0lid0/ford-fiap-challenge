import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, toneColors, type Tone } from '../../lib/theme';
import { AppText } from './AppText';
import type { IconName } from './types';

type BannerProps = {
  message: string;
  title?: string;
  tone?: Tone;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
};

/** Aviso em linha (ex.: "Não foi possível atualizar", "Dados de demonstração"). */
export function Banner({ message, title, tone = 'default', icon = 'information-circle-outline', action }: BannerProps) {
  const { fg, bg } = toneColors[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: bg }]}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={icon} size={20} color={fg} />
      <View style={styles.texts}>
        {title && <AppText variant="smallStrong" color={fg}>{title}</AppText>}
        <AppText variant="small" color={fg}>{message}</AppText>
      </View>
      {action && (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={12}>
          <AppText variant="smallStrong" color={fg}>{action.label}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  texts: { flex: 1, gap: 2 },
});
