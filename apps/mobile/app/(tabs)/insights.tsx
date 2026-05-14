import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { colors, spacing, typography } from '../../lib/theme';

export default function Insights() {
  const [insight, setInsight] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.portfolioInsight().then(setInsight).catch(console.warn).finally(() => setLoading(false));
  }, []);

  return (
    <Screen title="Insights" subtitle="Análise da carteira com Claude (IA)">
      {loading && <ActivityIndicator color={colors.fordBlue} style={{ marginTop: 40 }} />}
      {insight && (
        <>
          <Card>
            <View style={styles.header}>
              <Ionicons name="sparkles" size={22} color={colors.fordBlue} />
              <Text style={styles.title}>Briefing executivo</Text>
            </View>
            <Text style={styles.body}>{insight.output}</Text>
            <Text style={styles.meta}>
              modelo: {insight.model} · {insight.source === 'cache' ? 'cache' : 'fresh'}
            </Text>
          </Card>
          {insight.metrics && (
            <Card>
              <Text style={styles.metricsTitle}>Métricas do escopo</Text>
              <Row k="Total de clientes" v={String(insight.metrics.totalClients)} />
              <Row k="Risco médio de evasão" v={`${Math.round(insight.metrics.avgRisco * 100)}%`} />
              <Row k="Fiel" v={String(insight.metrics.perfilCounts.fiel)} />
              <Row k="Abandono" v={String(insight.metrics.perfilCounts.abandono)} />
              <Row k="Esquecido" v={String(insight.metrics.perfilCounts.esquecido)} />
              <Row k="Econômico" v={String(insight.metrics.perfilCounts.economico)} />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  title: { fontSize: typography.size.lg, fontWeight: '700', color: colors.fordBlue },
  body: { fontSize: typography.size.base, lineHeight: 24, color: colors.text },
  meta: { fontSize: typography.size.xs, color: colors.gray600, marginTop: spacing.md },
  metricsTitle: { fontSize: typography.size.base, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { fontSize: typography.size.sm, color: colors.gray600 },
  v: { fontSize: typography.size.sm, fontWeight: '700', color: colors.text },
});
