import { CheckCircle, AlertTriangle, Globe, Cpu, FileText, Sparkles, FileCheck } from 'lucide-react';

/**
 * Mostra a fonte de um campo de spec — auditabilidade explícita.
 *
 * Hierarquia de confiança (mais alta no topo):
 *  - 🟢 manufacturer_ebook  → PDF oficial da fabricante (mais completo)
 *  - 🟢 manufacturer:host   → HTML do site oficial (extraído por IA do texto real)
 *  - 🟢 fipe                → tabela oficial BR
 *  - 🔵 vehicle411          → catálogo automotivo US
 *  - 🔵 nhtsa               → catálogo DOT-USA
 *  - 🟠 ai:model (web)      → estimado pela IA com web search high
 *  - 🔴 ai:model            → estimado pela IA sem fonte (raro)
 *  - 🟣 manual              → preenchido a mão (verificado por humano)
 */
export function SourceBadge({ source }: { source: string | undefined }) {
  if (!source) {
    return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">—</span>;
  }

  if (source === 'fipe') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700" title="Fonte: tabela FIPE oficial (parallelum.com.br)">
        <CheckCircle className="w-3 h-3" /> FIPE
      </span>
    );
  }

  if (source === 'manual') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-purple-700" title="Verificado manualmente por humano">
        <FileCheck className="w-3 h-3" /> MANUAL
      </span>
    );
  }

  if (source.startsWith('manufacturer_ebook:')) {
    const host = source.slice('manufacturer_ebook:'.length);
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700 font-bold" title={`Fonte: E-book oficial ${host} — alta confiança`}>
        <FileText className="w-3 h-3" /> {host.replace('www.', '')} (e-book)
      </span>
    );
  }

  if (source.startsWith('manufacturer:')) {
    const host = source.slice('manufacturer:'.length);
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700" title={`Fonte: site oficial ${host} (HTML real)`}>
        <Globe className="w-3 h-3" /> {host.replace('www.', '')}
      </span>
    );
  }

  if (source === 'vehicle411' || source.startsWith('vehicle411:')) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-blue-700" title="Fonte: 411 Vehicle Data (autoapi411.com)">
        <Cpu className="w-3 h-3" /> 411 DATA
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
    // Visual mais agressivo pra deixar CLARO que é estimativa não verificada.
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-900 border border-amber-400 animate-[pulse_3s_ease-in-out_infinite]"
        title={`⚠ ESTIMADO POR IA (${model}) — verifique com a fabricante antes de usar como informação oficial`}
      >
        <Sparkles className="w-3 h-3" /> IA ESTIMOU
      </span>
    );
  }

  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500">{source}</span>;
}

export function ConfianceBadge({ confianca }: { confianca: 'alta' | 'media' | 'baixa' }) {
  const map = {
    alta:  { c: 'bg-emerald-50 text-emerald-700 border-emerald-300', t: 'CONFIANÇA ALTA · 2+ fontes confirmadas' },
    media: { c: 'bg-amber-50 text-amber-800 border-amber-300', t: 'CONFIANÇA MÉDIA · 1 fonte oficial' },
    baixa: { c: 'bg-red-50 text-red-700 border-red-300', t: 'CONFIANÇA BAIXA · só estimativa de IA — verificar' },
  };
  const s = map[confianca] ?? map.baixa;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] uppercase tracking-wider font-bold ${s.c}`}>
      {s.t}
    </span>
  );
}

/**
 * Banner explicativo opcional pra mostrar abaixo de qualquer card que tenha
 * mistura de fontes — explicita ao usuário o que cada cor significa.
 */
export function SourceLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-[10px] text-gray-600">
      <span className="inline-flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-700" /> fonte oficial verificada</span>
      <span className="inline-flex items-center gap-1"><Cpu className="w-3 h-3 text-blue-700" /> catálogo público</span>
      <span className="inline-flex items-center gap-1 px-1 bg-amber-100 text-amber-900 border border-amber-400 rounded"><Sparkles className="w-3 h-3" /> IA estimou — verifique</span>
      <span className="inline-flex items-center gap-1"><FileCheck className="w-3 h-3 text-purple-700" /> verificado manualmente</span>
    </div>
  );
}
