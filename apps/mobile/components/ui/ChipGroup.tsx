import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, surface } from '../../lib/theme';
import { AppText } from './AppText';

export type ChipOption<T extends string | number> = {
  value: T;
  label: string;
};

type ChipGroupProps<T extends string | number> = {
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Nome do grupo para leitores de tela (ex.: "Risco mínimo"). */
  accessibilityLabel: string;
  /** true = uma linha com rolagem horizontal; false = quebra em várias linhas. Padrão: false. */
  scrollable?: boolean;
};

/** Seleção única entre poucas opções (filtros e campos de formulário). */
export function ChipGroup<T extends string | number>({
  options, value, onChange, accessibilityLabel, scrollable = false,
}: ChipGroupProps<T>) {
  const chips = options.map(option => {
    const isSelected = option.value === value;
    return (
      <Pressable
        key={String(option.value)}
        onPress={() => onChange(option.value)}
        accessibilityRole="radio"
        accessibilityLabel={option.label}
        aria-checked={isSelected}
        hitSlop={4}
        style={({ pressed }) => [
          styles.chip,
          isSelected ? styles.chipSelected : styles.chipIdle,
          pressed && !isSelected && styles.pressed,
        ]}
      >
        <AppText variant="smallStrong" color={isSelected ? colors.white : surface.textPrimary}>
          {option.label}
        </AppText>
      </Pressable>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        contentContainerStyle={styles.row}
      >
        {chips}
      </ScrollView>
    );
  }
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.row, styles.wrap]}>
      {chips}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  wrap: { flexWrap: 'wrap' },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: { backgroundColor: surface.card, borderColor: surface.border },
  chipSelected: { backgroundColor: colors.fordBlue, borderColor: colors.fordBlue },
  pressed: { backgroundColor: surface.divider },
});
