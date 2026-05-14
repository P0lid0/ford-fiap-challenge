'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, BarChart3, Users, AlertTriangle, Car, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const NAV = [
  { href: '/carteira', label: 'Carteira', icon: BarChart3 },
  { href: '/leads',    label: 'Leads',    icon: AlertTriangle },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/veiculos', label: 'Concorrência', icon: Car },
  { href: '/insights', label: 'Insights IA', icon: Sparkles },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/');
      else setEmail(data.session.user.email ?? '');
    });
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-ford-blue-dark text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="text-3xl font-black tracking-tight leading-none">Ford</div>
          <div className="text-xs text-gray-300 tracking-[0.3em] mt-1">FIAP · 3am IT</div>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition ${
                  active ? 'bg-white text-ford-blue font-semibold' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-gray-400 mb-2">{email}</div>
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10 hover:text-white transition">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
