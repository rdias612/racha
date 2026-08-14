import { useEffect, useId, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { Participante, TipoEvento } from "../lib/partidas";
import { formatarNome } from "../lib/formatacao";
import { vibrateGoal, vibrateError, vibrateLight } from "../lib/haptics";

interface DialogoEventoProps {
  jogador: Participante | null;
  companheiros: Participante[];
  jogadores?: Participante[];
  salvando: boolean;
  editando?: boolean;
  tipoAtual?: TipoEvento;
  assistenciaAtual?: number | null;
  onClose: () => void;
  onTrocarJogador?: (jogador: Participante) => void;
  onConfirmar: (tipo: TipoEvento, assistenciaId: number | null) => void;
}

type Etapa = "tipo" | "assistencia";

export function DialogoEvento({
  jogador,
  companheiros,
  jogadores = [],
  salvando,
  editando = false,
  tipoAtual,
  assistenciaAtual,
  onClose,
  onTrocarJogador,
  onConfirmar,
}: DialogoEventoProps) {
  const tituloId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const [etapa, setEtapa] = useState<Etapa>("tipo");
  const [visivel, setVisivel] = useState(false);
  const salvandoRef = useRef(salvando);
  const onCloseRef = useRef(onClose);
  salvandoRef.current = salvando;
  onCloseRef.current = onClose;

  useEffect(() => {
    setEtapa("tipo");
  }, [jogador?.jogador_id, editando]);

  useEffect(() => {
    if (!jogador) return;
    setVisivel(false);
    const raf = requestAnimationFrame(() => setVisivel(true));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !salvandoRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cardRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [jogador?.jogador_id]);

  if (!jogador) return null;

  const nome = formatarNome(jogador.nome ?? `#${jogador.jogador_id}`);
  const pretos = jogadores.filter((j) => j.time === "a");
  const brancos = jogadores.filter((j) => j.time === "b");

  return createPortal(
    <div
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !salvando) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`w-full max-w-sm rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-2xl transition sm:rounded-2xl dark:border-neutral-800 dark:bg-neutral-900 ${
          visivel ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {etapa === "tipo" ? (
          <>
            <h2
              id={tituloId}
              className="text-base font-bold font-heading text-neutral-900 dark:text-neutral-100"
            >
              {editando ? "Editar evento da partida" : `Evento de ${nome}`}
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {editando
                ? "Altere o autor do lance, o tipo ou a assistência."
                : "Selecione o acontecimento para atualizar o placar:"}
            </p>

            {editando && onTrocarJogador && jogadores.length > 0 && (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Jogador
                </span>
                <select
                  value={jogador.jogador_id}
                  onChange={(e) => {
                    vibrateLight();
                    const id = Number(e.target.value);
                    const escolhido = jogadores.find((j) => j.jogador_id === id);
                    if (escolhido) onTrocarJogador(escolhido);
                  }}
                  className="w-full cursor-pointer rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 shadow-xs"
                >
                  {pretos.length > 0 && (
                    <optgroup label="Time Preto">
                      {pretos.map((j) => (
                        <option key={j.jogador_id} value={j.jogador_id}>
                          {formatarNome(j.nome ?? `#${j.jogador_id}`)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {brancos.length > 0 && (
                    <optgroup label="Time Branco">
                      {brancos.map((j) => (
                        <option key={j.jogador_id} value={j.jogador_id}>
                          {formatarNome(j.nome ?? `#${j.jogador_id}`)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={salvando}
                onClick={() => {
                  vibrateGoal();
                  setEtapa("assistencia");
                }}
                className={`cursor-pointer min-h-[48px] rounded-xl px-3 py-3 text-sm font-bold active:scale-95 disabled:opacity-40 shadow-sm ${
                  editando && tipoAtual === "gol"
                    ? "bg-[var(--cor-destaque)] text-white ring-2 ring-[var(--cor-destaque)] ring-offset-2 ring-offset-white dark:ring-offset-neutral-900"
                    : "bg-[var(--cor-destaque)] text-white"
                }`}
              >
                ⚽ GOL!
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => {
                  vibrateError();
                  onConfirmar("gol_contra", null);
                }}
                className={`cursor-pointer min-h-[48px] rounded-xl border px-3 py-3 text-sm font-bold active:scale-95 disabled:opacity-40 shadow-sm ${
                  editando && tipoAtual === "gol_contra"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-red-300 text-red-600 dark:border-red-900 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                }`}
              >
                🔴 Gol contra
              </button>
            </div>
            <button
              type="button"
              disabled={salvando}
              onClick={() => {
                vibrateLight();
                onClose();
              }}
              className="mt-3 w-full cursor-pointer rounded-xl bg-neutral-100 px-3 py-2.5 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <h2
              id={tituloId}
              className="text-base font-bold font-heading text-neutral-900 dark:text-neutral-100"
            >
              Assistência no gol de {nome}
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Quem foi o garçom que deu o passe açucarado?
            </p>
            <button
              type="button"
              disabled={salvando}
              onClick={() => {
                vibrateGoal();
                onConfirmar("gol", null);
              }}
              className={`mt-4 w-full cursor-pointer min-h-[44px] rounded-xl border px-3 py-2.5 text-xs font-semibold active:scale-95 disabled:opacity-40 ${
                editando && assistenciaAtual == null && tipoAtual === "gol"
                  ? "border-[var(--cor-destaque)] bg-[var(--cor-destaque)]/10 text-neutral-900 dark:text-neutral-100 font-bold"
                  : "border-neutral-300 text-neutral-800 dark:border-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              Sem assistência (jogada individual / sobra)
            </button>
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {companheiros.map((c) => {
                const ativo =
                  editando && assistenciaAtual === c.jogador_id;
                return (
                  <button
                    key={c.jogador_id}
                    type="button"
                    disabled={salvando}
                    onClick={() => {
                      vibrateGoal();
                      onConfirmar("gol", c.jogador_id);
                    }}
                    className={`w-full cursor-pointer min-h-[44px] rounded-xl px-3 py-2 text-left text-xs font-semibold active:scale-[0.99] disabled:opacity-40 transition ${
                      ativo
                        ? "bg-[var(--cor-destaque)] text-white shadow-xs"
                        : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    🅰️ {formatarNome(c.nome ?? `#${c.jogador_id}`)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={salvando}
              onClick={() => {
                vibrateLight();
                setEtapa("tipo");
              }}
              className="mt-3 w-full cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              ← voltar
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
