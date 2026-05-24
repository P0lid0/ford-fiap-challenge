import { redirect } from 'next/navigation';
// Página unificada em /carteira (seção 6+7). Mantemos só pra não quebrar bookmarks.
export default function VisaoFordRedirect() {
  redirect('/carteira');
}
