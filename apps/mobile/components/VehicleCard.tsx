import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { formatCurrencyShort, formatNumber } from '../lib/format';
import { colors, spacing, surface } from '../lib/theme';
import type { Vehicle } from '../lib/types';
import { AppText, Card } from './ui';

type VehicleCardProps = {
  vehicle: Vehicle;
  selected: boolean;
  /** Limite de seleção atingido e este veículo não está selecionado. */
  disabled?: boolean;
  onToggle: () => void;
};

/** Lê um número de um grupo de especificações (motor, dimensões…) vindo da API. */
function numberAt(group: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = group?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function isFordVehicle(vehicle: Vehicle): boolean {
  return vehicle.marca.trim().toLowerCase() === 'ford';
}

/** Card selecionável de veículo (Desafio 1 — inteligência competitiva). */
export function VehicleCard({ vehicle, selected, disabled = false, onToggle }: VehicleCardProps) {
  const potencia = numberAt(vehicle.motor, 'potencia_cv');
  const torque = numberAt(vehicle.motor, 'torque_nm');
  const title = `${vehicle.modelo} ${vehicle.versao}`.trim();

  return (
    <Card
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      checked={selected}
      accessibilityLabel={`${vehicle.marca} ${title}`}
      accessibilityHint={selected ? 'Remove da comparação' : 'Adiciona à comparação'}
      style={[styles.card, selected && styles.selected]}
    >
      <View style={styles.header}>
        <View style={styles.texts}>
          <AppText variant="overline" color={isFordVehicle(vehicle) ? colors.fordBlue : surface.textMuted}>
            {vehicle.marca}
          </AppText>
          <AppText variant="h3" numberOfLines={2}>{title}</AppText>
        </View>
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected && <Ionicons name="checkmark" size={18} color={colors.white} />}
        </View>
      </View>

      <View style={styles.specs}>
        <Spec label="Potência" value={potencia != null ? `${formatNumber(potencia)} cv` : '—'} />
        <Spec label="Torque" value={torque != null ? `${formatNumber(torque)} Nm` : '—'} />
        <Spec label="Preço" value={formatCurrencyShort(vehicle.preco_brl)} />
      </View>
    </Card>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <AppText variant="caption" color={surface.textMuted}>{label}</AppText>
      <AppText variant="smallStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  selected: { borderColor: colors.fordBlue, backgroundColor: '#F4F7FB' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  texts: { flex: 1, gap: 2 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: surface.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.fordBlue, borderColor: colors.fordBlue },
  specs: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: surface.border,
  },
  spec: { flex: 1, gap: 2 },
});
