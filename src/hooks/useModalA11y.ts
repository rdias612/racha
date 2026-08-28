import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';

export interface UseModalA11yOptions {
  open: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  disableEscape?: boolean;
}

/**
 * Hook de acessibilidade para modais e diálogos (a11y):
 * - Trava de scroll no body (`overflow: hidden`) com restauração precisa;
 * - Fechamento pela tecla `Escape`;
 * - Foco inicial acessível (no elemento indicado ou primeiro interativo);
 * - Focus Trap circular para navegação via `Tab` / `Shift+Tab`;
 * - Restauração do foco para o elemento disparador ao fechar o diálogo.
 */
export function useModalA11y({
  open,
  onClose,
  initialFocusRef,
  disableEscape = false,
}: UseModalA11yOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const disableEscapeRef = useRef(disableEscape);
  const initialFocusRefRef = useRef(initialFocusRef);
  const [visivel, setVisivel] = useState(false);

  // Mantém referências de callbacks atualizadas sem re-disparar o efeito de abertura/foco
  useEffect(() => {
    onCloseRef.current = onClose;
    disableEscapeRef.current = disableEscape;
    initialFocusRefRef.current = initialFocusRef;
  });

  useEffect(() => {
    if (!open) {
      setVisivel(false);
      return;
    }

    // Armazena elemento que tinha foco antes de abrir
    triggerRef.current = document.activeElement as HTMLElement | null;

    setVisivel(false);
    const raf = requestAnimationFrame(() => setVisivel(true));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEscapeRef.current) {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Trava de scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Foco inicial: executado apenas uma vez ao abrir o modal
    const timeout = setTimeout(() => {
      if (initialFocusRefRef.current?.current) {
        initialFocusRefRef.current.current.focus();
      } else if (containerRef.current) {
        // Se um elemento interno já estiver focado (ex: autoFocus nativo no input), não rouba o foco
        if (
          document.activeElement &&
          containerRef.current.contains(document.activeElement) &&
          document.activeElement !== containerRef.current
        ) {
          return;
        }

        // Dá preferência a campos de entrada de texto com autoFocus ou inputs
        const autoFocusEl = containerRef.current.querySelector<HTMLElement>(
          '[autofocus], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
        );
        if (autoFocusEl) {
          autoFocusEl.focus();
          return;
        }

        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          containerRef.current.focus();
        }
      }
    }, 16);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;

      // Restaura o foco para o elemento original
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
        triggerRef.current = null;
      }
    };
  }, [open]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !containerRef.current) return;

    const focusable = containerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  return {
    containerRef,
    handleKeyDown,
    visivel,
  };
}
