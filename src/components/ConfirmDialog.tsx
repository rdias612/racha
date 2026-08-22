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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`w-full max-w-sm rounded-[6px] border-2 border-borda bg-superficie p-5 shadow-carimbo-preto transition text-giz ${
          visivel ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <h2
          id={tituloId}
          className="font-display font-bold text-lg uppercase tracking-wide text-giz"
        >
          {titulo}
        </h2>
        {mensagem ? (
          <p className="text-xs text-giz-fraco mt-1.5 leading-relaxed">
            {mensagem}
          </p>
        ) : null}
        <div className="flex gap-2.5 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] cursor-pointer rounded-[4px] border border-borda bg-superficie-2 font-display uppercase tracking-wider text-xs font-bold text-giz shadow-carimbo hover:bg-superficie transition active:translate-y-px"
          >
            {textoCancelar}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 min-h-[44px] cursor-pointer rounded-[4px] border font-display uppercase tracking-wider text-xs font-bold shadow-carimbo transition active:translate-y-px ${
              tomConfirmar === "perigo"
                ? "border-perigo bg-perigo text-white hover:brightness-110"
                : "border-destaque bg-destaque text-destaque-tinta hover:brightness-105"
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
