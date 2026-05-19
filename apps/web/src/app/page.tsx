'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FordLogo } from '@/components/FordLogo';

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
    <div className="min-h-screen flex bg-charcoal text-white">
      {/* ===== Coluna esquerda: branding ===== */}
      <div className="hidden lg:flex flex-col justify-between flex-1 bg-ford-mesh relative overflow-hidden p-12">
        {/* glow circles decorativos */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-ford-blue-light/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-32 w-96 h-96 rounded-full bg-ford-accent/30 blur-3xl pointer-events-none" />

        <div className="relative">
          <FordLogo size="md" priority />
        </div>

        <div className="relative max-w-md">
          <div className="text-xs uppercase tracking-[0.4em] text-white/60 mb-4">
            Ford × FIAP · Challenge 2026
          </div>
          <h2 className="text-5xl font-black leading-tight mb-6">
            Plataforma de <span className="ford-script text-7xl font-bold text-white">inteligência</span>
            <br />
            para o varejo Ford.
          </h2>
          <p className="text-white/70 text-lg leading-relaxed">
            Catálogo competitivo confiável, predição de perfil de cliente
            e ações de retenção no momento certo — tudo auditável.
          </p>

          <div className="grid grid-cols-3 gap-4 mt-12">
            <FeatureBadge icon={ShieldCheck} label="LGPD-ready" />
            <FeatureBadge icon={Zap} label="ML em tempo real" />
            <FeatureBadge icon={BarChart3} label="Insights por loja" />
          </div>
        </div>

        <div className="relative text-xs text-white/40">
          © 2026 · Equipe 3am IT · FIAP · Built for Ford
        </div>
      </div>

      {/* ===== Coluna direita: formulário ===== */}
      <div className="w-full lg:w-[480px] flex items-center justify-center p-8 bg-ford-blue-deep relative">
        <div className="w-full max-w-sm">
          {/* logo mobile-only */}
          <div className="lg:hidden flex items-center justify-center mb-10">
            <FordLogo size="md" priority />
          </div>

          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.3em] text-white/50 mb-3">Entrar</div>
            <h1 className="text-3xl font-bold leading-tight">Bem-vindo de volta.</h1>
            <p className="text-white/60 text-sm mt-2">
              Acesso ao painel de retenção e inteligência competitiva.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-2">E-mail</label>
              <input type="email" autoComplete="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/40 focus:bg-white/10 transition" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-white/50 mb-2">Senha</label>
              <input type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/40 focus:bg-white/10 transition" />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="group w-full py-3.5 bg-white text-ford-blue font-bold rounded-2xl uppercase tracking-wider text-sm transition-all hover:bg-ice hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Entrando…' : 'Entrar'}
              {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-2">Demo</div>
            <code className="text-xs text-white/60 font-mono">admin@3amit.com.br · Ford2026!</code>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureBadge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="glass-dark px-3 py-3 rounded-xl flex flex-col items-center gap-1.5 text-center">
      <Icon className="w-4 h-4 text-white/80" />
      <span className="text-[10px] uppercase tracking-wider text-white/70 leading-tight">{label}</span>
    </div>
  );
}
