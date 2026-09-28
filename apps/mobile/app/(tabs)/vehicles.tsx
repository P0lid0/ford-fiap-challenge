import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { isFordVehicle, VehicleCard } from '../../components/VehicleCard';
import {
  AppText, Banner, Button, ChipGroup, EmptyState, ErrorState, LoadingState, Screen, TextField,
  type ChipOption,
} from '../../components/ui';
import { dataSource } from '../../lib/data';
import { useAsync } from '../../lib/hooks/useAsync';
import { colors, spacing, surface } from '../../lib/theme';
import type { Vehicle } from '../../lib/types';

const MIN_SELECTION = 2;
const MAX_SELECTION = 5;

type BrandFilter = 'all' | 'ford' | 'rivals';

const BRAND_FILTERS: ReadonlyArray<ChipOption<BrandFilter>> = [
  { value: 'all', label: 'Todos' },
  { value: 'ford', label: 'Ford' },
  { value: 'rivals', label: 'Concorrentes' },
];

/** Minúsculas e sem acentos — "Frontier" casa com "frontíer", "S10" com "s10". */
function normalize(text: string): string {
  let value = text;
  try {
    value = value.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    // Motor JS sem suporte a normalize: segue sem remover acentos.
  }
  return value.toLowerCase().trim();
}

/** Ford primeiro, depois as demais marcas em ordem alfabética. */
function sortFordFirst(vehicles: Vehicle[]): Vehicle[] {
  return [...vehicles].sort((a, b) => {
    const fordOrder = Number(isFordVehicle(b)) - Number(isFordVehicle(a));
    if (fordOrder !== 0) return fordOrder;
    return `${a.marca} ${a.modelo} ${a.versao}`.localeCompare(`${b.marca} ${b.modelo} ${b.versao}`, 'pt-BR');
  });
}

function filterVehicles(vehicles: Vehicle[], query: string, brand: BrandFilter): Vehicle[] {
  const search = normalize(query);
  return vehicles.filter(vehicle => {
    const isFord = isFordVehicle(vehicle);
    if (brand === 'ford' && !isFord) return false;
    if (brand === 'rivals' && isFord) return false;
    return !search || normalize(`${vehicle.marca} ${vehicle.modelo} ${vehicle.versao}`).includes(search);
  });
}

export default function ConcorrenciaScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data, error, isLoading, isRefreshing, reload, refresh } = useAsync(() => dataSource.listVehicles(), []);

  const vehicles = useMemo(() => sortFordFirst(data ?? []), [data]);
  const visibleVehicles = useMemo(
    () => filterVehicles(vehicles, query, brandFilter),
    [vehicles, query, brandFilter],
  );
  const selectedCount = selectedIds.length;
  const isLimitReached = selectedCount >= MAX_SELECTION;

  function toggleVehicle(vehicleId: string) {
    setSelectedIds(current => {
      if (current.includes(vehicleId)) return current.filter(id => id !== vehicleId);
      return current.length >= MAX_SELECTION ? current : [...current, vehicleId];
    });
  }

  function clearFilters() {
    setQuery('');
    setBrandFilter('all');
  }

  function openComparison() {
    router.push({ pathname: '/compare', params: { ids: selectedIds.join(',') } });
  }

  const footer = selectedCount > 0 ? (
    <View style={styles.footer}>
      <View style={styles.footerTexts}>
        <AppText variant="smallStrong">
          {`${selectedCount} ${selectedCount === 1 ? 'selecionado' : 'selecionados'}`}
        </AppText>
        {selectedCount < MIN_SELECTION ? (
          <AppText variant="caption" color={surface.textMuted}>Selecione mais 1 para comparar</AppText>
        ) : (
          <Pressable onPress={() => setSelectedIds([])} accessibilityRole="button" hitSlop={12}>
            <AppText variant="caption" color={colors.fordBlue}>Limpar seleção</AppText>
          </Pressable>
        )}
      </View>
      <Button
        title={`Comparar (${selectedCount})`}
        icon="git-compare-outline"
        disabled={selectedCount < MIN_SELECTION}
        onPress={openComparison}
      />
    </View>
  ) : undefined;

  return (
    <Screen
      title="Concorrência"
      subtitle={`Selecione de ${MIN_SELECTION} a ${MAX_SELECTION} veículos para comparar`}
      onRefresh={data ? refresh : undefined}
      refreshing={isRefreshing}
      footer={footer}
    >
      {isLoading && !data ? (
        <LoadingState message="Carregando catálogo…" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <View style={styles.filters}>
            <TextField
              label="Buscar veículo"
              value={query}
              onChangeText={setQuery}
              placeholder="Marca, modelo ou versão"
              leftIcon="search-outline"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              rightAction={query ? { icon: 'close-circle', onPress: () => setQuery(''), accessibilityLabel: 'Limpar busca' } : undefined}
            />
            <ChipGroup accessibilityLabel="Marca" options={BRAND_FILTERS} value={brandFilter} onChange={setBrandFilter} />
          </View>

          {isLimitReached && (
            <Banner
              tone="warning"
              icon="alert-circle-outline"
              message={`Máximo de ${MAX_SELECTION} veículos. Desmarque um para escolher outro.`}
            />
          )}

          {visibleVehicles.length === 0 ? (
            <EmptyState
              icon="car-outline"
              title="Nenhum veículo encontrado"
              message="Revise a busca ou o filtro de marca."
              action={<Button title="Limpar busca" variant="secondary" icon="refresh" onPress={clearFilters} />}
            />
          ) : (
            <>
              <AppText variant="small" color={surface.textSecondary}>
                {`${visibleVehicles.length} de ${vehicles.length} veículos`}
              </AppText>
              <View style={styles.list}>
                {visibleVehicles.map(vehicle => {
                  const isSelected = selectedIds.includes(vehicle.id);
                  return (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      selected={isSelected}
                      disabled={isLimitReached && !isSelected}
                      onToggle={() => toggleVehicle(vehicle.id)}
                    />
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.md },
  list: { gap: spacing.md },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footerTexts: { flex: 1, gap: 2 },
});
