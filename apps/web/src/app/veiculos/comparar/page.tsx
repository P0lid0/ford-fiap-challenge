'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { api } from '@/lib/api';

function ComparePage() {
  const search = useSearchParams();
  const ids = search.get('ids')?.split(',') ?? [];
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (ids.length < 2) return;
    api.compareVehicles(ids).then(setData).catch(console.error);
  }, [ids.length]);

  if (!data) return <Shell><div className="p-8 text-gray-500">Carregando…</div></Shell>;

  return (
    <Shell>
      <div className="p-8 max-w-full mx-auto">
        <Link href="/veiculos" className="inline-flex items-center gap-2 text-gray-600 hover:text-ford-blue mb-6 transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-3xl font-bold text-ford-blue mb-2">Comparativo competitivo</h1>
        <p className="text-gray-600 mb-8">{data.vehicles.length} veículos · {data.fields.length} atributos · vencedor em verde</p>

        <div className="bg-white rounded-2xl border border-gray-300 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ford-blue-dark text-white">
              <tr>
                <th className="text-left px-6 py-4 font-bold w-56">Atributo</th>
                {data.vehicles.map((v: any) => (
                  <th key={v.id} className="px-4 py-4 text-left min-w-[180px]">
                    <div className="text-xs text-gray-300 uppercase tracking-wide">{v.marca}</div>
                    <div className="text-base font-bold">{v.modelo} {v.versao}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.fields.map((f: any, i: number) => (
                <tr key={`${f.path}-${i}`} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-3 font-medium text-gray-800">{f.label}</td>
                  {f.values.map((val: any, idx: number) => {
                    const winner = f.winner_index === idx;
                    return (
                      <td key={idx} className={`px-4 py-3 ${winner ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-gray-900'}`}>
                        <div className="flex items-center gap-2">
                          {winner && <Trophy className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
                          <span>{val === null || val === undefined ? '—' : String(val)}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Shell><div className="p-8 text-gray-500">Carregando…</div></Shell>}>
      <ComparePage />
    </Suspense>
  );
}
