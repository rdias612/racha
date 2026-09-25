import { ArrowLeftRight } from 'lucide-react';

interface DueloCardProps {
  usernameA: string;
  usernameB: string;
  /** B ainda não escolhido: inversão desabilitada. */
  idBSelecionado: boolean;
  onTrocarLados: () => void;
}

/** Card do duelo: dois lados, separador e botão de inversão. */
export function DueloCard({ usernameA, usernameB, idBSelecionado, onTrocarLados }: DueloCardProps) {
  return (
    <div className="rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
      <div className="flex items-center gap-2">
        <LadoDuelo username={usernameA} />
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <span
            aria-hidden="true"
            className="font-mono text-lg font-black leading-none text-giz-fraco"
          >
            ×
          </span>
          <button
            type="button"
            onClick={onTrocarLados}
            disabled={!idBSelecionado}
            aria-label="Inverter lados do confronto"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[4px] border border-borda bg-superficie-2 p-2 text-giz shadow-carimbo transition hover:bg-superficie hover:text-destaque-texto active:translate-y-px focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <LadoDuelo username={usernameB} />
      </div>
    </div>
  );
}

/** Um lado do card do duelo: nome display. */
function LadoDuelo({ username }: { username: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center py-2">
      <span className="w-full truncate text-center font-display text-base font-bold uppercase tracking-wider text-giz">
        {username}
      </span>
    </div>
  );
}
