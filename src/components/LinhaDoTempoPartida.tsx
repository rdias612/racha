import { useMemo } from "react";
import { formatarNome } from "../lib/formatacao";
import { Avatar } from "./Avatar";
import {
  type EventoPartida,
  type Participante,
  type StatusPartida,
} from "../lib/partidas";
import {
  Flag,
  Radio,
  Edit2,
  Trash2,
  Trophy,
} from "lucide-react";

interface LinhaDoTempoPartidaProps {
  eventos: EventoPartida[];
  participantes: Participante[];
  status?: StatusPartida;
  isAdmin?: boolean;
  onEditarEvento?: (evento: EventoPartida) => void;
  onRemoverEvento?: (evento: EventoPartida) => void;
}

interface EventoCalculado {
  evento: EventoPartida;
  jogadorNome: string;
  jogadorTime: "a" | "b" | null;
  assistenciaNome: string | null;
  golsA: number;
  golsB: number;
  timeMarcador: "a" | "b";
  isGolContra: boolean;
  horaFormatada: string;
}

export function LinhaDoTempoPartida({
  eventos,
  participantes,
  status = "live",
  isAdmin = false,
  onEditarEvento,
  onRemoverEvento,
}: LinhaDoTempoPartidaProps) {
  // Mapa de jogadores para acesso instantâneo
  const mapaJogadores = useMemo(() => {
    const map = new Map<number, Participante>();
    participantes.forEach((p) => map.set(p.jogador_id, p));
    return map;
  }, [participantes]);

  // Processa eventos cronologicamente e calcula o placar progressivo
  const eventosProcessados = useMemo<EventoCalculado[]>(() => {
    const ordenados = [...eventos].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let golsA = 0;
    let golsB = 0;

    return ordenados.map((ev) => {
      const jog = mapaJogadores.get(ev.jogador_id);
      const ass = ev.assistencia_jogador_id
        ? mapaJogadores.get(ev.assistencia_jogador_id)
        : null;

      const jogadorTime = jog?.time ?? null;
      const isGolContra = ev.tipo === "gol_contra";

      // Se for gol contra, o gol vai pro adversário
      let timeMarcador: "a" | "b" = jogadorTime === "b" ? "b" : "a";
      if (isGolContra) {
        timeMarcador = jogadorTime === "a" ? "b" : "a";
      }

      if (timeMarcador === "a") golsA++;
      else golsB++;

      let horaFormatada = "";
      try {
        const d = new Date(ev.created_at);
        horaFormatada = d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        horaFormatada = "--:--";
      }

      return {
        evento: ev,
        jogadorNome: formatarNome(jog?.nome ?? `#${ev.jogador_id}`),
        jogadorTime,
        assistenciaNome: ass ? formatarNome(ass.nome ?? `#${ass.jogador_id}`) : null,
        golsA,
        golsB,
        timeMarcador,
        isGolContra,
        horaFormatada,
      };
    });
  }, [eventos, mapaJogadores]);

  const placarFinal = eventosProcessados.length > 0
    ? {
        a: eventosProcessados[eventosProcessados.length - 1].golsA,
        b: eventosProcessados[eventosProcessados.length - 1].golsB,
      }
    : { a: 0, b: 0 };

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 p-3.5 sm:p-5 shadow-xs space-y-4">
      {/* Cabeçalho da Linha do Tempo */}
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--cor-destaque)]/10 text-[var(--cor-destaque)]">
            <Radio className="size-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              Linha do Tempo · Minuto a Minuto
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {eventos.length} lance{eventos.length === 1 ? "" : "s"} registrado{eventos.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {/* Placar Atual / Final */}
        <div className="flex items-center gap-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-1 text-xs font-bold">
          <span className="text-neutral-900 dark:text-neutral-100">Preto</span>
          <span className="font-scoreboard text-sm text-[var(--cor-destaque)]">
            {placarFinal.a} × {placarFinal.b}
          </span>
          <span className="text-neutral-700 dark:text-neutral-300">Branco</span>
        </div>
      </div>

      {/* Timeline Gráfica */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-neutral-300 before:via-neutral-300 before:to-neutral-300 dark:before:from-neutral-700 dark:before:via-neutral-700 dark:before:to-neutral-700">
        {/* Ponto de Início: Apito Inicial */}
        <div className="relative flex items-center gap-3">
          <div className="absolute -left-6 sm:-left-8 flex size-5 sm:size-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs ring-4 ring-white dark:ring-neutral-900">
            <Flag className="size-2.5 sm:size-3.5" />
          </div>
          <div className="flex items-center justify-between w-full text-xs">
            <span className="font-bold text-neutral-700 dark:text-neutral-300">
              Apito Inicial · Bola Rolando
            </span>
            <span className="text-[11px] font-mono text-neutral-400">0 × 0</span>
          </div>
        </div>

        {/* Lances e Gols */}
        {eventosProcessados.map((item, index) => {
          const isPreto = item.timeMarcador === "a";

          return (
            <div
              key={item.evento.id}
              className="relative group transition-all duration-200"
            >
              {/* Marcador na Linha */}
              <div
                className={`absolute -left-6 sm:-left-8 flex size-5 sm:size-7 items-center justify-center rounded-full text-xs shadow-md ring-4 ring-white dark:ring-neutral-900 ${
                  item.isGolContra
                    ? "bg-red-500 text-white"
                    : isPreto
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "bg-amber-400 text-neutral-950"
                }`}
              >
                {item.isGolContra ? "⚠️" : "⚽"}
              </div>

              {/* Card do Lance */}
              <div
                className={`rounded-xl border p-3 transition shadow-xs ${
                  item.isGolContra
                    ? "border-red-200 bg-red-50/40 dark:border-red-950/80 dark:bg-red-950/20"
                    : isPreto
                    ? "border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-950/40"
                    : "border-amber-200 bg-amber-50/40 dark:border-amber-950/80 dark:bg-amber-950/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          isPreto
                            ? "bg-neutral-900 text-white dark:bg-neutral-800 dark:text-neutral-100"
                            : "bg-amber-400 text-neutral-950 dark:bg-amber-500 dark:text-neutral-950"
                        }`}
                      >
                        {isPreto ? "Time Preto" : "Time Branco"}
                      </span>

                      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                        {item.horaFormatada}
                      </span>
                    </div>

                    {/* Nome do Artilheiro / Autor */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <Avatar nome={item.jogadorNome} size="xs" />
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {item.jogadorNome}
                          {item.isGolContra && (
                            <span className="ml-1 text-xs font-extrabold text-red-600 dark:text-red-400">
                              (Gol Contra)
                            </span>
                          )}
                        </p>
                        {item.assistenciaNome && (
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            🅰️ Passe de <span className="font-semibold">{item.assistenciaNome}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Placar após este gol */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-scoreboard text-base sm:text-lg font-bold text-[var(--cor-destaque)] tabular-nums">
                      {item.golsA} × {item.golsB}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                      Lance #{index + 1}
                    </span>

                    {/* Ações de Admin no Ao Vivo */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 pt-1">
                        {onEditarEvento && (
                          <button
                            type="button"
                            onClick={() => onEditarEvento(item.evento)}
                            title="Editar este lance"
                            className="p-1 rounded-md text-neutral-500 hover:text-[var(--cor-destaque)] hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                        )}
                        {onRemoverEvento && (
                          <button
                            type="button"
                            onClick={() => onRemoverEvento(item.evento)}
                            title="Desfazer este lance"
                            className="p-1 rounded-md text-neutral-500 hover:text-red-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Estado sem eventos ainda */}
        {eventosProcessados.length === 0 && (
          <div className="py-2 text-xs text-neutral-400 dark:text-neutral-500 italic">
            Nenhum gol ou lance registrado até o momento.
          </div>
        )}

        {/* Ponto Final: Ao Vivo ou Fim de Partida */}
        {status === "live" ? (
          <div className="relative flex items-center gap-3 pt-1">
            <div className="absolute -left-6 sm:-left-8 flex size-5 sm:size-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md animate-pulse ring-4 ring-white dark:ring-neutral-900">
              <span className="size-2 rounded-full bg-white animate-ping" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-red-600 dark:text-red-400">
                Partida em Andamento
              </span>
              <span className="inline-block size-1.5 rounded-full bg-red-500 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="relative flex items-center gap-3 pt-1">
            <div className="absolute -left-6 sm:-left-8 flex size-5 sm:size-7 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-md ring-4 ring-white dark:ring-neutral-900">
              <Trophy className="size-2.5 sm:size-3.5" />
            </div>
            <div className="flex items-center justify-between w-full text-xs">
              <span className="font-extrabold text-neutral-900 dark:text-neutral-100">
                Fim de Jogo · Súmula Fechada
              </span>
              <span className="font-scoreboard font-bold text-sm text-[var(--cor-destaque)]">
                {placarFinal.a} × {placarFinal.b}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
