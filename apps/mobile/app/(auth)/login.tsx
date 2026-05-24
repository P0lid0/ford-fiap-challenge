import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { colors, radius, spacing, typography } from '../../lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  async function submit() {
    setLoading(true);
    try {
      const fn = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error } = await fn({ email, password });
      if (error) Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.brand}>
            <Text style={styles.brandFord}>Ford</Text>
            <Text style={styles.brandSub}>FIAP · Faro AI</Text>
          </View>
          <Text style={styles.title}>{mode === 'signin' ? 'Entrar' : 'Criar conta'}</Text>
          <Text style={styles.subtitle}>Painel de retenção de clientes</Text>

          <View style={styles.field}>
            <Text style={styles.label}>E-mail corporativo</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="analista@ford.com.br"
              placeholderTextColor={colors.gray400}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }, loading && { opacity: 0.5 }]}
            onPress={submit}
            disabled={loading}
          >
            <Text style={styles.ctaText}>{loading ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Cadastrar'}</Text>
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Text style={styles.toggle}>
              {mode === 'signin' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta. Entrar'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.fordBlueDark },
  container: { flex: 1, padding: spacing['2xl'], justifyContent: 'center' },
  brand: { marginBottom: spacing['3xl'] },
  brandFord: { color: colors.white, fontSize: 48, fontWeight: '900', letterSpacing: 1 },
  brandSub: { color: colors.gray300, fontSize: typography.size.sm, letterSpacing: 2, marginTop: -4 },
  title: { color: colors.white, fontSize: typography.size['3xl'], fontWeight: '700', marginBottom: 4 },
  subtitle: { color: colors.gray300, fontSize: typography.size.base, marginBottom: spacing['2xl'] },
  field: { marginBottom: spacing.lg },
  label: { color: colors.gray300, fontSize: typography.size.xs, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    fontSize: typography.size.base,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cta: {
    backgroundColor: colors.white,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  ctaText: { color: colors.fordBlue, fontWeight: '700', fontSize: typography.size.base, letterSpacing: 0.5 },
  toggle: { color: colors.gray300, textAlign: 'center', marginTop: spacing.xl, fontSize: typography.size.sm },
});
