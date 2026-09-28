import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  /** Botão de confirmação em vermelho (ações como sair ou descartar). */
  destructive?: boolean;
  onConfirm: () => void;
};

/** Diálogo de confirmação nativo (Android/iOS), com fallback para o navegador. */
export function confirmAction({ title, message, confirmLabel, destructive = false, onConfirm }: ConfirmOptions): void {
  if (Platform.OS === 'web') {
    // Alert.alert não tem implementação no react-native-web.
    const browser = globalThis as { confirm?: (text: string) => boolean };
    if (browser.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
