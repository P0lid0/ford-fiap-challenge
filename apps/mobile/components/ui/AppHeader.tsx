import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppConfig } from '../../lib/config';
import { colors, MIN_TOUCH_SIZE, spacing, surface } from '../../lib/theme';
import { AppText } from './AppText';
import { FaroLogo } from './FaroLogo';
import { Tag } from './Tag';

export type AppHeaderProps = {
  /**
   * `tab`   → telas das abas: fundo branco, marca Faro AI no topo.
   * `stack` → telas internas: fundo azul Ford, botão de voltar/fechar.
   */
  variant?: 'tab' | 'stack';
  title: string;
  /** Linha abaixo do título. */
  subtitle?: string;
  /** Linha pequena acima do título (só `stack`, ex.: "Cliente"). */
  eyebrow?: string;
  /** Elemento à direita do título (botão de sair, selo de perfil…). */
  right?: ReactNode;
  /** Ícone de navegação do `stack`: voltar (padrão) ou fechar (formulários). */
  navIcon?: 'back' | 'close';
};

const isDemoMode = AppConfig.dataMode === 'local';

/** Cabeçalho único do app — desenha também atrás da status bar (área segura). */
export function AppHeader(props: AppHeaderProps) {
  return props.variant === 'stack' ? <StackHeader {...props} /> : <TabHeader {...props} />;
}

function TabHeader({ title, subtitle, right }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabHeader, { paddingTop: insets.top + spacing.md }]}>
      <StatusBar style="dark" />
      <View style={styles.brandRow}>
        <FaroLogo size={22} withWordmark />
        {isDemoMode && <Tag label="Demonstração" tone="default" icon="flask-outline" />}
      </View>
      <View style={styles.titleRow}>
        <View style={styles.texts}>
          <AppText variant="h1" accessibilityRole="header" numberOfLines={1}>{title}</AppText>
          {subtitle && <AppText variant="small" color={surface.textSecondary}>{subtitle}</AppText>}
        </View>
        {right}
      </View>
    </View>
  );
}

function StackHeader({ title, subtitle, eyebrow, right, navIcon = 'back' }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  return (
    <View style={[styles.stackHeader, { paddingTop: insets.top + spacing.xs }]}>
      <StatusBar style="light" />
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={navIcon === 'close' ? 'Fechar' : 'Voltar'}
        style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
      >
        <Ionicons name={navIcon === 'close' ? 'close' : 'chevron-back'} size={26} color={colors.white} />
      </Pressable>
      <View style={styles.texts}>
        {eyebrow && <AppText variant="overline" color="rgba(255,255,255,0.75)">{eyebrow}</AppText>}
        <AppText variant="h2" color={colors.white} numberOfLines={1} accessibilityRole="header">{title}</AppText>
        {subtitle && <AppText variant="small" color="rgba(255,255,255,0.85)" numberOfLines={1}>{subtitle}</AppText>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  tabHeader: {
    backgroundColor: surface.card,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: surface.border,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texts: { flex: 1, gap: 2 },
  stackHeader: {
    backgroundColor: colors.fordBlue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.lg,
    paddingBottom: spacing.md,
  },
  navButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MIN_TOUCH_SIZE / 2,
  },
  pressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
});
