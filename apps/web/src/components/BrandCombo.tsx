'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Globe, Cpu } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Combobox de marcas com lista da FIPE (autoritativa).
 * Marcas com 🟢 globo = têm scraping de site oficial (alta confiança).
 */
export function BrandCombo({ value, onChange, placeholder = 'Selecione a marca…' }:
  { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [marcas, setMarcas] = useState<{ codigo: string; nome: string; tem_scraping: boolean }[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listMarcas().then(setMarcas).catch(console.error);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return marcas;
    return marcas.filter(m => m.nome.toLowerCase().includes(q));
  }, [query, marcas]);

  // Ordena: com scraping primeiro, depois alfabético
  const sorted = useMemo(() => [...visible].sort((a, b) => {
    if (a.tem_scraping !== b.tem_scraping) return a.tem_scraping ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  }), [visible]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-xl bg-white hover:border-gray-400 transition text-left">
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full max-h-80 overflow-y-auto bg-white rounded-xl border border-gray-300 shadow-lg">
          <input autoFocus placeholder="Buscar marca…" value={query} onChange={e => setQuery(e.target.value)}
            className="w-full px-4 py-2.5 border-b border-gray-200 focus:outline-none" />
          {sorted.length === 0 && <div className="px-4 py-3 text-sm text-gray-500">Nenhuma marca encontrada.</div>}
          {sorted.slice(0, 40).map(m => (
            <button key={m.codigo + m.nome} type="button"
              onClick={() => { onChange(m.nome); setOpen(false); setQuery(''); }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition text-left">
              {m.tem_scraping ? (
                <Globe className="w-3.5 h-3.5 text-success" title="Site oficial disponível" />
              ) : (
                <Cpu className="w-3.5 h-3.5 text-gray-400" title="Apenas FIPE + IA" />
              )}
              <span className="flex-1 text-sm">{m.nome}</span>
              {value === m.nome && <Check className="w-4 h-4 text-ford-blue" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
