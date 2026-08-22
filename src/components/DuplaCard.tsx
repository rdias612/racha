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
    <div className="flex flex-col justify-between rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo text-giz">
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <h4 className="text-[10px] font-display font-bold uppercase tracking-wider text-giz-fraco truncate">
          {titulo}
        </h4>
        {par && badgeTexto && (
          <span className="inline-flex items-center shrink-0 rounded-[2px] bg-destaque/10 border border-destaque/40 px-2 py-0.5 text-xs font-mono font-bold text-destaque">
            {badgeTexto}
          </span>
        )}
      </div>

      {!par ? (
        <p className="mt-1 text-xs font-mono text-giz-fraco">
          Sem dados suficientes (mín. 5 partidas)
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5 shrink-0">
              <Avatar nome={par.jogador_a_nome} size="xs" />
              <Avatar nome={par.jogador_b_nome} size="xs" />
            </div>
            <span className="truncate text-xs sm:text-sm font-bold text-giz">
              {par.jogador_a_nome} + {par.jogador_b_nome}
            </span>
          </div>
          <div className="pt-1.5 border-t border-borda flex items-center justify-between text-[11px] font-mono text-giz-fraco">
            <span>
              {par.partidas}J · {par.vitorias}V {par.empates}E {par.derrotas}D
            </span>
            <span className="font-bold text-giz tabular-nums">
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

