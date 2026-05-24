'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LogOut, BarChart3, Users, AlertTriangle, Car, Sparkles, Settings, Plus,
  ChevronRight, Bell, Megaphone, BookOpen, Database,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FordLogo } from './FordLogo';
import { FaroLogo } from './FaroLogo';

type NavItem = { href: string; label: string; icon: any; group?: string };

const NAV: NavItem[] = [
  { href: '/carteira',          label: 'Carteira',        icon: BarChart3,     group: 'Retenção (D2)' },
  { href: '/leads',             label: 'Leads',           icon: AlertTriangle, group: 'Retenção (D2)' },
  { href: '/clientes',          label: 'Clientes',        icon: Users,         group: 'Retenção (D2)' },
  { href: '/acoes',             label: 'Ações & Campanhas', icon: Megaphone,   group: 'Retenção (D2)' },
  { href: '/veiculos',          label: 'Concorrência',    icon: Car,           group: 'Catálogo (D1)' },
  { href: '/veiculos/adicionar',label: 'Adicionar carro', icon: Plus,          group: 'Catálogo (D1)' },
  { href: '/ajuda',             label: 'Documentação',    icon: BookOpen,      group: 'Sistema' },
  { href: '/configuracoes',     label: 'Configurações',   icon: Settings,      group: 'Sistema' },
];

const GROUPS = ['Retenção (D2)', 'Catálogo (D1)', 'Sistema'] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/');
      else {
        setEmail(data.session.user.email ?? '');
        setRole((data.session.user.user_metadata?.role as string) ?? 'analista');
      }
    });
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  const currentLabel = NAV.find(n => pathname?.startsWith(n.href))?.label ?? 'Painel';
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#F7F8FB]">
      {/* ===== SIDEBAR ===== fixa: gruda na viewport, NUNCA scrolla com a página */}
      <aside className="fixed inset-y-0 left-0 z-30 w-64 h-screen
                        bg-ford-gradient text-white flex flex-col overflow-hidden">
        {/* decorativo: blob radial sutil no fundo */}
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ background: 'radial-gradient(circle at 20% 0%, #1E4B8E 0%, transparent 50%)' }} />

        {/* logo + brand — Faro AI (produto) + Ford × FIAP (parceria do challenge) */}
        <div className="relative px-5 pt-6 pb-5 border-b border-white/10">
          {/* Faro AI — marca principal do sistema */}
          <div className="flex items-center gap-3 mb-3">
            <FaroLogo size="sm" monochrome />
            <div>
              <div className="text-base font-black leading-tight tracking-tight">FARO <span className="font-light text-white/80">AI</span></div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-white/50 leading-tight mt-0.5">Inteligência automotiva</div>
            </div>
          </div>
          {/* Parceria Ford × FIAP — secundário */}
          <div className="flex items-center gap-2 pt-3 border-t border-white/5">
            <FordLogo size="xs" />
            <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 leading-tight">
              Ford × FIAP<br />Challenge 2026
            </div>
          </div>
        </div>

        {/* nav agrupada */}
        <nav className="relative flex-1 px-3 py-5 space-y-5 overflow-y-auto">
          {GROUPS.map(group => {
            const items = NAV.filter(n => n.group === group);
            return (
              <div key={group}>
                <div className="px-4 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  {group}
                </div>
                <div className="space-y-0.5">
                  {items.map(({ href, label, icon: Icon }) => {
                    const active =
                      href === '/veiculos'
                        ? pathname === '/veiculos' || pathname?.match(/^\/veiculos\/[^/]+$/)
                        : pathname?.startsWith(href);
                    return (
                      <Link key={href} href={href}
                        className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                          active
                            ? 'bg-white text-ford-blue font-semibold shadow-glow'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}>
                        {active && (
                          <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                        )}
                        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-ford-blue' : 'text-white/60 group-hover:text-white'}`} />
                        <span className="flex-1">{label}</span>
                        {active && <ChevronRight className="w-3.5 h-3.5 text-ford-blue/60" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* user card */}
        <div className="relative p-4 border-t border-white/10 glass-dark">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white text-ford-blue font-bold flex items-center justify-center text-sm shadow-glow">
              {initials || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/90 truncate font-medium">{email || 'Usuário'}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 mt-0.5">
                {role}
              </div>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-white/70 hover:bg-white/15 hover:text-white transition border border-white/10">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </aside>

      {/* ===== MAIN ===== compensa a sidebar fixa com ml-64 */}
      <main className="flex-1 flex flex-col min-w-0 ml-64">
        {/* top bar fina — sticky pra acompanhar scroll do conteúdo */}
        <header className="sticky top-0 z-10 backdrop-blur-md bg-white/70 border-b border-gray-200/60 px-8 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Faro AI</div>
            <div className="text-base font-semibold text-charcoal">{currentLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition" title="Notificações">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
