import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { PerfilBadge } from '../../components/PerfilBadge';
import { api } from '../../lib/api';
import { colors, radius, spacing, typography } from '../../lib/theme';

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [insight, setInsight] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getClient(id as string).then(d => {
      setClient(d.client);
      setPredictions(d.predictions);
    }).catch(console.warn);
  }, [id]);

  async function loadInsight() {
    setLoadingInsight(true);
    try {
      const r = await api.clientInsight(id as string);
      setInsight(r);
    } catch (e) { console.warn(e); }
    finally { setLoadingInsight(false); }
  }

  if (!client) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.gray50, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.fordBlue} />
      </SafeAreaView>
    );
  }

  const pred = predictions[0];

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.headerLabel}>Cliente</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {client.nome_cliente ?? `${client.id.slice(0, 8)}`}
          </Text>
        </View>
        {pred && <PerfilBadge perfil={pred.perfil_predito} />}
      </View>

      <View style={{ padding: spacing.xl }}>
        {pred && (
          <Card>
            <Text style={styles.sectionTitle}>Risco de evasão</Text>
            <View style={styles.riskRow}>
              <Text style={styles.riskValue}>{Math.round(pred.risco_evasao * 100)}%</Text>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={styles.barWrap}>
                  <View style={[styles.bar, { width: `${pred.risco_evasao * 100}%` }]} />
                </View>
                <Text style={styles.confianca}>
                  Confiança do modelo: {Math.round(pred.confianca * 100)}%
                </Text>
              </View>
            </View>
            {(['fiel', 'abandono', 'esquecido', 'economico'] as const).map(p => {
              const v = pred[`prob_${p}`];
              return (
                <View key={p} style={styles.probRow}>
                  <Text style={styles.probLabel}>{p}</Text>
                  <View style={styles.probBarWrap}>
                    <View style={[styles.probBar, { width: `${v * 100}%` }]} />
                  </View>
                  <Text style={styles.probValue}>{Math.round(v * 100)}%</Text>
                </View>
              );
            })}
          </Card>
        )}

        <Card>
          <Text style={styles.sectionTitle}>Análise da IA</Text>
          {!insight && (
            <Pressable style={styles.aiBtn} onPress={loadInsight}>
              <Ionicons name="sparkles-outline" size={18} color={colors.fordBlue} />
              <Text style={styles.aiBtnText}>
                {loadingInsight ? 'Analisando…' : 'Explicar com Claude'}
              </Text>
            </Pressable>
          )}
          {insight && (
            <>
              <Text style={styles.insightBody}>{insight.output}</Text>
              <Text style={styles.insightMeta}>modelo: {insight.model} · {insight.source}</Text>
            </>
          )}
        </Card>

        {pred?.recomendacoes_acao?.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Ações sugeridas</Text>
            {pred.recomendacoes_acao.map((a: string, i: number) => (
              <View key={i} style={styles.actionRow}>
                <Ionicons name="ellipse" size={6} color={colors.fordBlue} style={{ marginTop: 8 }} />
                <Text style={styles.actionText}>{a}</Text>
              </View>
            ))}
          </Card>
        )}

        <Card>
          <Text style={styles.sectionTitle}>Dados da venda</Text>
          <Row k="Modelo" v={`${client.modelo_comprado} ${client.versao_comprada}`} />
          <Row k="Preço pago" v={`R$ ${client.preco_pago_brl.toLocaleString('pt-BR')}`} />
          <Row k="Financiamento" v={`${client.financiamento} (${client.parcelas}x)`} />
          <Row k="Score" v={String(client.score_credito)} />
          <Row k="Idade / Região" v={`${client.idade} anos · ${client.regiao}`} />
          <Row k="Canal" v={client.canal_aquisicao} />
        </Card>
      </View>
    </SafeAreaView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.detRow}>
      <Text style={styles.detK}>{k}</Text>
      <Text style={styles.detV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    backgroundColor: colors.fordBlue,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLabel: { color: colors.gray300, fontSize: typography.size.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { color: colors.white, fontSize: typography.size.lg, fontWeight: '700' },
  sectionTitle: { fontSize: typography.size.base, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  riskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  riskValue: { fontSize: typography.size['3xl'], fontWeight: '900', color: colors.danger },
  barWrap: { height: 8, backgroundColor: colors.gray100, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, backgroundColor: colors.danger, borderRadius: 4 },
  confianca: { fontSize: typography.size.xs, color: colors.gray600, marginTop: spacing.sm },
  probRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: spacing.sm },
  probLabel: { width: 80, fontSize: typography.size.sm, color: colors.gray800 },
  probBarWrap: { flex: 1, height: 4, backgroundColor: colors.gray100, borderRadius: 2, overflow: 'hidden' },
  probBar: { height: 4, backgroundColor: colors.fordBlue, borderRadius: 2 },
  probValue: { width: 40, textAlign: 'right', fontSize: typography.size.sm, fontWeight: '600', color: colors.text },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray300,
    alignSelf: 'flex-start',
  },
  aiBtnText: { color: colors.fordBlue, fontWeight: '600' },
  insightBody: { fontSize: typography.size.base, lineHeight: 24, color: colors.text },
  insightMeta: { fontSize: typography.size.xs, color: colors.gray600, marginTop: spacing.md },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  actionText: { flex: 1, fontSize: typography.size.sm, color: colors.text, lineHeight: 22 },
  detRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detK: { fontSize: typography.size.sm, color: colors.gray600 },
  detV: { fontSize: typography.size.sm, color: colors.text, fontWeight: '600' },
});
