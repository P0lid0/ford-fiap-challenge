import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FordIQ · Ford × FIAP 2026',
  description: 'Plataforma de Inteligência Competitiva e Retenção VIN Share',
  icons: {
    icon: '/brand/ford-logo-flat.svg',
    shortcut: '/brand/ford-logo-flat.svg',
    apple: '/brand/ford-logo-flat.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
