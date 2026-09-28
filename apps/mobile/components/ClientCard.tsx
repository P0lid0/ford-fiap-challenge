import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatPercent, perfilLabel } from '../lib/format';
import { riskTone, spacing, surface, toneColors } from '../lib/theme';
import type { Perfil } from '../lib/types';
import { AppText, Card, PerfilBadge, ProgressBar } from './ui';

type ClientCardProps = {
  name: string;
  /** Linha de detalhes (ex.: "Ranger XLT 2023") — é cortada com "…" se faltar espaço. */
  details: string;
  /** Valor à direita da linha de detalhes (ex.: preço) — nunca é cortado. */
  detailsTrailing?: string;
  /** Máximo de linhas dos detalhes antes de cortar com "…". Padrão: 1. */
  detailsLines?: number;
  perfil?: Perfil | null;
  /** Risco entre 0 e 1 — mostra a barra colorida quando informado. */
  risk?: number | null;
  riskLabel?: string;
  /** Posição no ranking (aba Leads). */
  rank?: number;
  /** Conteúdo extra no rodapé do card (ex.: sinais do lead). */
  footer?: ReactNode;
  onPress: () => void;
};

/** Card de cliente usado na Carteira e nos Leads. Tocar abre o detalhe. */
export function ClientCard({
  name, details, detailsTrailing, detailsLines = 1, perfil, risk, riskLabel = 'Risco de evasão', rank, footer, onPress,
}: ClientCardProps) {
  const hasRisk = typeof risk === 'number';
  const tone = hasRisk ? riskTone(risk) : 'neutral';
  const accessibilityLabel = [
    rank !== undefined ? `Posição ${rank}` : null,
    name,
    perfil ? `perfil ${perfilLabel[perfil]}` : null,
    hasRisk ? `${riskLabel} ${formatPercent(risk)}` : null,
  ].filter(Boolean).join(', ');

  return (
    <Card onPress={onPress} accessibilityLabel={accessibilityLabel} accessibilityHint="Abre o detalhe do cliente" style={styles.card}>
      <View style={styles.header}>
        {rank !== undefined && (
          <AppText variant="h3" color={surface.textMuted} style={styles.rank}>{`#${rank}`}</AppText>
        )}
        <View style={styles.texts}>
          <View style={styles.line}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>{name}</AppText>
            {perfil && <PerfilBadge perfil={perfil} size="sm" />}
          </View>
          <View style={styles.line}>
            <AppText variant="small" color={surface.textSecondary} numberOfLines={detailsLines} style={styles.flex}>
              {details}
            </AppText>
            {detailsTrailing && <AppText variant="smallStrong">{detailsTrailing}</AppText>}
          </View>
        </View>
      </View>
      {hasRisk && (
        <View style={styles.riskRow}>
          <View style={styles.flex}>
            <ProgressBar value={risk} tone={tone} height={4} />
          </View>
          <AppText variant="caption" color={toneColors[tone].fg}>{`${riskLabel} ${formatPercent(risk)}`}</AppText>
        </View>
      )}
      {footer}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rank: { minWidth: 36 },
  texts: { flex: 1, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
