import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, MIN_TOUCH_SIZE, radius, spacing, surface, toneColors } from '../../lib/theme';
import { AppText } from './AppText';
import type { IconName } from './types';

/**
 * `inverse` = botão branco para fundos escuros (ex.: tela de login);
 * `inverseOutline` = contornado para fundos escuros (ação secundária).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse' | 'inverseOutline';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
};

const PALETTE: Record<ButtonVariant, { background: string; border: string; content: string }> = {
  primary: { background: colors.fordBlue, border: colors.fordBlue, content: colors.white },
  secondary: { background: colors.white, border: surface.border, content: colors.fordBlue },
  ghost: { background: 'transparent', border: 'transparent', content: colors.fordBlue },
  danger: { background: colors.white, border: toneColors.danger.fg, content: toneColors.danger.fg },
  inverse: { background: colors.white, border: colors.white, content: colors.fordBlue },
  inverseOutline: { background: 'transparent', border: 'rgba(255,255,255,0.35)', content: colors.white },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const palette = PALETTE[variant];
  const isDisabled = disabled || loading;
  const isSmall = size === 'sm';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      aria-disabled={isDisabled}
      aria-busy={loading}
      hitSlop={isSmall ? 6 : undefined}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        isSmall ? styles.small : styles.medium,
        { backgroundColor: palette.background, borderColor: palette.border },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      {/* O conteúdo fica invisível (não removido) durante o loading para o botão não mudar de tamanho. */}
      <View style={[styles.content, loading && styles.hidden]}>
        {icon && <Ionicons name={icon} size={isSmall ? 16 : 20} color={palette.content} />}
        <AppText variant={isSmall ? 'smallStrong' : 'button'} color={palette.content} numberOfLines={1}>
          {title}
        </AppText>
      </View>
      {loading && (
        <View style={styles.spinner}>
          <ActivityIndicator color={palette.content} size="small" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.xl, // formato pílula, como os botões da web (rounded-2xl)
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  medium: { minHeight: MIN_TOUCH_SIZE, paddingHorizontal: spacing.xl },
  small: { minHeight: 36, paddingHorizontal: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hidden: { opacity: 0 },
  spinner: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
