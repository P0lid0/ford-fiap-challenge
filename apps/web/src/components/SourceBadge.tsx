import { CheckCircle, AlertTriangle, Globe, Cpu } from 'lucide-react';

/**
 * Mostra a fonte de um campo de spec — auditabilidade explícita.
 * - 🟢 FIPE: preço oficial Brasil
 * - 🟢 manufacturer:host: HTML real do site oficial (extraído por IA)
 * - 🔵 nhtsa: catálogo USA-DOT
 * - ⚠ ai: inferido pelo gpt-4o-mini SEM fonte verificável
 */
export function SourceBadge({ source }: { source: string | undefined }) {
  if (!source) return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">—</span>;

  if (source === 'fipe') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-success" title="Fonte: tabela FIPE oficial (parallelum.com.br)">
        <CheckCircle className="w-3 h-3" /> FIPE
      </span>
    );
  }
  if (source.startsWith('manufacturer:')) {
    const host = source.slice('manufacturer:'.length);
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-success" title={`Fonte: site oficial ${host} (extraído via IA do HTML real)`}>
        <Globe className="w-3 h-3" /> {host.replace('www.', '')}
      </span>
    );
  }
  if (source.startsWith('nhtsa')) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-blue-700" title="Fonte: NHTSA vPIC (catálogo oficial USA)">
        <Cpu className="w-3 h-3" /> NHTSA
      </span>
    );
  }
  if (source.startsWith('ai:')) {
    const model = source.slice('ai:'.length);
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-warning" title={`⚠ Estimado por IA (${model}) — verifique com a fabricante`}>
        <AlertTriangle className="w-3 h-3" /> IA estimou
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500">{source}</span>;
}

export function ConfianceBadge({ confianca }: { confianca: 'alta' | 'media' | 'baixa' }) {
  const map = {
    alta:  { c: 'bg-emerald-50 text-emerald-700 border-emerald-300', t: 'CONFIANÇA ALTA · 2+ fontes confirmadas' },
    media: { c: 'bg-amber-50 text-amber-800 border-amber-300', t: 'CONFIANÇA MÉDIA · 1 fonte oficial' },
    baixa: { c: 'bg-red-50 text-red-700 border-red-300', t: 'CONFIANÇA BAIXA · só estimativa de IA' },
  };
  const s = map[confianca] ?? map.baixa;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] uppercase tracking-wider font-bold ${s.c}`}>
      {s.t}
    </span>
  );
}
