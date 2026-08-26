import { useId, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

export interface ModalBaseProps {
  open: boolean;
  onClose: () => void;
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  icone?: ReactNode;
  headerExtra?: ReactNode;
  tamanhoMaximo?: 'sm' | 'md' | 'lg';
  posicao?: 'bottom-sheet' | 'centro';
  mostrarBotaoFechar?: boolean;
  rodape?: ReactNode;
  children: ReactNode;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  disableEscape?: boolean;
}

const TAMANHOS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/**
 * Componente modal canônico com casca acessível, focus trap, portal e backdrop blur.
 */
export function ModalBase({
  open,
  onClose,
  titulo,
  subtitulo,
  icone,
  headerExtra,
  tamanhoMaximo = 'md',
  posicao = 'bottom-sheet',
  mostrarBotaoFechar = true,
  rodape,
  children,
  className = '',
  initialFocusRef,
  disableEscape = false,
}: ModalBaseProps) {
  const tituloId = useId();
  const subtituloId = useId();

  const { containerRef, handleKeyDown, visivel } = useModalA11y({
    open,
    onClose,
    initialFocusRef,
    disableEscape,
  });

  if (!open) return null;

  const temHeader = Boolean(titulo || icone || headerExtra || mostrarBotaoFechar);
  const isBottomSheet = posicao === 'bottom-sheet';

  return createPortal(
    <div
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-50 flex justify-center bg-black/75 backdrop-blur-xs animate-fade-in ${
        isBottomSheet ? 'items-end sm:items-center p-0 sm:p-4' : 'items-center p-3 sm:p-4'
      }`}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? tituloId : undefined}
        aria-describedby={subtitulo ? subtituloId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`w-full ${TAMANHOS[tamanhoMaximo]} max-h-[90vh] sm:max-h-[85vh] flex flex-col border-borda bg-superficie shadow-carimbo-preto text-giz overflow-hidden transition-normal ${
          isBottomSheet
            ? 'rounded-t-[6px] sm:rounded-[4px] border-t sm:border'
            : 'rounded-[4px] border'
        } ${visivel ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Cabeçalho */}
        {temHeader && (
          <div className="px-4 py-3 bg-superficie-2 border-b border-borda flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {icone && <span className="shrink-0">{icone}</span>}
              {headerExtra && <div className="shrink-0">{headerExtra}</div>}
              <div className="min-w-0">
                {titulo && (
                  <h3
                    id={tituloId}
                    className="font-display font-bold text-sm uppercase tracking-wider text-giz truncate"
                  >
                    {titulo}
                  </h3>
                )}
                {subtitulo && (
                  <p id={subtituloId} className="text-[11px] text-giz-fraco mt-0.5 truncate">
                    {subtitulo}
                  </p>
                )}
              </div>
            </div>

            {mostrarBotaoFechar && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar modal"
                className="p-1 rounded-[4px] text-giz-fraco hover:text-giz hover:bg-superficie transition min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-destaque-texto shrink-0 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}

        {/* Corpo rolável */}
        <div className={`flex-1 overflow-y-auto ${className}`}>{children}</div>

        {/* Rodapé opcional */}
        {rodape && (
          <div className="px-4 py-3 bg-superficie-2 border-t border-borda shrink-0">{rodape}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
