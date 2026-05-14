import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { colors, radius, spacing, typography } from '../lib/theme';

export default function Compare() {
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const router = useRouter();
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!ids) return;
    api.compareVehicles(ids.split(',')).then(setResult).catch(console.warn);
  }, [ids]);

  if (!result) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.gray50, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.fordBlue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Comparativo competitivo</Text>
      </View>

      <ScrollView horizontal contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={styles.attrCol}><Text style={styles.colTitle}>Atributo</Text></View>
            {result.vehicles.map((v: any) => (
              <View key={v.id} style={styles.dataCol}>
                <Text style={styles.brandSmall}>{v.marca}</Text>
                <Text style={styles.modelSmall}>{v.modelo} {v.versao}</Text>
              </View>
            ))}
          </View>

          {result.fields.map((f: any, i: number) => (
            <View key={`${f.path}-${i}`} style={[styles.row, i % 2 === 0 && styles.rowAlt]}>
              <View style={styles.attrCol}><Text style={styles.label}>{f.label}</Text></View>
              {f.values.map((val: any, idx: number) => {
                const winner = f.winner_index === idx;
                return (
                  <View key={idx} style={[styles.dataCol, winner && styles.dataColWin]}>
                    {winner && <Ionicons name="trophy" size={12} color={colors.success} />}
                    <Text style={[styles.value, winner && styles.valueWin]}>
                      {val === null || val === undefined ? '—' : String(val)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const COL_W = 140;
const ATTR_W = 180;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50 },
  header: { backgroundColor: colors.fordBlue, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { color: colors.white, fontSize: typography.size.lg, fontWeight: '700' },
  table: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray300, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', backgroundColor: colors.fordBlueDark, paddingVertical: spacing.md },
  attrCol: { width: ATTR_W, paddingHorizontal: spacing.md, justifyContent: 'center' },
  dataCol: { width: COL_W, paddingHorizontal: spacing.sm, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  dataColWin: { backgroundColor: '#E8F5EE' },
  colTitle: { color: colors.white, fontWeight: '700', fontSize: typography.size.sm },
  brandSmall: { color: colors.gray300, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  modelSmall: { color: colors.white, fontSize: typography.size.sm, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', minHeight: 44, alignItems: 'center' },
  rowAlt: { backgroundColor: colors.gray50 },
  label: { fontSize: typography.size.sm, color: colors.gray800, fontWeight: '500' },
  value: { fontSize: typography.size.sm, color: colors.text },
  valueWin: { color: colors.success, fontWeight: '700' },
});
