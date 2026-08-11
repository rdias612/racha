import type { ParRacha } from "../lib/partidas";
import { Avatar } from "./Avatar";

interface DuplaCardProps {
  titulo: string;
  par: ParRacha | null;
}

export function DuplaCard({ titulo, par }: DuplaCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {titulo}
      </h4>
      {!par ? (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Sem dados suficientes (mín. 5 partidas)
        </p>
      ) : (
        <>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                <Avatar nome={par.jogador_a_nome} size="xs" />
                <Avatar nome={par.jogador_b_nome} size="xs" />
              </div>
              <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {par.jogador_a_nome} + {par.jogador_b_nome}
              </span>
            </div>
            <span className="shrink-0 text-base font-bold text-(--cor-destaque)">
              {par.pontos} pts
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {par.partidas}J · {par.vitorias}V · {par.empates}E ·{" "}
              {par.derrotas}D
            </span>
            <span className="font-medium text-(--cor-destaque)">
              {par.percentual === null
                ? "—"
                : `${Math.round(par.percentual * 100)}%`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
