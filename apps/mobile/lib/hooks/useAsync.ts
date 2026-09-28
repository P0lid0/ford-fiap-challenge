/**
 * Hook padrão de carregamento de dados das telas.
 *
 *   const { data, error, isLoading, isRefreshing, reload, refresh } =
 *     useAsync(() => dataSource.getMetrics(), []);
 *
 *  - isLoading    → primeira carga (ou reload após erro): mostrar LoadingState
 *  - isRefreshing → "puxar para atualizar": manter o conteúdo e mostrar o indicador
 *  - error        → DataSourceError com mensagem em português: mostrar ErrorState
 *  - reload()     → nova carga completa (botão "Tentar novamente")
 *  - refresh()    → recarrega mantendo os dados atuais (RefreshControl)
 *  - revalidate() → recarrega em silêncio, sem indicador (ex.: ao voltar para a tela);
 *                   se falhar e já houver dados, mantém os dados atuais
 *
 * Ignora respostas que chegam depois de a tela ser desmontada ou de uma
 * requisição mais nova (evita "piscar" dados antigos).
 */
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { DataSourceError } from '../data';

type AsyncState<T> = {
  data: T | null;
  error: DataSourceError | null;
  isLoading: boolean;
  isRefreshing: boolean;
};

export type AsyncResult<T> = AsyncState<T> & {
  reload(): void;
  refresh(): void;
  revalidate(): void;
};

type RunKind = 'load' | 'refresh' | 'silent';

export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null, error: null, isLoading: true, isRefreshing: false,
  });
  const requestId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async (kind: RunKind) => {
    const id = ++requestId.current;
    if (kind !== 'silent') {
      setState(prev => ({
        ...prev,
        error: kind === 'load' ? null : prev.error,
        isLoading: kind === 'load',
        isRefreshing: kind === 'refresh',
      }));
    }
    try {
      const data = await loaderRef.current();
      if (id === requestId.current) {
        setState({ data, error: null, isLoading: false, isRefreshing: false });
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setState(prev =>
        kind === 'silent' && prev.data !== null
          ? { ...prev, isLoading: false, isRefreshing: false }
          : { ...prev, error: DataSourceError.from(err), isLoading: false, isRefreshing: false },
      );
    }
  }, []);

  useEffect(() => {
    void run('load');
    return () => { requestId.current++; }; // descarta respostas pendentes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => { void run('load'); }, [run]);
  const refresh = useCallback(() => { void run('refresh'); }, [run]);
  const revalidate = useCallback(() => { void run('silent'); }, [run]);

  return { ...state, reload, refresh, revalidate };
}
