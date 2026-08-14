import type { ParRacha } from "../lib/partidas";
import { Avatar } from "./Avatar";
import { Sparkles, Skull, Crown, Flame } from "lucide-react";

export type ModoDupla = "sinergia" | "carrasco" | "fregues" | "neutro";

interface DuplaCardProps {
  titulo: string;
  par: ParRacha | null;
  modo?: ModoDupla;
}

export function DuplaCard({ titulo, par, modo }: DuplaCardProps) {
  // Dedução automática do modo caso não venha explícito
  const modoAtivo: ModoDupla = modo ?? (() => {
    const t = titulo.toLowerCase();
    if (t.includes("melhor") || t.includes("sinergia")) return "sinergia";
    if (t.includes("pior") || t.includes("carrasco") || t.includes("zica")) return "carrasco";
    if (t.includes("fregu") || t.includes("ouro") || t.includes("frequente")) return "fregues";
    return "sinergia";
  })();

  const configModo = {
    sinergia: {
      borda: "border-emerald-200 dark:border-emerald-900/60",
      bg: "bg-emerald-50/30 dark:bg-emerald-950/20",
      textoDestaque: "text-emerald-700 dark:text-emerald-300",
      badgeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      barraCor: "bg-gradient-to-r from-emerald-500 to-teal-400",
      icone: Sparkles,
      tag: "Sinergia Pura",
    },
    carrasco: {
      borda: "border-red-200 dark:border-red-900/60",
      bg: "bg-red-50/30 dark:bg-red-950/20",
      textoDestaque: "text-red-700 dark:text-red-300",
      badgeBg: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
      barraCor: "bg-gradient-to-r from-red-500 to-rose-400",
      icone: Skull,
      tag: "Carrasco",
    },
    fregues: {
      borda: "border-amber-200 dark:border-amber-900/60",
      bg: "bg-amber-50/30 dark:bg-amber-950/20",
      textoDestaque: "text-amber-700 dark:text-amber-300",
      badgeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      barraCor: "bg-gradient-to-r from-amber-500 to-yellow-400",
      icone: Crown,
      tag: "Freguesia",
    },
    neutro: {
      borda: "border-neutral-200 dark:border-neutral-800",
      bg: "bg-white dark:bg-neutral-900/60",
      textoDestaque: "text-neutral-700 dark:text-neutral-300",
      badgeBg: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border-neutral-500/30",
      barraCor: "bg-[var(--cor-destaque)]",
      icone: Flame,
      tag: "Dupla",
    },
  }[modoAtivo];

  const Icone = configModo.icone;
  const pct = par?.percentual != null ? Math.round(par.percentual * 100) : 0;

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border ${configModo.borda} ${configModo.bg} p-3.5 sm:p-4 shadow-xs transition hover:shadow-sm`}
    >
      {/* Topo: Título + Badge de Modo + Pontos */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5">
        <div className="flex items-center gap-1.5 truncate">
          <div className="p-1 rounded-md bg-white/60 dark:bg-neutral-800/60 shrink-0">
            <Icone className="size-3.5 text-neutral-700 dark:text-neutral-300" />
          </div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 truncate">
            {titulo}
          </h4>
        </div>

        {par && (
          <span
            className={`inline-flex items-center shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold border ${configModo.badgeBg}`}
          >
            {par.pontos} pts
          </span>
        )}
      </div>

      {!par ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500 italic">
          Sem dados suficientes (mín. 5 partidas)
        </p>
      ) : (
        <div className="space-y-3">
          {/* Nomes dos Atletas e Avatares */}
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-2 shrink-0">
              <div className="ring-2 ring-white dark:ring-neutral-900 rounded-full">
                <Avatar nome={par.jogador_a_nome} size="sm" />
              </div>
              <div className="ring-2 ring-white dark:ring-neutral-900 rounded-full">
                <Avatar nome={par.jogador_b_nome} size="sm" />
              </div>
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {par.jogador_a_nome} &amp; {par.jogador_b_nome}
              </span>
              <span className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500">
                {par.partidas} jogos juntos
              </span>
            </div>
          </div>

          {/* Retrospecto Tripartido: Vitórias / Empates / Derrotas */}
          <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-bold">
            <div className="rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 px-1 py-1 text-emerald-700 dark:text-emerald-400">
              <span className="block text-xs font-black">{par.vitorias}</span>
              <span>VITÓRIAS</span>
            </div>
            <div className="rounded-lg bg-neutral-500/10 dark:bg-neutral-500/20 border border-neutral-500/30 px-1 py-1 text-neutral-700 dark:text-neutral-400">
              <span className="block text-xs font-black">{par.empates}</span>
              <span>EMPATES</span>
            </div>
            <div className="rounded-lg bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 px-1 py-1 text-red-700 dark:text-red-400">
              <span className="block text-xs font-black">{par.derrotas}</span>
              <span>DERROTAS</span>
            </div>
          </div>

          {/* Barra de Aproveitamento Percentual */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                Aproveitamento
              </span>
              <span className="font-extrabold text-neutral-900 dark:text-neutral-100">
                {par.percentual === null ? "—" : `${pct}%`}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${configModo.barraCor}`}
                style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
