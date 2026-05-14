import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../lib/theme';

export function Screen({
  title, subtitle, action, children, scroll = true,
}: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode; scroll?: boolean;
}) {
  const body = (
    <View style={{ padding: spacing.xl, paddingTop: spacing.lg }}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {action}
      </View>
      {scroll ? <ScrollView showsVerticalScrollIndicator={false}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray300,
  },
  title: { fontSize: typography.size['2xl'], fontWeight: '700', color: colors.fordBlue },
  subtitle: { fontSize: typography.size.sm, color: colors.gray600, marginTop: 4 },
});
