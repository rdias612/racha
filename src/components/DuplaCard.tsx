import type { ParRacha } from "../lib/partidas";
import { Avatar } from "./Avatar";

interface DuplaCardProps {
  titulo: string;
  par: ParRacha | null;
  metrica?: "pontos" | "partidas" | "percentual" | "vitorias" | "dupla";
}

export function DuplaCard({ titulo, par, metrica = "pontos" }: DuplaCardProps) {
  const badgeTexto = par
    ? metrica === "percentual"
      ? par.percentual === null
        ? "—"
        : `${Math.round(par.percentual * 100)}%`
      : metrica === "partidas"
        ? `${par.partidas} jogos`
        : metrica === "vitorias"
          ? `${par.vitorias} vitórias`
          : `${par.pontos} pts`
    : null;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-3 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
          {titulo}
        </h4>
        {par && badgeTexto && (
          <span className="inline-flex items-center shrink-0 rounded-full bg-destaque/10 px-2 py-0.5 text-xs font-extrabold text-destaque">
            {badgeTexto}
          </span>
        )}
      </div>

      {!par ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Sem dados suficientes (mín. 5 partidas)
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2 shrink-0">
              <Avatar nome={par.jogador_a_nome} size="xs" />
              <Avatar nome={par.jogador_b_nome} size="xs" />
            </div>
            <span className="truncate text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {par.jogador_a_nome} + {par.jogador_b_nome}
            </span>
          </div>
          <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>
              {par.partidas}J · {par.vitorias}V {par.empates}E {par.derrotas}D
            </span>
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {par.percentual === null
                ? "—"
                : `${Math.round(par.percentual * 100)}%`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
