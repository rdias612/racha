import { useId, useRef } from 'react';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../hooks/useModalA11y';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  titulo: string;
  mensagem?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  tomConfirmar?: 'destaque' | 'perigo';
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  titulo,
  mensagem,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  tomConfirmar = 'destaque',
}: ConfirmDialogProps) {
  const tituloId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { containerRef, handleKeyDown, visivel } = useModalA11y({
    open,
    onClose,
    initialFocusRef: confirmRef,
  });

  if (!open) return null;

  return createPortal(
    <div
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`w-full max-w-sm rounded-[4px] border-2 border-borda bg-superficie p-5 shadow-carimbo-preto transition-normal text-giz ${
          visivel ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <h2
          id={tituloId}
          className="font-display font-bold text-lg uppercase tracking-wide text-giz"
        >
          {titulo}
        </h2>
        {mensagem ? (
          <p className="text-xs text-giz-fraco mt-1.5 leading-relaxed font-sans">{mensagem}</p>
        ) : null}
        <div className="flex gap-2.5 mt-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center cursor-pointer rounded-[4px] border border-borda bg-superficie-2 font-display uppercase tracking-wider text-xs font-bold text-giz shadow-carimbo hover:bg-superficie transition-fast active:translate-y-px focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2"
          >
            {textoCancelar}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 min-h-[44px] inline-flex items-center justify-center cursor-pointer rounded-[4px] border font-display uppercase tracking-wider text-xs font-bold transition-fast active:translate-y-px focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2 ${
              tomConfirmar === 'perigo'
                ? 'border-perigo bg-perigo text-white hover:brightness-110 shadow-carimbo'
                : 'border-destaque bg-destaque text-destaque-tinta font-black hover:brightness-105 shadow-carimbo-destaque'
            }`}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
