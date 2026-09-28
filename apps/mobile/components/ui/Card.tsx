import type { ReactNode } from 'react';
import {
  Pressable, StyleSheet, View,
  type AccessibilityRole, type StyleProp, type ViewStyle,
} from 'react-native';
import { radius, shadows, spacing, surface } from '../../lib/theme';

type CardProps = {
  children: ReactNode;
  /** Torna o card inteiro tocável. */
  onPress?: () => void;
  /** false = sem padding interno (o conteúdo controla). Padrão: true. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Impede o toque (card tocável). */
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Padrão: "button" quando há onPress. */
  accessibilityRole?: AccessibilityRole;
  /** Estado marcado, quando o card funciona como "checkbox". */
  checked?: boolean;
};

/**
 * Card padrão — fundo branco, borda sutil, cantos de 16 e sombra leve.
 * Sem margem externa: o espaçamento entre cards é responsabilidade do container (gap).
 */
export function Card({
  children, onPress, padded = true, style, disabled = false,
  accessibilityLabel, accessibilityHint, accessibilityRole = 'button', checked,
}: CardProps) {
  const baseStyle = [styles.card, padded && styles.padded, style];

  if (!onPress) {
    // Com rótulo, o card é lido como um único item pelo leitor de tela.
    return (
      <View style={baseStyle} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      aria-disabled={disabled}
      aria-checked={checked}
      style={({ pressed }) => [baseStyle, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: surface.border,
    ...shadows.sm,
  },
  padded: { padding: spacing.lg },
  pressed: { backgroundColor: surface.background },
  disabled: { opacity: 0.5 },
});
