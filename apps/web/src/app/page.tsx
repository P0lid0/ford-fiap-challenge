'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@3amit.com.br');
  const [password, setPassword] = useState('Ford2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/carteira');
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/carteira');
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-ford-blue-dark flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="mb-12">
          <div className="text-white text-6xl font-black tracking-tight leading-none">Ford</div>
          <div className="text-gray-300 text-sm tracking-[0.3em] mt-2">FIAP · 3am IT</div>
        </div>

        <h1 className="text-white text-3xl font-bold mb-2">Entrar</h1>
        <p className="text-gray-300 mb-8">Painel de retenção · Desafios 1 e 2</p>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-300 mb-2">E-mail</label>
            <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/40 transition" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-300 mb-2">Senha</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/40 transition" />
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-4 bg-white text-ford-blue font-bold rounded-2xl uppercase tracking-wider text-sm transition hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-white/10">
          <div className="text-xs text-gray-400">
            Demo · admin@3amit.com.br / Ford2026!
          </div>
        </div>
      </div>
    </div>
  );
}
