import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { MIN_TOUCH_SIZE, surface } from '../../lib/theme';
import type { IconName } from './types';

type IconButtonProps = {
  icon: IconName;
  onPress: () => void;
  /** Obrigatório: o botão não tem texto visível. */
  accessibilityLabel: string;
  color?: string;
  size?: number;
};

/** Botão só com ícone, com área de toque de 48 pontos. */
export function IconButton({ icon, onPress, accessibilityLabel, color = surface.textSecondary, size = 24 }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: MIN_TOUCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: surface.divider },
});
