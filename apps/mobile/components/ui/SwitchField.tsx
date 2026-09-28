import { StyleSheet, Switch, View } from 'react-native';
import { colors, spacing, surface } from '../../lib/theme';
import { AppText } from './AppText';

type SwitchFieldProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
};

/** Campo sim/não com rótulo — a linha inteira é tocável. */
export function SwitchField({ label, value, onChange, hint }: SwitchFieldProps) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint && <AppText variant="caption" color={surface.textMuted}>{hint}</AppText>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: surface.border, true: colors.fordBlue }}
        thumbColor={colors.white}
        ios_backgroundColor={surface.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  texts: { flex: 1, gap: 2 },
});
