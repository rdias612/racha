import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { vibrateSuccess, vibrateError } from "../lib/haptics";

export type TipoSnackbar = "sucesso" | "erro" | "info";

interface SnackbarProps {
  mensagem: string;
  tipo?: TipoSnackbar;
  visivel: boolean;
  onFechar: () => void;
  duracaoMs?: number;
}

export function Snackbar({
  mensagem,
  tipo = "sucesso",
  visivel,
  onFechar,
  duracaoMs = 3000,
}: SnackbarProps) {
  useEffect(() => {
    if (visivel) {
      if (tipo === "sucesso") vibrateSuccess();
      else if (tipo === "erro") vibrateError();

      const timer = setTimeout(() => {
        onFechar();
      }, duracaoMs);
      return () => clearTimeout(timer);
    }
  }, [visivel, tipo, duracaoMs, onFechar]);

  if (!visivel) return null;

  const bgCores: Record<TipoSnackbar, string> = {
    sucesso: "bg-emerald-600 text-white dark:bg-emerald-500",
    erro: "bg-red-600 text-white dark:bg-red-500",
    info: "bg-neutral-800 text-white dark:bg-neutral-900 border border-neutral-700",
  };

  const Icones: Record<TipoSnackbar, typeof CheckCircle2> = {
    sucesso: CheckCircle2,
    erro: AlertCircle,
    info: Info,
  };

  const IconeComponente = Icones[tipo];

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-sm transition-all duration-300 ease-out sm:bottom-6">
      <div
        className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-lg ${bgCores[tipo]}`}
        role="alert"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <IconeComponente className="size-5 shrink-0" />
          <span className="truncate text-xs font-medium">{mensagem}</span>
        </div>
        <button
          onClick={onFechar}
          aria-label="Fechar notificação"
          className="shrink-0 rounded-md p-1 hover:bg-white/20 transition"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
