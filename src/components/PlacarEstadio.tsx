import { Radio } from "lucide-react";
import { formatarDataMobile, formatarDataCompleta } from "../lib/formatacao";
import { vibrateLight } from "../lib/haptics";

export interface PlacarEstadioProps {
  golsTimeA: number;
  golsTimeB: number;
  nomeTimeA?: string;
  nomeTimeB?: string;
  status?: "draft" | "live" | "published" | "closed";
  dataJogo?: string;
  onPlacarClick?: () => void;
  className?: string;
}

export function PlacarEstadio({
  golsTimeA,
  golsTimeB,
  nomeTimeA = "Time Preto",
  nomeTimeB = "Time Branco",
  status = "published",
  dataJogo,
  onPlacarClick,
  className = "",
}: PlacarEstadioProps) {
  const isAoVivo = status === "live";

  return (
    <div
      onClick={() => {
        vibrateLight();
        onPlacarClick?.();
      }}
      className={`relative select-none overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl transition-all ${className}`}
    >
      {/* Luz e reflexo de estádio */}
      <div className="pointer-events-none absolute inset-0 bg-radial-at-t from-white/10 via-transparent to-black/60" />

      {/* Header do Placar: Badge de Status + Data */}
      <div className="relative z-10 flex items-center justify-between border-b border-neutral-800/80 bg-neutral-900/60 px-4 py-2 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          {isAoVivo ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-500/40">
              <span className="size-2 rounded-full bg-emerald-400 animate-live-pulse" />
              <Radio className="size-3" />
              Ao Vivo
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              {status === "closed"
                ? "Finalizado"
                : status === "published"
                  ? "Votação Aberta"
                  : "Pré-Jogo"}
            </span>
          )}
        </div>

        {dataJogo && (
          <div className="text-right text-[11px] font-medium text-neutral-400">
            <span className="sm:hidden">{formatarDataMobile(dataJogo)}</span>
            <span className="hidden sm:inline">{formatarDataCompleta(dataJogo)}</span>
          </div>
        )}
      </div>

      {/* Corpo Central do Placar: Preto × Branco em Alto Impacto */}
      <div className="relative z-10 grid grid-cols-2">
        {/* Time Preto (A) */}
        <div className="relative flex flex-col items-center justify-center bg-neutral-900/90 py-5 px-3 border-r border-neutral-800">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="size-3 rounded-full border border-neutral-600 bg-neutral-950 shadow-xs" />
            <span className="font-heading text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200">
              {nomeTimeA}
            </span>
          </div>
          <span className="font-scoreboard text-6xl sm:text-7xl font-black tabular-nums tracking-tight text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.2)]">
            {status === "draft" ? "—" : golsTimeA}
          </span>
        </div>

        {/* Time Branco (B) */}
        <div className="relative flex flex-col items-center justify-center bg-neutral-100 py-5 px-3 text-neutral-950">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="size-3 rounded-full border border-neutral-400 bg-white shadow-xs" />
            <span className="font-heading text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-800">
              {nomeTimeB}
            </span>
          </div>
          <span className="font-scoreboard text-6xl sm:text-7xl font-black tabular-nums tracking-tight text-neutral-900 drop-shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
            {status === "draft" ? "—" : golsTimeB}
          </span>
        </div>

        {/* Divisor Central "×" de Estádio */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex size-9 items-center justify-center rounded-full border-2 border-neutral-800 bg-neutral-900 text-sm font-black text-amber-400 shadow-xl">
          ×
        </div>
      </div>
    </div>
  );
}
