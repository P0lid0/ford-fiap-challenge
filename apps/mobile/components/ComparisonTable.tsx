import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { formatCurrency, formatNumber } from '../lib/format';
import { colors, spacing, surface, toneColors } from '../lib/theme';
import type { ComparisonField, ComparisonResult, Vehicle } from '../lib/types';
import { AppText, Card } from './ui';
import { isFordVehicle } from './VehicleCard';

const ATTRIBUTE_WIDTH = 148;
const COLUMN_WIDTH = 128;
const HEADER_HEIGHT = 84;
const SECTION_HEIGHT = 34;
const ROW_HEIGHT = 52;

type Section = { title: string; fields: ComparisonField[] };

const SECTION_ORDER: ReadonlyArray<{ title: string; matches: (path: string) => boolean }> = [
  { title: 'Motor', matches: path => path.startsWith('motor.') },
  { title: 'Transmissão', matches: path => path.startsWith('transmissao.') },
  { title: 'Desempenho', matches: path => path.startsWith('desempenho.') },
  { title: 'Dimensões', matches: path => path.startsWith('dimensoes.') },
  { title: 'Preço', matches: path => path === 'preco_brl' },
];

/** Valores de texto vindos do catálogo → rótulo em português. */
const VALUE_LABELS: Record<string, string> = {
  automatica: 'Automática',
  manual: 'Manual',
  cvt: 'CVT',
  diesel: 'Diesel',
  gasolina: 'Gasolina',
  flex: 'Flex',
  eletrico: 'Elétrico',
  hibrido: 'Híbrido',
  turbo: 'Turbo',
  biturbo: 'Biturbo',
  aspirado: 'Aspirado',
};

/** Agrupa os campos da comparação em seções (Motor, Transmissão…). */
export function groupFields(fields: ComparisonField[]): Section[] {
  const sections: Section[] = SECTION_ORDER.map(({ title }) => ({ title, fields: [] }));
  const others: Section = { title: 'Outros', fields: [] };
  for (const field of fields) {
    const index = SECTION_ORDER.findIndex(section => section.matches(field.path));
    (index >= 0 ? sections[index]! : others).fields.push(field);
  }
  return [...sections, others].filter(section => section.fields.length > 0);
}

/**
 * Índices dos veículos com o melhor valor no atributo.
 *
 * Diferente do `winner_index` da API (que, no empate, dá a vitória ao primeiro
 * da lista), aqui empates são tratados com justiça:
 *  - empate entre alguns veículos → todos os empatados vencem;
 *  - todos com o mesmo valor (ou menos de 2 valores numéricos) → ninguém vence.
 */
export function winnerIndexes(field: ComparisonField): number[] {
  if (field.criterion === 'none') return [];
  const numeric = field.values
    .map((value, index) => ({ value, index }))
    .filter((item): item is { value: number; index: number } =>
      typeof item.value === 'number' && Number.isFinite(item.value));
  if (numeric.length < 2) return [];
  const numbers = numeric.map(item => item.value);
  const best = field.criterion === 'max' ? Math.max(...numbers) : Math.min(...numbers);
  const winners = numeric.filter(item => item.value === best).map(item => item.index);
  return winners.length === numeric.length ? [] : winners;
}

function formatCell(field: ComparisonField, value: ComparisonField['values'][number]): string {
  if (value == null) return '—';
  if (field.path === 'preco_brl' && typeof value === 'number') return formatCurrency(value);
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return VALUE_LABELS[value.toLowerCase()] ?? value;
}

/**
 * Ficha técnica lado a lado: coluna de atributos fixa + colunas de veículos
 * com rolagem horizontal. A célula vencedora de cada atributo fica em verde.
 */
