import type { ParRacha } from "../lib/partidas";

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
          <p className="mt-2 text-base font-bold text-neutral-900 dark:text-neutral-100">
            {par.jogador_a_nome} + {par.jogador_b_nome}
          </p>
          <p className="mt-0.5 text-2xl font-bold text-(--cor-destaque)">
            {par.pontos}{" "}
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              pts
            </span>
          </p>
          <p className="mt-0.5 text-sm font-medium text-(--cor-destaque)">
            {par.percentual === null
              ? "—"
              : `${Math.round(par.percentual * 100)}%`}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {par.partidas} partidas · {par.vitorias}V {par.empates}E{" "}
            {par.derrotas}D
          </p>
        </>
      )}
    </div>
  );
}
