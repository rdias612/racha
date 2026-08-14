import { Trophy, Award, Flame, Zap } from "lucide-react";
import { Avatar } from "./Avatar";
import { vibrateLight } from "../lib/haptics";

export interface CardCraqueProps {
  nome: string;
  nota: number | string;
  votos?: number;
  posicao?: string;
  gols?: number;
  assistencias?: number;
  time?: "a" | "b" | null;
  resenhaFrase?: string;
  className?: string;
}

export function CardCraque({
  nome,
  nota,
  votos,
  posicao,
  gols = 0,
  assistencias = 0,
  time,
  resenhaFrase,
  className = "",
}: CardCraqueProps) {
  const notaFormatada = typeof nota === "number" ? nota.toFixed(1) : Number(nota).toFixed(1);

  // Microcopy dinâmico de resenha esportiva baseado na atuação
  const fraseDestaque =
    resenhaFrase ||
    (gols >= 3
      ? "Hat-trick na conta! Pediu música no Fantástico!"
      : gols >= 2
        ? "Decidiu o clássico com doblete de respeito!"
        : assistencias >= 2
          ? "Garçom de luxo! Deu aula de visão de jogo!"
          : Number(nota) >= 8.5
            ? "Gastou a bola! Atuação de gala no Gragoatá!"
            : "Eleito o Dono da Pelada pelos companheiros!");

  return (
    <div
      onClick={() => vibrateLight()}
      className={`relative mx-auto w-full max-w-sm select-none overflow-hidden rounded-2xl p-[2px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.99] ${className}`}
    >
      {/* Halo Luminoso Dourado / Borda Gradiente Estilo FUT */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-300 via-yellow-500 to-amber-700 animate-halo-glow" />

      {/* Corpo do Card Colecionável */}
      <div className="relative flex flex-col rounded-[14px] bg-gradient-to-b from-neutral-900 via-neutral-950 to-black p-4 text-neutral-100 shadow-2xl">
        {/* Textura de Fundo / Linhas Esportivas */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at top, rgba(245, 158, 11, 0.4), transparent 70%), repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0, rgba(255, 255, 255, 0.05) 1px, transparent 0, transparent 8px)",
          }}
        />

        {/* Topo do Card: Badge FUT + Rating Gigante */}
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 border border-amber-400/40">
              <Trophy className="size-3 text-amber-400" />
              Craque do Jogo
            </span>
            {posicao && (
              <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                {posicao}
              </span>
            )}
            {time && (
              <span className="text-[10px] font-semibold uppercase text-neutral-400">
                {time === "a" ? "Time Preto" : "Time Branco"}
              </span>
            )}
          </div>

          {/* Nota Gigante em Bebas Neue */}
          <div className="flex flex-col items-end">
            <div className="flex items-baseline font-scoreboard">
              <span className="text-5xl sm:text-6xl font-black leading-none tracking-tight text-amber-400 drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]">
                {notaFormatada}
              </span>
              <span className="ml-0.5 text-sm font-bold text-amber-400/80">/10</span>
            </div>
            {votos !== undefined && (
              <span className="text-[10px] font-medium text-neutral-400">
                {votos} {votos === 1 ? "voto" : "votos"}
              </span>
            )}
          </div>
        </div>

        {/* Avatar Central com Moldura Dourada */}
        <div className="relative z-10 my-3 flex flex-col items-center justify-center">
          <div className="relative rounded-full p-1 bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.35)]">
            <Avatar nome={nome} size="lg" />
            <div className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 p-1 text-neutral-950 shadow-md">
              <Award className="size-3.5 stroke-[2.5]" />
            </div>
          </div>
          <h3 className="mt-2 text-center font-heading text-lg sm:text-xl font-bold uppercase tracking-wider text-white">
            {nome}
          </h3>
        </div>

        {/* Estatísticas da Partida (Gols, Assists, etc.) */}
        <div className="relative z-10 grid grid-cols-3 gap-1.5 rounded-lg border border-amber-500/20 bg-neutral-900/80 p-2 backdrop-blur-xs">
          <div className="flex flex-col items-center justify-center py-1">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-neutral-400">
              <Flame className="size-3 text-amber-400" />
              Gols
            </span>
            <span className="font-scoreboard text-xl font-black text-amber-300">
              {gols}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center border-x border-neutral-800 py-1">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-neutral-400">
              <Zap className="size-3 text-amber-400" />
              Assists
            </span>
            <span className="font-scoreboard text-xl font-black text-amber-300">
              {assistencias}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-[10px] font-bold uppercase text-neutral-400">
              Status
            </span>
            <span className="text-[11px] font-black uppercase text-emerald-400">
              MVP ⭐
            </span>
          </div>
        </div>

        {/* Resenha Footer */}
        <div className="relative z-10 mt-3 border-t border-neutral-800/80 pt-2 text-center">
          <p className="text-[11px] font-medium italic text-amber-200/90">
            "{fraseDestaque}"
          </p>
        </div>
      </div>
    </div>
  );
}
