// Helper compartilhado: fetch com timeout via AbortController.
// Evita que scripts ou requests pendurem indefinidamente em hosts lentos.
import { fetch as undiciFetch, type Response } from 'undici';

export async function fetchWithTimeout(url: string, opts: any = {}, timeoutMs = 12_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await undiciFetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
