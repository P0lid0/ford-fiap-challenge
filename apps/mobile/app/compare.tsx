import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ComparisonTable, winnerIndexes } from '../components/ComparisonTable';
import {
  AppText, Banner, Button, Card, EmptyState, ErrorState, LoadingState, ProgressBar, Screen, SectionTitle,
} from '../components/ui';
import { dataSource } from '../lib/data';
import { useAsync } from '../lib/hooks/useAsync';
import { colors, spacing, surface, toneColors } from '../lib/theme';
import type { ComparisonResult } from '../lib/types';

const MIN_VEHICLES = 2;

export default function CompareScreen() {
  const router = useRouter();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const vehicleIds = useMemo(
    () => (ids ?? '').split(',').map(id => id.trim()).filter(Boolean),
    [ids],
  );
  const hasEnoughVehicles = vehicleIds.length >= MIN_VEHICLES;

  const { data, error, isLoading, reload } = useAsync<ComparisonResult | null>(
    () => (hasEnoughVehicles ? dataSource.compareVehicles(vehicleIds) : Promise.resolve(null)),
    [ids],
  );

  return (
    <Screen
      variant="stack"
      eyebrow="Comparativo"
      title={hasEnoughVehicles ? `${vehicleIds.length} veículos` : 'Comparativo'}
    >
      {!hasEnoughVehicles ? (
        <EmptyState
          icon="git-compare-outline"
          title={`Selecione ao menos ${MIN_VEHICLES} veículos`}
          message="Volte para a aba Concorrência e escolha de 2 a 5 veículos."
          action={<Button title="Voltar" variant="secondary" icon="arrow-back" onPress={() => router.back()} />}
        />
      ) : isLoading ? (
        <LoadingState message="Comparando veículos…" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data ? (
        <ComparisonContent result={data} />
      ) : null}
    </Screen>
  );
}

function ComparisonContent({ result }: { result: ComparisonResult }) {
  return (
    <>
      {dataSource.mode === 'local' && (
        <Banner
          tone="neutral"
          icon="information-circle-outline"
          message="Modo demonstração: fichas técnicas com valores aproximados."
        />
      )}
      <SectionTitle title="Placar" subtitle="Atributos em que cada veículo tem o melhor valor · empates totais não contam" />
      <Scoreboard result={result} />
      <SectionTitle title="Ficha técnica" subtitle="Deslize a tabela para o lado para ver todos os veículos" />
      <Legend />
      <ComparisonTable result={result} />
    </>
  );
}

function Scoreboard({ result }: { result: ComparisonResult }) {
  const comparableCount = result.fields.filter(field => field.criterion !== 'none').length;
  const winnersByField = result.fields.map(winnerIndexes);
  const ranking = result.vehicles
    .map((vehicle, index) => ({
      vehicle,
      wins: winnersByField.filter(winners => winners.includes(index)).length,
    }))
    .sort((a, b) => b.wins - a.wins);
  const bestScore = ranking[0]?.wins ?? 0;

  return (
    <Card style={styles.scoreboard}>
      {ranking.map(({ vehicle, wins }) => {
        // Empates ficam na mesma posição (ex.: 1º, 1º, 3º).
        const position = ranking.filter(other => other.wins > wins).length;
        const isLeader = wins === bestScore && wins > 0;
        return (
          <View
            key={vehicle.id}
            style={styles.scoreItem}
            accessible
            accessibilityLabel={`${position + 1}º: ${vehicle.marca} ${vehicle.modelo} ${vehicle.versao}, ${wins} de ${comparableCount} atributos`}
          >
            <View style={styles.scoreHeader}>
              <AppText variant="smallStrong" numberOfLines={1} style={styles.flex}>
                {`${position + 1}. ${vehicle.modelo} ${vehicle.versao}`}
              </AppText>
              <AppText variant="smallStrong" color={isLeader ? toneColors.success.fg : surface.textSecondary}>
                {`${wins} de ${comparableCount}`}
              </AppText>
            </View>
            <ProgressBar value={comparableCount > 0 ? wins / comparableCount : 0} tone={isLeader ? 'success' : 'default'} />
          </View>
        );
      })}
    </Card>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      <LegendItem icon="trophy" color={toneColors.success.fg} label="Melhor valor" />
      <LegendItem icon="arrow-up" color={surface.textMuted} label="Maior é melhor" />
      <LegendItem icon="arrow-down" color={surface.textMuted} label="Menor é melhor" />
      <LegendItem icon="remove" color={colors.fordBlue} label="Ford" />
    </View>
  );
}

function LegendItem({ icon, color, label }: { icon: 'trophy' | 'arrow-up' | 'arrow-down' | 'remove'; color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <Ionicons name={icon} size={14} color={color} />
      <AppText variant="caption" color={surface.textSecondary}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scoreboard: { gap: spacing.md },
  scoreItem: { gap: 6 },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
