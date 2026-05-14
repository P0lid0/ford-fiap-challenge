import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { colors, radius, spacing, typography } from '../../lib/theme';

export default function Vehicles() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { api.listVehicles().then(setVehicles).catch(console.warn); }, []);

  const filtered = useMemo(() => {
    if (!query) return vehicles;
    const q = query.toLowerCase();
    return vehicles.filter(v =>
      v.marca.toLowerCase().includes(q) ||
      v.modelo.toLowerCase().includes(q) ||
      v.versao.toLowerCase().includes(q),
    );
  }, [query, vehicles]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < 5) next.add(id);
    setSelected(next);
  }

  return (
    <Screen title="Concorrência" subtitle="Inteligência competitiva — selecione 2-5 para comparar">
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={colors.gray600} />
        <TextInput
          placeholder="Marca, modelo, versão"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          placeholderTextColor={colors.gray400}
        />
      </View>

      {filtered.map(v => {
        const sel = selected.has(v.id);
        return (
          <Card key={v.id} onPress={() => toggle(v.id)}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.brand}>{v.marca}</Text>
                <Text style={styles.title}>{v.modelo} {v.versao}</Text>
                <View style={styles.specs}>
                  <Spec label="Pot." value={v.motor?.potencia_cv ? `${v.motor.potencia_cv} cv` : '—'} />
                  <Spec label="Torq." value={v.motor?.torque_nm ? `${v.motor.torque_nm} Nm` : '—'} />
                  <Spec label="Preço" value={v.preco_brl ? `R$ ${(v.preco_brl / 1000).toFixed(0)}k` : '—'} />
                </View>
              </View>
              <View style={[styles.check, sel && styles.checked]}>
                {sel && <Ionicons name="checkmark" color={colors.white} size={18} />}
              </View>
            </View>
          </Card>
        );
      })}

      {selected.size >= 2 && (
        <Pressable
          style={styles.cta}
          onPress={() => router.push(`/compare?ids=${[...selected].join(',')}`)}
        >
          <Text style={styles.ctaText}>Comparar {selected.size} veículos</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginRight: spacing.lg }}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    paddingHorizontal: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.gray300, marginBottom: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: spacing.md, marginLeft: spacing.sm, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brand: { fontSize: typography.size.xs, color: colors.gray600, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: typography.size.lg, fontWeight: '700', color: colors.text, marginVertical: 2 },
  specs: { flexDirection: 'row', marginTop: spacing.sm },
  specLabel: { fontSize: 10, color: colors.gray600, textTransform: 'uppercase', letterSpacing: 0.5 },
  specVal: { fontSize: typography.size.sm, color: colors.text, fontWeight: '600', marginTop: 2 },
  check: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2,
    borderColor: colors.gray300, alignItems: 'center', justifyContent: 'center',
  },
  checked: { backgroundColor: colors.fordBlue, borderColor: colors.fordBlue },
  cta: {
    position: 'absolute', bottom: spacing.lg, left: spacing.xl, right: spacing.xl,
    backgroundColor: colors.fordBlue, paddingVertical: spacing.lg, borderRadius: radius.xl, alignItems: 'center',
  },
  ctaText: { color: colors.white, fontWeight: '700', fontSize: typography.size.base, letterSpacing: 0.5 },
});
