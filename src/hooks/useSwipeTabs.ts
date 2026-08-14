import { useRef, useCallback, type TouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import { vibrateLight } from "../lib/haptics";

export interface UseSwipeTabsOptions {
  /**
   * Lista ordenada de caminhos (rotas) ou identificadores de abas.
   * Ex: ['/ranking/pontos', '/ranking/gols', '/ranking/assistencias', '/ranking/gols-contra']
   */
  tabs: string[];
  /**
   * Aba atualmente ativa (deve corresponder a um dos itens em `tabs`).
   */
  activeTab: string;
  /**
   * Callback opcional ao mudar de aba. Se não for fornecido, usará `navigate(novaAba)`.
   */
  onChangeTab?: (newTab: string, index: number) => void;
  /**
   * Distância horizontal mínima em pixels para considerar swipe (padrão: 50).
   */
  threshold?: number;
  /**
   * Deslocamento vertical máximo permitido antes de travar o swipe e liberar o scroll nativo (padrão: 35).
   */
  verticalThreshold?: number;
  /**
   * Permite desabilitar o gesto de swipe (ex: durante modais ou inputs específicos).
   */
  disabled?: boolean;
}

/**
 * Hook de gestos touch para navegação horizontal entre abas com trava de scroll vertical
 * e feedback háptico sutil (vibrateLight).
 */
export function useSwipeTabs({
  tabs,
  activeTab,
  onChangeTab,
  threshold = 50,
  verticalThreshold = 35,
  disabled = false,
}: UseSwipeTabsOptions) {
  const navigate = useNavigate();
  const startCoords = useRef<{ x: number; y: number; time: number } | null>(null);
  const isVerticalScroll = useRef<boolean>(false);
  const isHorizontalSwipe = useRef<boolean>(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      if (disabled || e.touches.length !== 1) return;

      const target = e.target as HTMLElement | null;
      // Não intercepta toques iniciados em sliders, selects ou áreas demarcadas
      if (
        target?.closest('input[type="range"], select, textarea, [data-no-swipe]')
      ) {
        startCoords.current = null;
        return;
      }

      const touch = e.touches[0];
      startCoords.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      isVerticalScroll.current = false;
      isHorizontalSwipe.current = false;
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      if (disabled || !startCoords.current || e.touches.length !== 1) return;
      if (isVerticalScroll.current) return; // Scroll vertical assumiu o controle

      const touch = e.touches[0];
      const deltaX = touch.clientX - startCoords.current.x;
      const deltaY = touch.clientY - startCoords.current.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Trava vertical precoce: se o movimento vertical for dominante, desativa o swipe
      if (!isHorizontalSwipe.current) {
        if (absY > verticalThreshold || (absY > 12 && absY > absX)) {
          isVerticalScroll.current = true;
          return;
        }

        // Se o movimento horizontal for nítido e dominante
        if (absX > 15 && absX > absY * 1.5) {
          isHorizontalSwipe.current = true;
        }
      }
    },
    [disabled, verticalThreshold]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      if (disabled || !startCoords.current || isVerticalScroll.current) {
        startCoords.current = null;
        isVerticalScroll.current = false;
        isHorizontalSwipe.current = false;
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) {
        startCoords.current = null;
        return;
      }

      const deltaX = touch.clientX - startCoords.current.x;
      const deltaY = touch.clientY - startCoords.current.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const elapsedTime = Date.now() - startCoords.current.time;

      startCoords.current = null;
      isVerticalScroll.current = false;
      isHorizontalSwipe.current = false;

      // Validação do gesto:
      // 1. Distância mínima no eixo X
      // 2. Movimento horizontal significativamente maior que o vertical
      // 3. Tempo razoável para um gesto (swipe dinâmico < 800ms)
      if (absX >= threshold && absX > absY * 1.2 && elapsedTime < 800) {
        const currentIndex = tabs.indexOf(activeTab);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex;

        if (deltaX < 0) {
          // Swipe para a esquerda (<-) -> Próxima aba
          if (currentIndex < tabs.length - 1) {
            nextIndex = currentIndex + 1;
          }
        } else {
          // Swipe para a direita (->) -> Aba anterior
          if (currentIndex > 0) {
            nextIndex = currentIndex - 1;
          }
        }

        if (nextIndex !== currentIndex) {
          vibrateLight();
          const targetTab = tabs[nextIndex];
          if (onChangeTab) {
            onChangeTab(targetTab, nextIndex);
          } else {
            navigate(targetTab);
          }
        }
      }
    },
    [activeTab, disabled, navigate, onChangeTab, tabs, threshold]
  );

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
