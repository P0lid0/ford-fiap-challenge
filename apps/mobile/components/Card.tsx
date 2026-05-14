import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, radius, spacing } from '../lib/theme';

export function Card({
  children, onPress, style,
}: { children: ReactNode; onPress?: () => void; style?: any }) {
  const inner = (
    <View style={[styles.card, style]}>{children}</View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray300,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
});
