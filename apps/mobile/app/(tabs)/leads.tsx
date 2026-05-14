import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { PerfilBadge } from '../../components/PerfilBadge';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { colors, spacing, typography } from '../../lib/theme';

export default function Leads() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listLeads(0.5)
      .then(setLeads)
      .catch(e => console.warn(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen
      title="Leads"
      subtitle="Clientes em risco priorizados por evasão"
    >
      {loading && <ActivityIndicator color={colors.fordBlue} style={{ marginTop: 40 }} />}
      {!loading && leads.length === 0 && (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={32} color={colors.success} />
            <Text style={styles.emptyText}>Nenhum cliente em alto risco no momento. Boa retenção!</Text>
          </View>
        </Card>
      )}
      {leads.map((l, i) => {
        const c = l.clients;
        const riscoColor =
          l.risco_evasao > 0.7 ? colors.danger
          : l.risco_evasao > 0.5 ? colors.warning
          : colors.gray600;
        return (
          <Card key={l.id} onPress={() => router.push(`/client/${c.id}`)}>
            <View style={styles.row}>
              <Text style={styles.rank}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.headRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.nome_cliente ?? `Cliente ${c.id.slice(0, 8)}`}
                  </Text>
                  <PerfilBadge perfil={l.perfil_predito} />
                </View>
                <Text style={styles.meta}>
                  {c.modelo_comprado} {c.versao_comprada}
                </Text>
                <View style={styles.barWrap}>
                  <View style={[styles.bar, { width: `${l.risco_evasao * 100}%`, backgroundColor: riscoColor }]} />
                </View>
                <Text style={[styles.risco, { color: riscoColor }]}>
                  Risco de evasão: {Math.round(l.risco_evasao * 100)}%
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  emptyText: { color: colors.gray600, textAlign: 'center', fontSize: typography.size.base },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rank: { fontSize: typography.size.xl, fontWeight: '700', color: colors.gray400, minWidth: 32 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  name: { fontSize: typography.size.base, fontWeight: '600', color: colors.text, flex: 1 },
  meta: { fontSize: typography.size.sm, color: colors.gray600, marginTop: 4 },
  barWrap: { height: 6, backgroundColor: colors.gray100, borderRadius: 3, marginTop: spacing.sm, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  risco: { fontSize: typography.size.xs, fontWeight: '600', marginTop: 6 },
});
