import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { PerfilBadge } from '../../components/PerfilBadge';
import { Screen } from '../../components/Screen';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { colors, radius, spacing, typography } from '../../lib/theme';

export default function Carteira() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([api.metrics(), api.listClients()]);
      setMetrics(m);
      setClients(c.results);
    } catch (e) {
      console.warn('[carteira] load error', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Screen title="Carteira" scroll={false}>
        <View style={{ alignItems: 'center', marginTop: 80 }}>
          <ActivityIndicator color={colors.fordBlue} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Carteira"
      subtitle="KPIs da concessionária + clientes recentes"
      action={
        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.gray600} />
        </Pressable>
      }
    >
      <View style={styles.kpis}>
        <Kpi label="VIN Share" value={metrics ? `${Math.round(metrics.vin_share_estimado * 100)}%` : '—'} color={colors.success} />
        <Kpi label="Clientes" value={metrics?.total_clientes ?? '—'} />
        <Kpi label="Alto risco" value={metrics?.alto_risco_count ?? '—'} color={colors.danger} />
      </View>

      <Text style={styles.sectionTitle}>Distribuição de perfis</Text>
      <Card>
        {(['fiel', 'abandono', 'esquecido', 'economico'] as const).map(p => (
          <View key={p} style={styles.profileRow}>
            <View style={{ flex: 1 }}>
              <PerfilBadge perfil={p} />
            </View>
            <Text style={styles.profileCount}>{metrics?.perfil_counts?.[p] ?? 0}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.sectionTitle}>Clientes recentes</Text>
      {clients.length === 0 ? (
        <Card>
          <Text style={styles.empty}>Nenhum cliente ainda. Cadastre uma venda em Leads → Novo cliente.</Text>
        </Card>
      ) : (
        clients.slice(0, 12).map(c => (
          <Card key={c.id} onPress={() => router.push(`/client/${c.id}`)}>
            <View style={styles.clientHeader}>
              <Text style={styles.clientName} numberOfLines={1}>
                {c.nome_cliente ?? `Cliente ${c.id.slice(0, 8)}`}
              </Text>
              {c.predictions?.[0] && <PerfilBadge perfil={c.predictions[0].perfil_predito} />}
            </View>
            <Text style={styles.clientMeta}>
              {c.modelo_comprado} {c.versao_comprada} · R$ {c.preco_pago_brl.toLocaleString('pt-BR')}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

function Kpi({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, color && { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { padding: 6 },
  kpis: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  kpi: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.gray300,
  },
  kpiValue: { fontSize: typography.size['2xl'], fontWeight: '700', color: colors.fordBlue },
  kpiLabel: { fontSize: typography.size.xs, color: colors.gray600, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: typography.size.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md, marginTop: spacing.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, justifyContent: 'space-between' },
  profileCount: { fontSize: typography.size.lg, fontWeight: '700', color: colors.text },
  empty: { color: colors.gray600, fontSize: typography.size.sm },
  clientHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  clientName: { fontSize: typography.size.base, fontWeight: '600', color: colors.text, flex: 1 },
  clientMeta: { fontSize: typography.size.sm, color: colors.gray600, marginTop: 4 },
});
