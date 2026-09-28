import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { DataSourceError, DataSourceErrorCode } from '../../lib/data';
import { colors, spacing, surface, toneColors } from '../../lib/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import type { IconName } from './types';

// ─── Carregando ──────────────────────────────────────────────

export function LoadingState({ message = 'Carregando…' }: { message?: string }) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite" accessibilityLabel={message}>
      <ActivityIndicator color={colors.fordBlue} size="large" />
      <AppText variant="small" color={surface.textSecondary}>{message}</AppText>
    </View>
  );
}

// ─── Vazio ───────────────────────────────────────────────────

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message?: string;
  /** Ação opcional (ex.: <Button title="Cadastrar cliente" … />). */
  action?: ReactNode;
  iconColor?: string;
  iconBackground?: string;
};

export function EmptyState({
  icon,
  title,
  message,
  action,
  iconColor = surface.textMuted,
  iconBackground = surface.divider,
}: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={[styles.iconCircle, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={28} color={iconColor} />
      </View>
      <AppText variant="bodyStrong" align="center">{title}</AppText>
      {message && (
        <AppText variant="small" color={surface.textSecondary} align="center" style={styles.message}>
          {message}
        </AppText>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

// ─── Erro ────────────────────────────────────────────────────

const ERROR_PRESENTATION: Record<DataSourceErrorCode, { icon: IconName; title: string }> = {
  network: { icon: 'cloud-offline-outline', title: 'Sem conexão' },
  timeout: { icon: 'time-outline', title: 'Tempo esgotado' },
  unauthorized: { icon: 'lock-closed-outline', title: 'Sessão expirada' },
  forbidden: { icon: 'hand-left-outline', title: 'Acesso negado' },
  not_found: { icon: 'search-outline', title: 'Não encontrado' },
  validation: { icon: 'alert-circle-outline', title: 'Dados inválidos' },
  server: { icon: 'server-outline', title: 'Erro no servidor' },
  unknown: { icon: 'alert-circle-outline', title: 'Algo deu errado' },
};

type ErrorStateProps = {
  error: DataSourceError;
  /** Mostra o botão "Tentar novamente" (omitido em sessão expirada — o app volta ao login). */
  onRetry?: () => void;
};

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { icon, title } = ERROR_PRESENTATION[error.code] ?? ERROR_PRESENTATION.unknown;
  const canRetry = onRetry && error.code !== 'unauthorized';
  return (
    <EmptyState
      icon={icon}
      title={title}
      message={error.message}
      iconColor={toneColors.danger.fg}
      iconBackground={toneColors.danger.bg}
      action={canRetry ? <Button title="Tentar novamente" icon="refresh" variant="secondary" onPress={onRetry} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  message: { maxWidth: 320 },
  action: { marginTop: spacing.md },
});
