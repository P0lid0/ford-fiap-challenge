// Cadastro de cliente (Base 2 — só dados pré-compra).
// Após criar, navega direto pro detalhe com a predição.
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { colors, radius, spacing, typography } from '../../lib/theme';

const REGIOES = ['sul', 'sudeste', 'centro_oeste', 'nordeste', 'norte'];
const FINANC = ['a_vista', 'financiado', 'leasing', 'consorcio'];
const CANAIS = ['concessionaria', 'online', 'frota', 'indicacao'];

export default function NewClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    idade: 35, genero: 'M', regiao: 'sudeste', renda_mensal_brl: 8500,
    estado_civil: 'solteiro', score_credito: 680,
    modelo_comprado: 'Ranger', versao_comprada: 'XLT', preco_pago_brl: 230000,
    financiamento: 'financiado', parcelas: 60,
    canal_aquisicao: 'concessionaria', primeiro_carro: false,
    test_drive_realizado: true, nome_cliente: '',
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm({ ...form, [k]: v });
  }

  async function submit() {
    setLoading(true);
    try {
      const r = await api.createClient(form);
      router.replace(`/client/${r.client.id}`);
    } catch (e: any) {
      Alert.alert('Erro', String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Cadastrar venda</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Section title="Cliente">
          <Field label="Nome (opcional)" value={form.nome_cliente} onChange={v => set('nome_cliente', v)} />
          <Row>
            <Field label="Idade" value={String(form.idade)} keyboardType="numeric" onChange={v => set('idade', Number(v))} />
            <Field label="Score crédito" value={String(form.score_credito)} keyboardType="numeric" onChange={v => set('score_credito', Number(v))} />
          </Row>
          <Row>
            <Picker label="Gênero" value={form.genero} options={['M', 'F', 'outro']} onChange={v => set('genero', v)} />
            <Picker label="Estado civil" value={form.estado_civil} options={['solteiro', 'casado', 'divorciado', 'viuvo']} onChange={v => set('estado_civil', v)} />
          </Row>
          <Picker label="Região" value={form.regiao} options={REGIOES} onChange={v => set('regiao', v)} />
          <Field label="Renda mensal (BRL)" value={String(form.renda_mensal_brl)} keyboardType="numeric" onChange={v => set('renda_mensal_brl', Number(v))} />
        </Section>

        <Section title="Veículo">
          <Row>
            <Field label="Modelo" value={form.modelo_comprado} onChange={v => set('modelo_comprado', v)} />
            <Field label="Versão" value={form.versao_comprada} onChange={v => set('versao_comprada', v)} />
          </Row>
          <Field label="Preço pago (BRL)" value={String(form.preco_pago_brl)} keyboardType="numeric" onChange={v => set('preco_pago_brl', Number(v))} />
        </Section>

        <Section title="Aquisição">
          <Picker label="Financiamento" value={form.financiamento} options={FINANC} onChange={v => set('financiamento', v)} />
          <Field label="Parcelas" value={String(form.parcelas)} keyboardType="numeric" onChange={v => set('parcelas', Number(v))} />
          <Picker label="Canal" value={form.canal_aquisicao} options={CANAIS} onChange={v => set('canal_aquisicao', v)} />
          <Row>
            <Toggle label="Primeiro carro" value={form.primeiro_carro} onChange={v => set('primeiro_carro', v)} />
            <Toggle label="Test drive" value={form.test_drive_realizado} onChange={v => set('test_drive_realizado', v)} />
          </Row>
        </Section>

        <Pressable
          style={[styles.cta, loading && { opacity: 0.5 }]}
          onPress={submit}
          disabled={loading}
        >
          <Text style={styles.ctaText}>
            {loading ? 'Classificando…' : 'Cadastrar e classificar'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Row({ children }: { children: any }) {
  return <View style={{ flexDirection: 'row', gap: spacing.md }}>{children}</View>;
}
function Field({ label, value, onChange, keyboardType }: any) {
  return (
    <View style={{ flex: 1, marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType={keyboardType ?? 'default'} placeholderTextColor={colors.gray400} />
    </View>
  );
}
function Picker({ label, value, options, onChange }: any) {
  return (
    <View style={{ flex: 1, marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map((o: string) => (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[styles.chip, value === o && styles.chipActive]}
          >
            <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{o}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
function Toggle({ label, value, onChange }: any) {
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flex: 1, marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <Text style={[styles.toggleText, value && styles.toggleTextOn]}>
          {value ? 'Sim' : 'Não'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50 },
  header: { backgroundColor: colors.fordBlue, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { color: colors.white, fontSize: typography.size.lg, fontWeight: '700' },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: typography.size.lg, fontWeight: '700', color: colors.fordBlue, marginBottom: spacing.md },
  label: { fontSize: typography.size.xs, textTransform: 'uppercase', color: colors.gray600, marginBottom: 6, letterSpacing: 0.5 },
  input: { backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray300, color: colors.text, fontSize: typography.size.base },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.gray300, marginRight: spacing.sm, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.fordBlue, borderColor: colors.fordBlue },
  chipText: { color: colors.gray800, fontSize: typography.size.sm },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  toggle: { paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray300, backgroundColor: colors.white },
  toggleOn: { backgroundColor: colors.fordBlue, borderColor: colors.fordBlue },
  toggleText: { color: colors.text, fontWeight: '600' },
  toggleTextOn: { color: colors.white },
  cta: { backgroundColor: colors.fordBlue, paddingVertical: spacing.lg, borderRadius: radius.xl, alignItems: 'center', marginTop: spacing.lg },
  ctaText: { color: colors.white, fontWeight: '700', fontSize: typography.size.base, letterSpacing: 0.5 },
});
