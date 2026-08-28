import { RotateCcw, Save } from 'lucide-react';

export interface BarraRascunhoGestaoProps {
  qtdModificacoes: number;
  salvandoLote: boolean;
  onDescartar: () => void;
  onSalvar: () => void;
}

// Barra flutuante acima da TabBar visível (não usa BarraAcaoInferior, que é
// fixed bottom-0 para fluxos focados com TabBar oculta).
export function BarraRascunhoGestao({
  qtdModificacoes,
  salvandoLote,
  onDescartar,
  onSalvar,
}: BarraRascunhoGestaoProps) {
  return (
    <div className="fixed bottom-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-50 animate-slide-up">
      <div className="bg-superficie text-giz backdrop-blur-md border-2 border-destaque shadow-carimbo-preto rounded-[4px] p-3 flex items-center justify-between gap-3 max-w-lg mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-6 rounded-[2px] bg-destaque text-destaque-tinta font-mono font-bold text-xs flex items-center justify-center shrink-0">
            {qtdModificacoes}
          </span>
          <span className="text-xs font-display font-bold uppercase tracking-wider text-giz truncate">
            {qtdModificacoes === 1
              ? '1 alteração pendente'
              : `${qtdModificacoes} alterações pendentes`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={salvandoLote}
            onClick={onDescartar}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-[3px] border border-borda text-xs font-display font-bold uppercase tracking-wider text-giz-fraco hover:text-giz hover:bg-superficie-2 transition disabled:opacity-50 min-h-[44px]"
          >
            <RotateCcw className="size-3.5" />
            <span>Descartar</span>
          </button>

          <button
            type="button"
            disabled={salvandoLote}
            onClick={onSalvar}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[3px] text-xs font-display font-bold uppercase tracking-wider bg-destaque hover:brightness-105 text-destaque-tinta transition shadow-carimbo active:translate-y-px disabled:opacity-50 shrink-0 min-h-[44px]"
          >
            {salvandoLote ? (
              'Salvando...'
            ) : (
              <>
                <Save className="size-3.5" />
                <span>Confirmar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
