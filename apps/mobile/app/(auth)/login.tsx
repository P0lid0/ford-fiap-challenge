import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, FaroLogo, TextField } from '../../components/ui';
import { useAuth } from '../../lib/auth/AuthProvider';
import { DataSourceError, DEMO_CREDENTIALS } from '../../lib/data';
import { colors, radius, spacing } from '../../lib/theme';

type FieldErrors = { email?: string; password?: string };
type SubmitSource = 'form' | 'demo';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function LoginScreen() {
  const { signIn, mode } = useAuth();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);
  const isMounted = useRef(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<SubmitSource | null>(null);

  const isDemoMode = mode === 'local';

  useEffect(() => () => { isMounted.current = false; }, []);

  async function authenticate(emailValue: string, passwordValue: string, source: SubmitSource) {
    setFormError(null);
    setSubmitting(source);
    try {
      await signIn(emailValue, passwordValue);
      // Sucesso: o layout raiz detecta a sessão e navega para as abas.
    } catch (error) {
      if (isMounted.current) setFormError(DataSourceError.from(error).message);
    } finally {
      if (isMounted.current) setSubmitting(null);
    }
  }

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Informe um e-mail válido.';
    if (!password) errors.password = 'Informe a senha.';
    setFieldErrors(errors);
    return !errors.email && !errors.password;
  }

  function handleSubmit() {
    if (validate()) void authenticate(email, password, 'form');
  }

  function handleDemoLogin() {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setFieldErrors({});
    void authenticate(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password, 'demo');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + spacing['2xl'], paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <FaroLogo size={56} variant="inverse" withWordmark />
            <AppText variant="overline" color="rgba(255,255,255,0.6)" align="center">
              Ford × FIAP · Challenge 2026
            </AppText>
          </View>

          <View style={styles.form}>
            <View style={styles.heading}>
              <AppText variant="overline" color="rgba(255,255,255,0.55)">Entrar</AppText>
              <AppText variant="h1" color={colors.white} accessibilityRole="header">Bem-vindo de volta.</AppText>
              <AppText variant="small" color="rgba(255,255,255,0.7)">
                Acesso ao painel de retenção e inteligência competitiva.
              </AppText>
            </View>

            {formError && (
              <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Ionicons name="alert-circle" size={20} color="#FCA5A5" />
                <AppText variant="small" color="#FCA5A5" style={styles.flex}>{formError}</AppText>
              </View>
            )}

            <TextField
              appearance="dark"
              label="E-mail"
              value={email}
              onChangeText={value => {
                setEmail(value);
                if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
              }}
              error={fieldErrors.email}
              placeholder="voce@concessionaria.com.br"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={submitting === null}
            />
            <TextField
              ref={passwordRef}
              appearance="dark"
              label="Senha"
              value={password}
              onChangeText={value => {
                setPassword(value);
                if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
              }}
              error={fieldErrors.password}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              editable={submitting === null}
              rightAction={{
                icon: showPassword ? 'eye-off-outline' : 'eye-outline',
                onPress: () => setShowPassword(visible => !visible),
                accessibilityLabel: showPassword ? 'Ocultar senha' : 'Mostrar senha',
              }}
            />

            <Button
              title="Entrar"
              icon="arrow-forward"
              variant="inverse"
              fullWidth
              loading={submitting === 'form'}
              disabled={submitting !== null}
              onPress={handleSubmit}
            />

            {isDemoMode && (
              <View style={styles.demo}>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <AppText variant="caption" color="rgba(255,255,255,0.5)">ou</AppText>
                  <View style={styles.dividerLine} />
                </View>
                <Button
                  title="Entrar com conta demonstração"
                  icon="flask-outline"
                  variant="inverseOutline"
                  fullWidth
                  loading={submitting === 'demo'}
                  disabled={submitting !== null}
                  onPress={handleDemoLogin}
                />
                <AppText variant="caption" color="rgba(255,255,255,0.55)" align="center">
                  {`Dados de exemplo, sem internet · ${DEMO_CREDENTIALS.email} · ${DEMO_CREDENTIALS.password}`}
                </AppText>
              </View>
            )}
          </View>

          <AppText variant="caption" color="rgba(255,255,255,0.45)" align="center">
            {`© 2026 · Equipe Faro AI · v${APP_VERSION}`}
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.fordBlueDark },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    gap: spacing['2xl'],
  },
  brand: { alignItems: 'center', gap: spacing.md },
  form: { gap: spacing.lg },
  heading: { gap: spacing.xs, marginBottom: spacing.xs },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  demo: { gap: spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.2)' },
});
