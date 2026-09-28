import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ClientCard } from '../../components/ClientCard';
import {
  AppText, Banner, Button, Card, EmptyState, ErrorState, IconButton, KpiCard, LoadingState,
  PerfilBadge, ProgressBar, Screen, SectionTitle,
} from '../../components/ui';
import { useAuth } from '../../lib/auth/AuthProvider';
import { confirmAction } from '../../lib/confirm';
import { dataSource } from '../../lib/data';
import { clientDisplayName, latestPrediction, vehicleSummary } from '../../lib/domain';
import { formatCurrency, formatNumber, formatPercent, perfilDescription, perfilLabel } from '../../lib/format';
import { useAsync } from '../../lib/hooks/useAsync';
import { useRevalidateOnFocus } from '../../lib/hooks/useRevalidateOnFocus';
import { perfilTone, spacing, surface, type Tone } from '../../lib/theme';
import { PERFIS, type ClientSummary, type DealershipMetrics } from '../../lib/types';

const RECENT_CLIENTS_LIMIT = 8;

type CarteiraData = {
  metrics: DealershipMetrics;
  clients: ClientSummary[];
};

async function loadCarteira(): Promise<CarteiraData> {
  const [metrics, page] = await Promise.all([dataSource.getMetrics(), dataSource.listClients()]);
  return { metrics, clients: page.results };
}

/** Indicadores "quanto maior, melhor": ≥ 60% verde · ≥ 40% âmbar · abaixo, vermelho. */
function shareTone(value: number): Tone {
  if (value >= 0.6) return 'success';
  if (value >= 0.4) return 'warning';
  return 'danger';
}

export default function CarteiraScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data, error, isLoading, isRefreshing, reload, refresh, revalidate } = useAsync(loadCarteira, []);
  useRevalidateOnFocus(revalidate);

  function handleSignOut() {
    confirmAction({
      title: 'Sair da conta?',
      message: 'Você precisará entrar novamente para acessar a carteira.',
      confirmLabel: 'Sair',
      destructive: true,
      onConfirm: () => { void signOut(); },
    });
  }

  return (
    <Screen
      title="Carteira"
      subtitle="Visão geral da concessionária"
      right={<IconButton icon="log-out-outline" accessibilityLabel="Sair da conta" onPress={handleSignOut} />}
      onRefresh={data ? refresh : undefined}
      refreshing={isRefreshing}
    >
      {isLoading && !data ? (
        <LoadingState message="Carregando carteira…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <CarteiraContent
          data={data}
          refreshError={error?.message}
          onNewClient={() => router.push('/client/new')}
          onOpenClient={id => router.push(`/client/${id}`)}
        />
      ) : null}
    </Screen>
  );
}

type CarteiraContentProps = {
  data: CarteiraData;
  refreshError?: string;
  onNewClient: () => void;
  onOpenClient: (clientId: string) => void;
};

/** Conteúdo da tela — devolve um fragmento para herdar o espaçamento do Screen. */
function CarteiraContent({ data, refreshError, onNewClient, onOpenClient }: CarteiraContentProps) {
  const { metrics, clients } = data;
  const recentClients = clients.slice(0, RECENT_CLIENTS_LIMIT);

  return (
    <>
      {refreshError && (
        <Banner tone="danger" icon="cloud-offline-outline" title="Não foi possível atualizar" message={refreshError} />
      )}

      <View style={styles.kpiGrid}>
        <View style={styles.kpiRow}>
          <KpiCard
            label="VIN Share"
            value={formatPercent(metrics.vin_share_estimado)}
            icon="pie-chart-outline"
            tone={shareTone(metrics.vin_share_estimado)}
            hint="revisam na rede"
          />
          <KpiCard
            label="Clientes"
            value={formatNumber(metrics.total_clientes)}
            icon="people-outline"
            hint={`${formatNumber(metrics.clientes_ativos)} ativos`}
          />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard
            label="Alto risco"
            value={formatNumber(metrics.alto_risco_count)}
            icon="warning-outline"
            tone={metrics.alto_risco_count > 0 ? 'danger' : 'success'}
            hint="prioridade de contato"
          />
          <KpiCard
            label="Aderência"
            value={formatPercent(metrics.taxa_aderencia_revisoes)}
            icon="construct-outline"
            tone={shareTone(metrics.taxa_aderencia_revisoes)}
            hint="2+ revisões na rede"
          />
        </View>
      </View>

      <Button
        title="Cadastrar venda"
        icon="add-circle-outline"
        fullWidth
        onPress={onNewClient}
        accessibilityHint="Abre o formulário de nova venda com classificação automática"
      />

      <PerfilDistribution counts={metrics.perfil_counts} />

      <SectionTitle title="Clientes recentes" subtitle="Toque para ver risco e ações sugeridas" />
      {recentClients.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon="people-outline"
            title="Nenhum cliente ainda"
            message="Cadastre a primeira venda para ver a classificação de retenção."
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {recentClients.map(client => {
            const prediction = latestPrediction(client.predictions);
            return (
              <ClientCard
                key={client.id}
                name={clientDisplayName(client)}
                details={vehicleSummary(client)}
                detailsTrailing={client.preco_pago_brl != null ? formatCurrency(client.preco_pago_brl) : undefined}
                perfil={prediction?.perfil_predito}
                risk={prediction?.risco_evasao}
                onPress={() => onOpenClient(client.id)}
              />
            );
          })}
        </View>
      )}
    </>
  );
}

function PerfilDistribution({ counts }: { counts: DealershipMetrics['perfil_counts'] }) {
  const total = PERFIS.reduce((sum, perfil) => sum + (counts[perfil] ?? 0), 0);
  return (
    <>
      <SectionTitle title="Perfis da carteira" subtitle={`${formatNumber(total)} clientes classificados`} />
      <Card style={styles.perfis}>
        {PERFIS.map(perfil => {
          const count = counts[perfil] ?? 0;
          const share = total > 0 ? count / total : 0;
          return (
            <View key={perfil} style={styles.perfilItem}>
              <View style={styles.perfilHeader}>
                <PerfilBadge perfil={perfil} size="sm" />
                <AppText variant="smallStrong">{`${formatNumber(count)} · ${formatPercent(share)}`}</AppText>
              </View>
              <ProgressBar value={share} tone={perfilTone[perfil]} accessibilityLabel={`Perfil ${perfilLabel[perfil]}: ${formatPercent(share)}`} />
              <AppText variant="caption" color={surface.textMuted}>{perfilDescription[perfil]}</AppText>
            </View>
          );
        })}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { gap: spacing.md },
  kpiRow: { flexDirection: 'row', gap: spacing.md },
  perfis: { gap: spacing.lg },
  perfilItem: { gap: 6 },
  perfilHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: spacing.md },
});
