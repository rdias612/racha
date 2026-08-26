import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { vibrateSuccess, vibrateError } from '../lib/haptics';

export type TipoSnackbar = 'sucesso' | 'erro' | 'info';

export interface SnackbarProps {
  mensagem: string;
  tipo?: TipoSnackbar;
  visivel: boolean;
  onFechar: () => void;
  duracaoMs?: number;
}

export function Snackbar({
  mensagem,
  tipo = 'sucesso',
  visivel,
  onFechar,
  duracaoMs = 3000,
}: SnackbarProps) {
  useEffect(() => {
    if (visivel) {
      if (tipo === 'sucesso') {
        vibrateSuccess();
      } else if (tipo === 'erro') {
        vibrateError();
      }

      const timer = setTimeout(() => {
        onFechar();
      }, duracaoMs);
      return () => clearTimeout(timer);
    }
  }, [visivel, tipo, duracaoMs, onFechar]);

  if (!visivel) return null;

  const bgCores: Record<TipoSnackbar, string> = {
    sucesso: 'bg-ok text-branco-time border-ok/80',
    erro: 'bg-perigo text-branco-time border-perigo/80',
    info: 'bg-superficie text-giz border-borda',
  };

  const Icones: Record<TipoSnackbar, typeof CheckCircle2> = {
    sucesso: CheckCircle2,
    erro: AlertCircle,
    info: Info,
  };

  const IconeComponente = Icones[tipo];

  return (
    <div
      className="fixed inset-x-3 z-50 mx-auto max-w-sm transition-normal animate-slide-up pointer-events-auto"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className={`flex items-center justify-between gap-3 rounded-[4px] border px-4 py-3 shadow-carimbo-preto backdrop-blur-xs ${bgCores[tipo]}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <IconeComponente className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate text-xs font-bold uppercase tracking-wider font-display">
            {mensagem}
          </span>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar notificação"
          className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[2px] p-1.5 hover:bg-black/10 dark:hover:bg-branco-time/20 transition-fast focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-1 cursor-pointer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
