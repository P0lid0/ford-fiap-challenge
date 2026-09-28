import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows, spacing, surface } from '../../lib/theme';
import { AppHeader, type AppHeaderProps } from './AppHeader';

type ScreenProps = AppHeaderProps & {
  children: ReactNode;
  /** false = conteúdo sem rolagem (a tela controla, ex.: tabela horizontal). Padrão: true. */
  scroll?: boolean;
  /** Ativa o "puxar para atualizar". */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Área fixa no rodapé (botão principal da tela) — nunca cobre o conteúdo. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Estrutura padrão de toda tela: cabeçalho + conteúdo (com espaçamento único) + rodapé opcional.
 *
 * Telas de aba não somam a área segura inferior (a barra de abas já faz isso);
 * telas `stack` somam, para o conteúdo não ficar atrás da barra de gestos.
 */
export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  footer,
  contentStyle,
  ...headerProps
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = headerProps.variant === 'stack' ? insets.bottom : 0;

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[colors.fordBlue]}
      tintColor={colors.fordBlue}
    />
  ) : undefined;

  return (
    <View style={styles.root}>
      <AppHeader {...headerProps} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: (footer ? spacing.lg : spacing['2xl']) + (footer ? 0 : bottomInset) },
              contentStyle,
            ]}
            refreshControl={refreshControl}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>{children}</View>
        )}
        {footer && (
          <View style={[styles.footer, { paddingBottom: spacing.md + bottomInset }]}>{footer}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  footer: {
    backgroundColor: surface.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: surface.border,
    ...shadows.md,
  },
});
