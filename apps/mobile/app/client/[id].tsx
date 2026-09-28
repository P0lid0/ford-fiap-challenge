import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppText, Banner, Button, Card, EmptyState, ErrorState, InfoRow, LoadingState, PerfilBadge, ProgressBar,
  Screen, SectionTitle,
} from '../../components/ui';
import { dataSource, DataSourceError } from '../../lib/data';
import { clientDisplayName, latestPrediction, vehicleSummary } from '../../lib/domain';
import {
  canalLabel, estadoCivilLabel, financiamentoLabel, formatCurrency, formatDate, formatNumber, formatPercent,
  perfilLabel, regiaoLabel,
} from '../../lib/format';
import { useAsync } from '../../lib/hooks/useAsync';
import { colors, perfilTone, radius, riskTone, spacing, surface, toneColors } from '../../lib/theme';
import { PERFIS, type Client, type Insight, type Prediction } from '../../lib/types';

export default function ClientDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, isLoading, reload } = useAsync(() => dataSource.getClient(String(id)), [id]);

  const client = data?.client;
  const prediction = data ? latestPrediction(data.predictions) : undefined;

  return (
    <Screen
      variant="stack"
      eyebrow="Cliente"
      title={client ? clientDisplayName(client) : 'Detalhe do cliente'}
      right={prediction ? <PerfilBadge perfil={prediction.perfil_predito} size="sm" /> : undefined}
    >
      {isLoading ? (
        <LoadingState message="Carregando cliente…" />
      ) : error?.code === 'not_found' ? (
        <EmptyState
          icon="person-outline"
          title="Cliente não encontrado"
          message="Ele pode ter sido removido ou você não tem acesso a esta concessionária."
          action={<Button title="Voltar" variant="secondary" icon="arrow-back" onPress={() => router.back()} />}
        />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : client ? (
        <>
          {prediction ? (
            <>
              <RiskCard prediction={prediction} />
              <ProbabilitiesCard prediction={prediction} />
            </>
          ) : (
            <Banner
              tone="neutral"
              message="Este cliente ainda não tem classificação. Ela é gerada quando há dados suficientes de pré-compra."
            />
          )}
          <AiInsightCard clientId={client.id} />
          {prediction && prediction.recomendacoes_acao.length > 0 && <ActionsCard actions={prediction.recomendacoes_acao} />}
          <SaleCard client={client} />
        </>
      ) : null}
    </Screen>
  );
}

function RiskCard({ prediction }: { prediction: Prediction }) {
  const tone = riskTone(prediction.risco_evasao);
  const level = tone === 'danger' ? 'Risco alto' : tone === 'warning' ? 'Risco médio' : 'Risco baixo';
  return (
    <Card style={styles.gapSm}>
      <AppText variant="overline" color={surface.textMuted}>Risco de evasão</AppText>
      <View style={styles.riskRow}>
        <AppText variant="display" color={toneColors[tone].fg}>{formatPercent(prediction.risco_evasao)}</AppText>
        <AppText variant="smallStrong" color={toneColors[tone].fg}>{level}</AppText>
      </View>
      <ProgressBar value={prediction.risco_evasao} tone={tone} height={8} accessibilityLabel="Risco de evasão" />
      <AppText variant="caption" color={surface.textMuted}>
        {`Confiança do modelo: ${formatPercent(prediction.confianca)} · ${prediction.model_version}`}
      </AppText>
    </Card>
  );
}

function ProbabilitiesCard({ prediction }: { prediction: Prediction }) {
  const probabilities = {
    fiel: prediction.prob_fiel,
    abandono: prediction.prob_abandono,
    esquecido: prediction.prob_esquecido,
    economico: prediction.prob_economico,
  };
  return (
    <>
      <SectionTitle title="Probabilidade por perfil" subtitle="Como o modelo distribuiu a classificação" />
      <Card style={styles.gapMd}>
        {PERFIS.map(perfil => {
          const isPredicted = perfil === prediction.perfil_predito;
          return (
            <View key={perfil} style={styles.probRow}>
              <AppText
                variant={isPredicted ? 'smallStrong' : 'small'}
                color={isPredicted ? surface.textPrimary : surface.textSecondary}
                style={styles.probLabel}
              >
                {perfilLabel[perfil]}
              </AppText>
              <View style={styles.flex}>
                <ProgressBar value={probabilities[perfil]} tone={perfilTone[perfil]} accessibilityLabel={perfilLabel[perfil]} />
              </View>
              <AppText variant="smallStrong" align="right" style={styles.probValue}>
                {formatPercent(probabilities[perfil])}
              </AppText>
            </View>
          );
        })}
      </Card>
    </>
  );
}

