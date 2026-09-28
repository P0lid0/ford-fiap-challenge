/**
 * Estado global de autenticação.
 *
 * Envolve o app (app/_layout.tsx) e expõe `useAuth()` para qualquer tela.
 * Escuta dataSource.onSessionChange — se o token expirar (modo API), a sessão
 * vira null e o layout raiz redireciona para o login automaticamente.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dataSource, type DataMode } from '../data';
import type { UserSession } from '../types';

type AuthContextValue = {
  session: UserSession | null;
  /** false enquanto a sessão salva ainda está sendo lida do armazenamento. */
  isReady: boolean;
  mode: DataMode;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = dataSource.onSessionChange(next => {
      if (active) setSession(next);
    });
    dataSource.getSession()
      .then(stored => { if (active) setSession(stored); })
      .catch(() => { if (active) setSession(null); })
      .finally(() => { if (active) setIsReady(true); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await dataSource.signIn(email, password); // erros (DataSourceError) sobem para a tela
  }, []);

  const signOut = useCallback(async () => {
    await dataSource.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isReady, mode: dataSource.mode, signIn, signOut }),
    [session, isReady, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth() precisa estar dentro de <AuthProvider>.');
  return context;
}
