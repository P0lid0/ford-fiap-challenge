import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, toneColors, type Tone } from '../../lib/theme';
import { AppText } from './AppText';
import type { IconName } from './types';

type TagProps = {
  label: string;
  tone?: Tone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

/** Etiqueta curta e colorida (sinais de lead, "Vencedor", "Modo demonstração"…). */
export function Tag({ label, tone = 'neutral', icon, style }: TagProps) {
  const { fg, bg } = toneColors[tone];
  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.tag, { backgroundColor: bg }]}>
        {icon && <Ionicons name={icon} size={12} color={fg} />}
        <AppText variant="caption" color={fg} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
});
