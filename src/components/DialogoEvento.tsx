import { useEffect, useId, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { Participante, TipoEvento } from "../lib/partidas";
import { formatarNome } from "../lib/formatacao";

interface DialogoEventoProps {
  jogador: Participante | null;
  companheiros: Participante[];
  salvando: boolean;
  onClose: () => void;
  onConfirmar: (tipo: TipoEvento, assistenciaId: number | null) => void;
}

type Etapa = "tipo" | "assistencia";

export function DialogoEvento({
  jogador,
  companheiros,
  salvando,
  onClose,
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
  }, [jogador?.jogador_id]);

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

  return createPortal(
    <div
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !salvando) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`w-full max-w-sm rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-xl transition sm:rounded-xl dark:border-neutral-800 dark:bg-neutral-900 ${
          visivel ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {etapa === "tipo" ? (
          <>
            <h2
              id={tituloId}
              className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Evento de {nome}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              O que aconteceu?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={salvando}
                onClick={() => setEtapa("assistencia")}
                className="cursor-pointer rounded-lg bg-[var(--cor-destaque)] px-3 py-3 text-sm font-medium text-white active:scale-95 disabled:opacity-40"
              >
                ⚽ Gol
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => onConfirmar("gol_contra", null)}
                className="cursor-pointer rounded-lg border border-red-300 px-3 py-3 text-sm font-medium text-red-600 active:scale-95 disabled:opacity-40 dark:border-red-900 dark:text-red-400"
              >
                Gol contra
              </button>
            </div>
            <button
              type="button"
              disabled={salvando}
              onClick={onClose}
              className="mt-3 w-full cursor-pointer rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <h2
              id={tituloId}
              className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Assistência no gol de {nome}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Quem deu o passe? Pode ficar sem assistência.
            </p>
            <button
              type="button"
              disabled={salvando}
              onClick={() => onConfirmar("gol", null)}
              className="mt-4 w-full cursor-pointer rounded-lg border border-neutral-300 px-3 py-3 text-sm font-medium text-neutral-800 active:scale-95 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200"
            >
              Sem assistência
            </button>
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {companheiros.map((c) => (
                <button
                  key={c.jogador_id}
                  type="button"
                  disabled={salvando}
                  onClick={() => onConfirmar("gol", c.jogador_id)}
                  className="w-full cursor-pointer rounded-lg bg-neutral-100 px-3 py-2.5 text-left text-sm font-medium text-neutral-900 active:scale-[0.99] disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-100"
                >
                  {formatarNome(c.nome ?? `#${c.jogador_id}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={salvando}
              onClick={() => setEtapa("tipo")}
              className="mt-3 w-full cursor-pointer rounded-lg px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400"
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
