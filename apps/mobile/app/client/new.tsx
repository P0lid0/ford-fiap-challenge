import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppText, Banner, Button, ChipGroup, FieldLabel, FormSection, Screen, SwitchField, TextField,
  type ChipOption,
} from '../../components/ui';
import {
  initialClientForm, isFormDirty, maskBrDate, toNewClientInput,
  type ClientFormErrors, type ClientFormValues,
} from '../../lib/clientForm';
import { confirmAction } from '../../lib/confirm';
import { dataSource, DataSourceError } from '../../lib/data';
import {
  canalLabel, estadoCivilLabel, financiamentoLabel, generoLabel, modelLabel, regiaoLabel,
} from '../../lib/format';
import { spacing, surface } from '../../lib/theme';
import {
  CANAIS_AQUISICAO, ESTADOS_CIVIS, FINANCIAMENTOS, FORD_MODELS, GENEROS, REGIOES,
} from '../../lib/types';

function options<T extends string>(values: readonly T[], labels: Record<T, string>): ChipOption<T>[] {
  return values.map(value => ({ value, label: labels[value] }));
}

const CURRENT_YEAR = new Date().getFullYear();
const MODEL_OPTIONS: ChipOption<(typeof FORD_MODELS)[number]>[] = FORD_MODELS.map(m => ({ value: m, label: modelLabel(m) }));
const YEAR_OPTIONS: ChipOption<number>[] = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]
  .map(year => ({ value: year, label: String(year) }));

export default function NewClientScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [values, setValues] = useState<ClientFormValues>(initialClientForm);
  const [errors, setErrors] = useState<ClientFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const allowLeave = useRef(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Confirma antes de sair com dados preenchidos (botão fechar, voltar do Android ou gesto).
  useEffect(() => navigation.addListener('beforeRemove', event => {
    if (allowLeave.current || !isFormDirty(valuesRef.current)) return;
    event.preventDefault();
    confirmAction({
      title: 'Descartar cadastro?',
      message: 'Os dados preenchidos serão perdidos.',
      confirmLabel: 'Descartar',
      destructive: true,
      onConfirm: () => {
        allowLeave.current = true;
        navigation.dispatch(event.data.action);
      },
    });
  }), [navigation]);

  function set<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues(current => ({ ...current, [key]: value }));
    if (errors[key]) setErrors(current => ({ ...current, [key]: undefined }));
  }

  async function submit() {
    setSubmitError(null);
    const result = toNewClientInput(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    try {
      const created = await dataSource.createClient(result.input);
      allowLeave.current = true;
      router.replace(`/client/${created.client.id}`);
    } catch (err) {
      setSubmitError(DataSourceError.from(err).message);
      setSaving(false);
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;
  const isCash = values.financiamento === 'a_vista';

  return (
    <Screen
      variant="stack"
      navIcon="close"
      eyebrow="Nova venda"
      title="Cadastrar venda"
      footer={
        <View style={styles.footer}>
          {errorCount > 0 && (
            <Banner tone="danger" icon="alert-circle-outline"
              message={`Revise ${errorCount} ${errorCount === 1 ? 'campo destacado' : 'campos destacados'} em vermelho.`} />
          )}
          {submitError && <Banner tone="danger" icon="cloud-offline-outline" title="Não foi possível cadastrar" message={submitError} />}
          <Button title="Cadastrar e classificar" icon="checkmark-circle-outline" fullWidth loading={saving} onPress={submit} />
        </View>
      }
    >
      <AppText variant="small" color={surface.textSecondary}>
        Só dados de antes da compra. Ao salvar, o modelo classifica o perfil e o risco de evasão.
      </AppText>

      <FormSection title="Cliente" icon="person-outline">
        <TextField label="Nome (opcional)" value={values.nome} onChangeText={v => set('nome', v)} error={errors.nome}
          placeholder="Ex.: Maria Silva" autoCapitalize="words" />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Idade" value={values.idade} onChangeText={v => set('idade', v.replace(/\D/g, ''))}
              error={errors.idade} keyboardType="number-pad" placeholder="35" maxLength={2} />
          </View>
          <View style={styles.flex}>
            <TextField label="Renda mensal (R$)" value={values.renda} onChangeText={v => set('renda', v.replace(/\D/g, ''))}
              error={errors.renda} keyboardType="number-pad" placeholder="12000" />
          </View>
        </View>
        <FieldLabel label="Gênero" />
        <ChipGroup accessibilityLabel="Gênero" options={options(GENEROS, generoLabel)} value={values.genero} onChange={v => set('genero', v)} />
        <FieldLabel label="Estado civil" />
        <ChipGroup accessibilityLabel="Estado civil" options={options(ESTADOS_CIVIS, estadoCivilLabel)} value={values.estadoCivil} onChange={v => set('estadoCivil', v)} />
        <FieldLabel label="Região" />
        <ChipGroup accessibilityLabel="Região" options={options(REGIOES, regiaoLabel)} value={values.regiao} onChange={v => set('regiao', v)} />
      </FormSection>

      <FormSection title="Veículo" icon="car-sport-outline">
        <FieldLabel label="Modelo Ford" />
        <ChipGroup accessibilityLabel="Modelo Ford" scrollable options={MODEL_OPTIONS} value={values.modelo} onChange={v => set('modelo', v)} />
        <FieldLabel label="Ano do modelo" />
        <ChipGroup accessibilityLabel="Ano do modelo" options={YEAR_OPTIONS} value={values.ano} onChange={v => set('ano', v)} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Versão" value={values.versao} onChangeText={v => set('versao', v)} error={errors.versao}
              placeholder="XLT" autoCapitalize="characters" />
          </View>
          <View style={styles.flex}>
            <TextField label="Preço pago (R$)" value={values.preco} onChangeText={v => set('preco', v.replace(/\D/g, ''))}
              error={errors.preco} keyboardType="number-pad" placeholder="265000" />
          </View>
        </View>
      </FormSection>

      <FormSection title="Compra" icon="receipt-outline">
        <TextField label="Data da venda" value={values.dataVenda} onChangeText={v => set('dataVenda', maskBrDate(v))}
          error={errors.dataVenda} keyboardType="number-pad" placeholder="DD/MM/AAAA" maxLength={10} />
        <FieldLabel label="Pagamento" />
        <ChipGroup accessibilityLabel="Pagamento" options={options(FINANCIAMENTOS, financiamentoLabel)} value={values.financiamento} onChange={v => set('financiamento', v)} />
        {!isCash && (
          <TextField label="Parcelas" value={values.parcelas} onChangeText={v => set('parcelas', v.replace(/\D/g, ''))}
            error={errors.parcelas} keyboardType="number-pad" placeholder="48" maxLength={2} />
        )}
        <FieldLabel label="Canal de venda" />
        <ChipGroup accessibilityLabel="Canal de venda" options={options(CANAIS_AQUISICAO, canalLabel)} value={values.canal} onChange={v => set('canal', v)} />
        <TextField label="Score de crédito" value={values.score} onChangeText={v => set('score', v.replace(/\D/g, ''))}
          error={errors.score} hint="De 0 a 1000" keyboardType="number-pad" placeholder="720" maxLength={4} />
        <SwitchField label="Primeiro carro" value={values.primeiroCarro} onChange={v => set('primeiroCarro', v)} />
        <SwitchField label="Fez test drive" value={values.testDrive} onChange={v => set('testDrive', v)} />
      </FormSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  footer: { gap: spacing.sm },
});
