import { useCallback, useState } from 'react';
import type { TipoSnackbar } from '../components/Snackbar';
import { vibrateError, vibrateSuccess } from '../lib/haptics';

export interface SnackbarState {
  visivel: boolean;
  tipo: TipoSnackbar;
  mensagem: string;
}

export interface UseSnackbarReturn {
  snackbar: SnackbarState;
  mostrarSnackbar: (tipoOuMensagem: TipoSnackbar | string, mensagem?: string) => void;
  mostrarSucesso: (mensagem: string) => void;
  mostrarErro: (mensagem: string) => void;
  mostrarInfo: (mensagem: string) => void;
  fecharSnackbar: () => void;
  /** Props prontas para repassar diretamente a `<Snackbar {...snackbarProps} />` */
  snackbarProps: {
    visivel: boolean;
    tipo: TipoSnackbar;
    mensagem: string;
    onFechar: () => void;
  };
}

/**
 * Hook padronizado para feedback efêmero (Snackbar).
 * Centraliza o estado reativo, fechamento automático e disparo de haptics
 * (vibrateSuccess / vibrateError) para todo o aplicativo.
 */
export function useSnackbar(): UseSnackbarReturn {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    visivel: false,
    tipo: 'sucesso',
    mensagem: '',
  });

  const fecharSnackbar = useCallback(() => {
    setSnackbar((s) => ({ ...s, visivel: false }));
  }, []);

  const mostrarSnackbar = useCallback(
    (tipoOuMensagem: TipoSnackbar | string, mensagem?: string) => {
      const tipo: TipoSnackbar =
        typeof mensagem === 'string' ? (tipoOuMensagem as TipoSnackbar) : 'sucesso';
      const msg = typeof mensagem === 'string' ? mensagem : tipoOuMensagem;

      if (tipo === 'sucesso') {
        vibrateSuccess();
      } else if (tipo === 'erro') {
        vibrateError();
      }

      setSnackbar({
        visivel: true,
        tipo,
        mensagem: msg,
      });
    },
    []
  );

  const mostrarSucesso = useCallback(
    (mensagem: string) => mostrarSnackbar('sucesso', mensagem),
    [mostrarSnackbar]
  );

  const mostrarErro = useCallback(
    (mensagem: string) => mostrarSnackbar('erro', mensagem),
    [mostrarSnackbar]
  );

  const mostrarInfo = useCallback(
    (mensagem: string) => mostrarSnackbar('info', mensagem),
    [mostrarSnackbar]
  );

  return {
    snackbar,
    mostrarSnackbar,
    mostrarSucesso,
    mostrarErro,
    mostrarInfo,
    fecharSnackbar,
    snackbarProps: {
      visivel: snackbar.visivel,
      tipo: snackbar.tipo,
      mensagem: snackbar.mensagem,
      onFechar: fecharSnackbar,
    },
  };
}
