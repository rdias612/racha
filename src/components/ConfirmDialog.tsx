import { useEffect, useId, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  titulo: string;
  mensagem?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  tomConfirmar?: "destaque" | "perigo";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  titulo,
  mensagem,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  tomConfirmar = "destaque",
}: ConfirmDialogProps) {
  const tituloId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!open) return;

    setVisivel(false);
    const raf = requestAnimationFrame(() => setVisivel(true));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    (confirmRef.current ?? cardRef.current)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`w-full max-w-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-xl transition ${
          visivel ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <h2
          id={tituloId}
          className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
        >
          {titulo}
        </h2>
        {mensagem ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {mensagem}
          </p>
        ) : null}
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] cursor-pointer rounded-lg font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 active:scale-95 transition"
          >
            {textoCancelar}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 min-h-[44px] cursor-pointer rounded-lg font-medium text-white active:scale-95 transition ${
              tomConfirmar === "perigo"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-destaque hover:brightness-110"
            }`}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