function AiInsightCard({ clientId }: { clientId: string }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function explain() {
    setLoading(true);
    setError(null);
    try {
      setInsight(await dataSource.getClientInsight(clientId));
    } catch (err) {
      setError(DataSourceError.from(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={styles.gapMd}>
      <View style={styles.aiHeader}>
        <View style={styles.iconBox}>
          <Ionicons name="sparkles" size={18} color={colors.fordBlue} />
        </View>
        <AppText variant="h3" accessibilityRole="header">Análise da IA</AppText>
      </View>
      {insight ? (
        <>
          <AppText variant="body">{insight.output}</AppText>
          <AppText variant="caption" color={surface.textMuted}>{`Modelo: ${insight.model}`}</AppText>
        </>
      ) : (
        <>
          <AppText variant="small" color={surface.textSecondary}>
            Explica em linguagem simples por que o cliente recebeu esse perfil e qual ação priorizar.
          </AppText>
          {error && (
            <Banner tone="danger" icon="alert-circle-outline" message={error} action={{ label: 'Tentar de novo', onPress: explain }} />
          )}
          {!error && (
            <Button title="Explicar este cliente" icon="sparkles-outline" variant="secondary" loading={loading} onPress={explain} />
          )}
        </>
      )}
    </Card>
  );
}

function ActionsCard({ actions }: { actions: string[] }) {
  return (
    <>
      <SectionTitle title="Ações sugeridas" subtitle="Recomendadas para o perfil do cliente" />
      <Card style={styles.gapMd}>
        {actions.map((action, index) => (
          <View key={action} style={styles.actionRow}>
            <View style={styles.actionNumber}>
              <AppText variant="caption" color={colors.fordBlue}>{String(index + 1)}</AppText>
            </View>
            <AppText variant="small" style={styles.flex}>{action}</AppText>
          </View>
        ))}
      </Card>
    </>
  );
}

function SaleCard({ client }: { client: Client }) {
  const financing = client.financiamento
    ? `${financiamentoLabel[client.financiamento]}${client.parcelas ? ` (${client.parcelas}x)` : ''}`
    : null;
  const rows: Array<[string, string | null]> = [
    ['Veículo', vehicleSummary(client) || null],
    ['Data da venda', client.sales_date ? formatDate(client.sales_date) : null],
    ['Preço pago', client.preco_pago_brl != null ? formatCurrency(client.preco_pago_brl) : null],
    ['Pagamento', financing],
    ['Canal', client.canal_aquisicao ? canalLabel[client.canal_aquisicao] : null],
    ['Score de crédito', client.score_credito != null ? formatNumber(client.score_credito) : null],
    ['Idade', client.idade != null ? `${client.idade} anos` : null],
    ['Estado civil', client.estado_civil ? estadoCivilLabel[client.estado_civil] : null],
    ['Região', client.regiao ? regiaoLabel[client.regiao] : null],
    ['Renda mensal', client.renda_mensal_brl != null ? formatCurrency(client.renda_mensal_brl) : null],
    ['Revisões na rede', client.num_revisoes != null ? formatNumber(client.num_revisoes) : null],
    ['Última revisão', client.dias_desde_ultima_revisao != null ? `há ${formatNumber(client.dias_desde_ultima_revisao)} dias` : null],
  ];
  const visibleRows = rows.filter((row): row is [string, string] => row[1] !== null);

  return (
    <>
      <SectionTitle title="Dados da venda" />
      <Card>
        {visibleRows.map(([label, value], index) => (
          <InfoRow key={label} label={label} value={value} divider={index < visibleRows.length - 1} />
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapSm: { gap: spacing.sm },
  gapMd: { gap: spacing.md },
  riskRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  probRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  probLabel: { width: 84 },
  probValue: { width: 44 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: {
    width: 32, height: 32, borderRadius: radius.md, backgroundColor: surface.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  actionNumber: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: surface.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
});
