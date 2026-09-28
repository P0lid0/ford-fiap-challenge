import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Recarrega os dados (em silêncio) sempre que a tela volta a ficar visível —
 * ex.: depois de cadastrar um cliente, a Carteira e os Leads já aparecem atualizados.
 * Ignora o primeiro foco, que já é coberto pela carga inicial do useAsync.
 */
export function useRevalidateOnFocus(revalidate: () => void): void {
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      revalidate();
    }, [revalidate]),
  );
}