export function ComparisonTable({ result }: { result: ComparisonResult }) {
  const sections = groupFields(result.fields);
  const { vehicles } = result;

  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.row}>
        {/* Coluna fixa: atributos */}
        <View style={styles.attributeColumn}>
          <View style={[styles.headerCell, styles.attributeHeader]}>
            <AppText variant="overline" color={surface.textMuted}>Atributo</AppText>
          </View>
          {sections.map(section => (
            <Fragment key={section.title}>
              <View style={styles.sectionCell}>
                <AppText variant="overline" color={colors.fordBlue} numberOfLines={1}>{section.title}</AppText>
              </View>
              {section.fields.map(field => (
                <View key={field.path} style={styles.attributeCell}>
                  <AppText variant="small" color={surface.textSecondary} numberOfLines={2} style={styles.flex}>
                    {field.label}
                  </AppText>
                  {field.criterion !== 'none' && (
                    <Ionicons
                      name={field.criterion === 'max' ? 'arrow-up' : 'arrow-down'}
                      size={12}
                      color={surface.textMuted}
                      accessibilityLabel={field.criterion === 'max' ? 'maior é melhor' : 'menor é melhor'}
                    />
                  )}
                </View>
              ))}
            </Fragment>
          ))}
        </View>

        {/* Colunas dos veículos */}
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.row}>
              {vehicles.map(vehicle => <VehicleHeader key={vehicle.id} vehicle={vehicle} />)}
            </View>
            {sections.map(section => (
              <Fragment key={section.title}>
                <View style={[styles.sectionBand, { width: COLUMN_WIDTH * vehicles.length }]} />
                {section.fields.map(field => (
                  <ValueRow key={field.path} field={field} vehicles={vehicles} />
                ))}
              </Fragment>
            ))}
          </View>
        </ScrollView>
      </View>
    </Card>
  );
}

/** Uma linha de valores (um atributo), com o(s) vencedor(es) em destaque. */
function ValueRow({ field, vehicles }: { field: ComparisonField; vehicles: Vehicle[] }) {
  const winners = winnerIndexes(field);
  return (
    <View style={styles.row}>
      {field.values.map((value, index) => {
        const vehicle = vehicles[index];
        const isWinner = winners.includes(index);
        const text = formatCell(field, value);
        return (
          <View
            key={`${field.path}-${vehicle?.id ?? index}`}
            accessible
            accessibilityLabel={`${vehicle?.modelo ?? ''} ${vehicle?.versao ?? ''}, ${field.label}: ${text}${isWinner ? ', melhor valor' : ''}`}
            style={[styles.valueCell, isWinner && styles.winnerCell]}
          >
            {isWinner && <Ionicons name="trophy" size={12} color={toneColors.success.fg} />}
            <AppText
              variant={isWinner ? 'smallStrong' : 'small'}
              color={isWinner ? toneColors.success.fg : surface.textPrimary}
              numberOfLines={2}
              align="center"
            >
              {text}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

function VehicleHeader({ vehicle }: { vehicle: Vehicle }) {
  const isFord = isFordVehicle(vehicle);
  return (
    <View style={[styles.headerCell, styles.vehicleHeader, isFord && styles.fordHeader]}>
      <AppText variant="overline" color={isFord ? colors.fordBlue : surface.textMuted} numberOfLines={1}>
        {vehicle.marca}
      </AppText>
      <AppText variant="smallStrong" numberOfLines={1}>{vehicle.modelo}</AppText>
      <AppText variant="caption" color={surface.textSecondary} numberOfLines={2}>{vehicle.versao}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  attributeColumn: {
    width: ATTRIBUTE_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: surface.border,
    backgroundColor: surface.card,
  },
  headerCell: {
    height: HEADER_HEIGHT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: surface.border,
  },
  attributeHeader: { justifyContent: 'flex-end' },
  vehicleHeader: {
    width: COLUMN_WIDTH,
    justifyContent: 'flex-end',
    gap: 1,
    borderTopWidth: 3,
    borderTopColor: 'transparent',
  },
  fordHeader: { borderTopColor: colors.fordBlue },
  sectionCell: {
    height: SECTION_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: surface.background,
  },
  sectionBand: { height: SECTION_HEIGHT, backgroundColor: surface.background },
  attributeCell: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: surface.divider,
  },
  valueCell: {
    width: COLUMN_WIDTH,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: surface.divider,
  },
  winnerCell: { backgroundColor: toneColors.success.bg },
});
