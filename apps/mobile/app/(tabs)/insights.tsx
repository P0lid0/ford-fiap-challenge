import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import {
  AppText, Banner, Button, Card, ErrorState, KpiCard, LoadingState, PerfilBadge, Screen, SectionTitle,
} from '../../components/ui';
import { dataSource } from '../../lib/data';
import { formatNumber, formatPercent } from '../../lib/format';
import { useAsync } from '../../lib/hooks/useAsync';
import { useRevalidateOnFocus } from '../../lib/hooks/useRevalidateOnFocus';
import { colors, radius, riskTone, spacing, surface } from '../../lib/theme';
import { PERFIS, type PortfolioInsight } from '../../lib/types';

const SOURCE_LABEL: Record<PortfolioInsight['source'], string> = {
  cache: 'em cache',
  fresh: 'gerado agora',
  local: 'gerado no aparelho',
};

export default function InsightsScreen() {
  const { data, error, isLoading, isRefreshing, reload, refresh, revalidate } = useAsync(
    () => dataSource.getPortfolioInsight(),
    [],
  );
  useRevalidateOnFocus(revalidate);

  return (
    <Screen
      title="Insights"
      subtitle="Análise da carteira"
      onRefresh={data ? refresh : undefined}
      refreshing={isRefreshing}
    >
      {isLoading && !data ? (
        <LoadingState message="Gerando análise…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <InsightContent insight={data} refreshError={error?.message} isRefreshing={isRefreshing} onRefresh={refresh} />
      ) : null}
    </Screen>
  );
}

type InsightContentProps = {
  insight: PortfolioInsight;
  refreshError?: string;
  isRefreshing: boolean;
  onRefresh: () => void;
};

function InsightContent({ insight, refreshError, isRefreshing, onRefresh }: InsightContentProps) {
  const metrics = insight.metrics;
  return (
    <>
      {refreshError && (
        <Banner tone="danger" icon="cloud-offline-outline" title="Não foi possível atualizar" message={refreshError} />
      )}
      {insight.source === 'local' && (
        <Banner
          tone="neutral"
          icon="flask-outline"
          message="Modo demonstração: texto gerado por regras a partir dos números. Com a API, a análise vem do modelo de IA configurado."
        />
      )}

      <Card style={styles.briefing}>
        <View style={styles.briefingHeader}>
          <View style={styles.iconBox}>
            <Ionicons name="sparkles" size={18} color={colors.fordBlue} />
          </View>
          <AppText variant="h3" accessibilityRole="header">Briefing executivo</AppText>
        </View>
        <AppText variant="body">{insight.output}</AppText>
        <AppText variant="caption" color={surface.textMuted}>
          {`Modelo: ${insight.model} · ${SOURCE_LABEL[insight.source] ?? insight.source}`}
        </AppText>
      </Card>

      <Button
        title="Atualizar análise"
        icon="refresh"
        variant="secondary"
        fullWidth
        loading={isRefreshing}
        onPress={onRefresh}
      />

      {metrics && (
        <>
          <SectionTitle title="Números da análise" subtitle="Base usada para gerar o briefing" />
          <View style={styles.kpiRow}>
            <KpiCard label="Clientes" value={formatNumber(metrics.totalClients)} icon="people-outline" />
            <KpiCard
              label="Risco médio"
              value={formatPercent(metrics.avgRisco)}
              icon="trending-up-outline"
              tone={riskTone(metrics.avgRisco)}
            />
          </View>
          <Card>
            {PERFIS.map((perfil, index) => (
              <View key={perfil} style={[styles.perfilRow, index < PERFIS.length - 1 && styles.divider]}>
                <PerfilBadge perfil={perfil} size="sm" />
                <AppText variant="smallStrong">
                  {`${formatNumber(metrics.perfilCounts[perfil] ?? 0)} clientes`}
                </AppText>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  briefing: { gap: spacing.md },
  briefingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: surface.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiRow: { flexDirection: 'row', gap: spacing.md },
  perfilRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: surface.border },
});
