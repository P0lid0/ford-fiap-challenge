import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';
import { colors, fonts, MIN_TOUCH_SIZE, radius, spacing, surface, toneColors, typography } from '../../lib/theme';
import { AppText } from './AppText';
import type { IconName } from './types';

type Appearance = 'light' | 'dark';

export type TextFieldProps = TextInputProps & {
  label: string;
  /** Mensagem de erro do campo (borda e texto em vermelho). */
  error?: string | null;
  /** Texto de ajuda exibido quando não há erro. */
  hint?: string;
  /** Ícone decorativo à esquerda (ex.: lupa em campos de busca). */
  leftIcon?: IconName;
  /** Botão de ícone dentro do campo (ex.: mostrar/ocultar senha, limpar busca). */
  rightAction?: { icon: IconName; onPress: () => void; accessibilityLabel: string };
  /** `dark` = campo translúcido para fundos escuros (login), como na web. */
  appearance?: Appearance;
};

/** No navegador, remove o contorno padrão do foco — o campo já destaca a borda. */
const WEB_NO_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

const PALETTES: Record<Appearance, {
  background: string; border: string; focus: string; text: string;
  label: string; placeholder: string; icon: string; hint: string; error: string;
}> = {
  light: {
    background: surface.card,
    border: surface.border,
    focus: colors.fordBlue,
    text: surface.textPrimary,
    label: surface.textSecondary,
    placeholder: surface.placeholder,
    icon: surface.textSecondary,
    hint: surface.textMuted,
    error: toneColors.danger.fg,
  },
  dark: {
    background: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.14)',
    focus: 'rgba(255,255,255,0.55)',
    text: colors.white,
    label: 'rgba(255,255,255,0.65)',
    placeholder: 'rgba(255,255,255,0.35)',
    icon: 'rgba(255,255,255,0.75)',
    hint: 'rgba(255,255,255,0.55)',
    error: '#FCA5A5',
  },
};

/** Campo de texto padrão: rótulo, borda com foco, erro e ajuda. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, leftIcon, rightAction, appearance = 'light', style, onFocus, onBlur, editable = true, ...inputProps },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const palette = PALETTES[appearance];
  const borderColor = error ? palette.error : isFocused ? palette.focus : palette.border;

  return (
    <View style={styles.field}>
      <AppText variant="overline" color={palette.label}>{label}</AppText>
      <View
        style={[
          styles.box,
          { backgroundColor: palette.background, borderColor },
          !editable && styles.disabled,
        ]}
      >
        {leftIcon && <Ionicons name={leftIcon} size={20} color={palette.icon} style={styles.leftIcon} />}
        <TextInput
          ref={ref}
          {...inputProps}
          editable={editable}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={palette.placeholder}
          selectionColor={appearance === 'dark' ? colors.white : colors.fordBlue}
          maxFontSizeMultiplier={1.3}
          onFocus={event => { setIsFocused(true); onFocus?.(event); }}
          onBlur={event => { setIsFocused(false); onBlur?.(event); }}
          style={[styles.input, leftIcon && styles.inputWithIcon, { color: palette.text }, WEB_NO_OUTLINE, style]}
        />
        {rightAction && (
          <Pressable
            onPress={rightAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={rightAction.accessibilityLabel}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name={rightAction.icon} size={20} color={palette.icon} />
          </Pressable>
        )}
      </View>
      {error ? (
        <AppText variant="caption" color={palette.error} accessibilityLiveRegion="polite">{error}</AppText>
      ) : hint ? (
        <AppText variant="caption" color={palette.hint}>{hint}</AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_SIZE,
    borderWidth: 1,
    borderRadius: radius.lg, // mesmo raio dos campos da web (rounded-xl)
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: typography.size.base,
  },
  leftIcon: { marginLeft: spacing.md },
  inputWithIcon: { paddingLeft: spacing.sm },
  action: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.6 },
});
