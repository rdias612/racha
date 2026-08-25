import { useEffect, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { vibrateLight } from '../lib/haptics';

export interface OpcaoModal {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface ModalSelecionarOpcaoProps {
  open: boolean;
  titulo: string;
  subtitulo?: string;
  opcoes: OpcaoModal[];
  valorAtual: string;
  onSelecionar: (value: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet / modal de seleção única para substituir `<select>` nativo.
 * Alinhado à identidade visual "Súmula de Quinta" com toque mínimo de 44px,
 * haptics, fechamento por Escape e backdrop desfocado.
 */
export function ModalSelecionarOpcao({
  open,
  titulo,
  subtitulo,
  opcoes,
  valorAtual,
  onSelecionar,
  onClose,
}: ModalSelecionarOpcaoProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleSelecionar(value: string) {
    vibrateLight();
    onSelecionar(value);
    onClose();
  }

  return createPortal(
    <div
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md max-h-[80vh] sm:max-h-[70vh] flex flex-col rounded-t-[6px] sm:rounded-[4px] border-t sm:border border-borda bg-superficie shadow-carimbo-preto text-giz overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Cabeçalho */}
        <div className="px-4 py-3 bg-superficie-2 border-b border-borda flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz truncate">
              {titulo}
            </h3>
            {subtitulo && (
              <p className="text-[11px] text-giz-fraco mt-0.5">{subtitulo}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1 rounded-[4px] text-giz-fraco hover:text-giz hover:bg-superficie transition min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-destaque shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Lista de opções */}
        <div className="overflow-y-auto flex-1 p-2 sm:p-3 space-y-1">
          {opcoes.map((opcao) => {
            const selecionado = opcao.value === valorAtual;
            return (
              <button
                key={opcao.value}
                type="button"
                disabled={opcao.disabled}
                onClick={() => handleSelecionar(opcao.value)}
                className={`w-full min-h-[48px] px-3 py-2.5 rounded-[4px] flex items-center justify-between gap-3 text-left transition border active:translate-y-px ${
                  selecionado
                    ? 'border-destaque bg-destaque/15 shadow-xs'
                    : opcao.disabled
                      ? 'border-transparent opacity-40 cursor-not-allowed bg-superficie-2/30'
                      : 'border-transparent bg-superficie hover:bg-superficie-2 hover:border-borda cursor-pointer'
                }`}
              >
                <div className="min-w-0">
                  <span
                    className={`font-display text-sm uppercase tracking-wider ${
                      selecionado ? 'font-bold text-destaque' : 'font-bold text-giz'
                    }`}
                  >
                    {opcao.label}
                  </span>
                  {opcao.sublabel && (
                    <span className="block text-[10px] font-mono text-giz-fraco mt-0.5">
                      {opcao.sublabel}
                    </span>
                  )}
                </div>
                {selecionado && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-destaque/20 border border-destaque text-destaque text-[11px] font-mono font-bold shrink-0">
                    <Check className="size-3" />
                    Selecionado
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Rodapé */}
        <div className="p-3 bg-superficie-2 border-t border-borda shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie text-xs font-display font-bold uppercase tracking-wider text-giz hover:bg-superficie-2 transition active:translate-y-px shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
