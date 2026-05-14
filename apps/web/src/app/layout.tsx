import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ford × FIAP — 3am IT',
  description: 'Plataforma de Retenção e Inteligência Competitiva',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
