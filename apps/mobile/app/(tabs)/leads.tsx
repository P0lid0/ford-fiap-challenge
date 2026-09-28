import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ClientCard } from '../../components/ClientCard';
import {
  AppText, ChipGroup, EmptyState, ErrorState, LoadingState, Screen, Tag,
  type ChipOption, type IconName,
} from '../../components/ui';
import { dataSource } from '../../lib/data';
import { clientDisplayName, leadDetails } from '../../lib/domain';
import { formatNumber, formatPercent, sinalLabel } from '../../lib/format';
import { useAsync } from '../../lib/hooks/useAsync';
import { useRevalidateOnFocus } from '../../lib/hooks/useRevalidateOnFocus';
import { spacing, surface, toneColors, type Tone } from '../../lib/theme';
import type { Lead, LeadSinal } from '../../lib/types';

/** Faixa a partir da qual o lead é considerado crítico (contato na semana). */
const CRITICAL_RISK = 0.7;

const RISK_FILTERS: ReadonlyArray<ChipOption<number>> = [
  { value: 0.5, label: '≥ 50%' },
  { value: 0.7, label: '≥ 70%' },
  { value: 0.9, label: '≥ 90%' },
];

/** Aparência de cada sinal de risco (mesmos sinais da função SQL leads_ranqueados). */
const SINAL_STYLE: Record<LeadSinal, { tone: Tone; icon: IconName }> = {
  revisao_atrasada: { tone: 'danger', icon: 'build-outline' },
  sem_revisao_alguma: { tone: 'danger', icon: 'close-circle-outline' },
  garantia_vencida: { tone: 'warning', icon: 'shield-outline' },
  garantia_vencendo: { tone: 'warning', icon: 'hourglass-outline' },
  dealer_loyalty_baixa: { tone: 'warning', icon: 'swap-horizontal-outline' },
  veiculo_veterano: { tone: 'neutral', icon: 'time-outline' },
};

export default function LeadsScreen() {
  const router = useRouter();
  const [riskMin, setRiskMin] = useState(RISK_FILTERS[0]!.value);
  const { data: leads, error, isLoading, isRefreshing, reload, refresh, revalidate } = useAsync(
    () => dataSource.listLeads(riskMin),
    [riskMin],
  );
  useRevalidateOnFocus(revalidate);

  return (
    <Screen
      title="Leads"
      subtitle="Clientes em risco, do mais urgente ao menos urgente"
      onRefresh={leads ? refresh : undefined}
      refreshing={isRefreshing}
    >
      <View style={styles.filter}>
        <AppText variant="overline" color={surface.textMuted}>Risco mínimo</AppText>
        <ChipGroup accessibilityLabel="Risco mínimo" options={RISK_FILTERS} value={riskMin} onChange={setRiskMin} />
      </View>

      {isLoading ? (
        <LoadingState message="Buscando leads…" />
      ) : error && !leads ? (
        <ErrorState error={error} onRetry={reload} />
      ) : leads ? (
        <LeadList leads={leads} riskMin={riskMin} onOpenClient={id => router.push(`/client/${id}`)} />
      ) : null}
    </Screen>
  );
}

type LeadListProps = {
  leads: Lead[];
  riskMin: number;
  onOpenClient: (clientId: string) => void;
};

function LeadList({ leads, riskMin, onOpenClient }: LeadListProps) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon="checkmark-circle-outline"
        iconColor={toneColors.success.fg}
        iconBackground={toneColors.success.bg}
        title={`Nenhum lead com risco ${formatPercent(riskMin)} ou mais`}
        message="Boa notícia: nenhum cliente passou desse nível de risco. Tente um filtro menor."
      />
    );
  }

  const criticalCount = leads.filter(lead => lead.risco_composto >= CRITICAL_RISK).length;

  return (
    <>
      <AppText variant="small" color={surface.textSecondary} accessibilityLiveRegion="polite">
        {`${formatNumber(leads.length)} ${leads.length === 1 ? 'lead' : 'leads'} · `}
        <AppText variant="smallStrong" color={toneColors.danger.fg}>
          {`${formatNumber(criticalCount)} ${criticalCount === 1 ? 'crítico' : 'críticos'}`}
        </AppText>
        {` (risco ≥ ${formatPercent(CRITICAL_RISK)})`}
      </AppText>

      <View style={styles.list}>
        {leads.map((lead, index) => (
          <ClientCard
            key={lead.id}
            rank={index + 1}
            name={clientDisplayName(lead)}
            details={leadDetails(lead)}
            detailsLines={2}
            perfil={lead.perfil_real}
            risk={lead.risco_composto}
            riskLabel="Risco composto"
            footer={lead.sinais.length > 0 ? <SinalTags sinais={lead.sinais} /> : null}
            onPress={() => onOpenClient(lead.id)}
          />
        ))}
      </View>
    </>
  );
}

function SinalTags({ sinais }: { sinais: LeadSinal[] }) {
  return (
    <View style={styles.tags}>
      {sinais.map(sinal => {
        const style = SINAL_STYLE[sinal] ?? { tone: 'neutral' as const, icon: 'information-circle-outline' as const };
        return <Tag key={sinal} label={sinalLabel[sinal] ?? sinal} tone={style.tone} icon={style.icon} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  filter: { gap: spacing.sm },
  list: { gap: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
