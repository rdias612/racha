import React from "react";
import { RotateCcw, Save } from "lucide-react";

interface GestaoBarraConfirmacaoProps {
  qtdModificacoes: number;
  salvandoLote: boolean;
  onDescartar: () => void;
  onSalvar: () => void;
}

export const GestaoBarraConfirmacao = React.memo(function GestaoBarraConfirmacao({
  qtdModificacoes,
  salvandoLote,
  onDescartar,
  onSalvar,
}: GestaoBarraConfirmacaoProps) {
  if (qtdModificacoes === 0) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-neutral-900/95 dark:bg-neutral-900/95 text-white backdrop-blur-md border border-neutral-800 shadow-2xl rounded-2xl p-3 flex items-center justify-between gap-3 max-w-lg mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-6 rounded-full bg-green-500 text-neutral-950 font-bold text-xs flex items-center justify-center shrink-0">
            {qtdModificacoes}
          </span>
          <span className="text-xs font-semibold text-neutral-200 truncate">
            {qtdModificacoes === 1
              ? "1 alteração pendente"
              : `${qtdModificacoes} alterações pendentes`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={salvandoLote}
            onClick={onDescartar}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Descartar</span>
          </button>

          <button
            type="button"
            disabled={salvandoLote}
            onClick={onSalvar}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-500 text-white transition shadow-md disabled:opacity-50 shrink-0"
          >
            {salvandoLote ? (
              "Salvando..."
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Confirmar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
