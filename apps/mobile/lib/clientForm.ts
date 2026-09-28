/**
 * Regras do formulário "Cadastrar venda": estado inicial, validação (mesmos
 * limites de POST /clients na API) e conversão para NewClientInput.
 * Sem React — fácil de testar.
 */
import { formatDate, todayIso } from './format';
import type {
  CanalAquisicao, EstadoCivil, Financiamento, FordModel, Genero, NewClientInput, Regiao,
} from './types';

export type ClientFormValues = {
  nome: string;
  idade: string;
  genero: Genero;
  estadoCivil: EstadoCivil;
  regiao: Regiao;
  renda: string;
  modelo: FordModel;
  versao: string;
  ano: number;
  preco: string;
  dataVenda: string;          // DD/MM/AAAA
  financiamento: Financiamento;
  parcelas: string;
  canal: CanalAquisicao;
  score: string;
  primeiroCarro: boolean;
  testDrive: boolean;
};

export type ClientFormErrors = Partial<Record<keyof ClientFormValues, string>>;

export function initialClientForm(): ClientFormValues {
  return {
    nome: '',
    idade: '',
    genero: 'M',
    estadoCivil: 'casado',
    regiao: 'sudeste',
    renda: '',
    modelo: 'RANGER',
    versao: '',
    ano: new Date().getFullYear(),
    preco: '',
    dataVenda: formatDate(todayIso()),
    financiamento: 'financiado',
    parcelas: '48',
    canal: 'concessionaria',
    score: '',
    primeiroCarro: false,
    testDrive: true,
  };
}

/** Só dígitos → inteiro (aceita "265.000" ou "265000"). */
export function parseInteger(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

/** "25/01/2023" → "2023-01-25" (null se inválida). */
export function parseBrDate(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const isReal = date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
  return isReal ? `${year}-${month}-${day}` : null;
}

/** Máscara de data enquanto digita: "25012023" → "25/01/2023". */
export function maskBrDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

export function isFormDirty(values: ClientFormValues): boolean {
  const initial = initialClientForm();
  return (Object.keys(initial) as Array<keyof ClientFormValues>).some(key => values[key] !== initial[key]);
}

/** Valida e converte. Retorna os erros por campo ou o corpo pronto para a API. */
export function toNewClientInput(values: ClientFormValues):
  { ok: true; input: NewClientInput } | { ok: false; errors: ClientFormErrors } {
  const errors: ClientFormErrors = {};
  const idade = parseInteger(values.idade);
  const renda = parseInteger(values.renda);
  const preco = parseInteger(values.preco);
  const score = parseInteger(values.score);
  const parcelas = values.financiamento === 'a_vista' ? 0 : parseInteger(values.parcelas);
  const salesDate = parseBrDate(values.dataVenda);

  if (values.nome.trim().length > 120) errors.nome = 'Use até 120 caracteres.';
  if (idade === null || idade < 18 || idade > 95) errors.idade = 'Informe uma idade entre 18 e 95.';
  if (renda === null) errors.renda = 'Informe a renda mensal.';
  if (!values.versao.trim()) errors.versao = 'Informe a versão (ex.: XLT).';
  else if (values.versao.trim().length > 60) errors.versao = 'Use até 60 caracteres.';
  if (preco === null || preco <= 0) errors.preco = 'Informe o preço pago.';
  if (!salesDate) errors.dataVenda = 'Use o formato DD/MM/AAAA.';
  else if (salesDate > todayIso()) errors.dataVenda = 'A data da venda não pode ser futura.';
  if (parcelas === null || parcelas < 1 || parcelas > 84) {
    if (values.financiamento !== 'a_vista') errors.parcelas = 'Entre 1 e 84 parcelas.';
  }
  if (score === null || score > 1000) errors.score = 'Informe um score entre 0 e 1000.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    input: {
      nome_cliente: values.nome.trim() || undefined,
      model_name: values.modelo,
      model_year: values.ano,
      sales_date: salesDate!,
      versao_comprada: values.versao.trim(),
      preco_pago_brl: preco!,
      idade: idade!,
      genero: values.genero,
      regiao: values.regiao,
      renda_mensal_brl: renda!,
      estado_civil: values.estadoCivil,
      score_credito: score!,
      financiamento: values.financiamento,
      parcelas: parcelas ?? 0,
      canal_aquisicao: values.canal,
      primeiro_carro: values.primeiroCarro,
      test_drive_realizado: values.testDrive,
    },
  };
}
