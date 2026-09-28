/**
 * Regras de apresentação do domínio de retenção, compartilhadas entre telas
 * (Carteira, Leads, Detalhe do cliente).
 */
import { formatCurrency, formatNumber, modelLabel } from './format';
import type { ClientSummary, Lead, PredictionSummary } from './types';

/** Predição mais recente (a API não garante a ordem do array embutido). */
export function latestPrediction<T extends PredictionSummary>(predictions: T[] | null | undefined): T | undefined {
  if (!predictions?.length) return undefined;
  return predictions.reduce((latest, current) => (current.created_at > latest.created_at ? current : latest));
}

/** Nome para exibição — registros reais da Ford podem não ter nome. */
export function clientDisplayName(client: { id: string; nome_cliente: string | null }): string {
  return client.nome_cliente?.trim() || `Cliente ${client.id.slice(0, 8)}`;
}

/** "Ranger XLT 2023" */
export function vehicleSummary(
  client: Pick<ClientSummary, 'model_name' | 'modelo_comprado' | 'versao_comprada' | 'model_year'>,
): string {
  const model = modelLabel(client.model_name ?? client.modelo_comprado);
  const version = client.versao_comprada && client.versao_comprada !== '—' ? client.versao_comprada : null;
  return [model, version, client.model_year].filter(Boolean).join(' ');
}

/** "Ranger XLT 2023 · R$ 248.000" */
export function clientSaleSummary(client: ClientSummary): string {
  const price = client.preco_pago_brl != null ? formatCurrency(client.preco_pago_brl) : null;
  return [vehicleSummary(client), price].filter(Boolean).join(' · ');
}

/** "Ranger 2021 · última revisão há 780 dias" */
export function leadDetails(lead: Lead): string {
  const vehicle = [modelLabel(lead.model_name), lead.model_year].filter(Boolean).join(' ');
  const revision = lead.dias_desde_ultima_revisao != null
    ? `última revisão há ${formatNumber(lead.dias_desde_ultima_revisao)} dias`
    : lead.num_revisoes === 0
      ? 'nenhuma revisão na rede'
      : null;
  return [vehicle, revision].filter(Boolean).join(' · ');
}
