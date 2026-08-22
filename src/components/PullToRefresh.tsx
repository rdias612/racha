import { useState, useRef, type ReactNode, type TouchEvent } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  threshold?: number;
}

function getScrollTop(el: HTMLElement | null): number {
  let current: HTMLElement | null = el;
  while (current && current !== document.body && current !== document.documentElement) {
    if (current.scrollTop > 0) return current.scrollTop;
    current = current.parentElement;
  }
  return (
    (typeof window !== 'undefined' ? window.scrollY : 0) || document.documentElement?.scrollTop || 0
  );
}

export function PullToRefresh({ onRefresh, children, threshold = 60 }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    const scrollPos = getScrollTop(e.currentTarget);
    const touch = e.touches[0];
    if (scrollPos === 0 && e.touches.length === 1 && touch) {
      startY.current = touch.clientY;
    }
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (startY.current === null || refreshing) return;
    const scrollPos = getScrollTop(e.currentTarget);
    if (scrollPos > 0) {
      setPullDistance(0);
      startY.current = null;
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;
    const currentY = touch.clientY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      // Aplica resistência ao puxar
      const distance = Math.min(diff * 0.5, threshold * 1.5);
      setPullDistance(distance);
    }
  }

  async function handleTouchEnd() {
    if (startY.current === null) return;
    startY.current = null;

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-full overflow-hidden"
    >
      {/* Indicador visual de Pull */}
      {(pullDistance > 0 || refreshing) && (
        <div
          style={{ height: `${pullDistance}px` }}
          className="flex items-center justify-center transition-all duration-150 ease-out overflow-hidden"
        >
          <div className="flex items-center gap-2 text-xs font-mono text-giz-fraco py-2">
            <div
              className={`w-4 h-4 border-2 border-destaque border-t-transparent rounded-full ${
                refreshing ? 'animate-spin' : ''
              }`}
              style={{
                transform: refreshing
                  ? 'none'
                  : `rotate(${Math.min(1, pullDistance / threshold) * 360}deg)`,
              }}
            />
            <span>
              {refreshing
                ? 'Atualizando súmula...'
                : pullDistance >= threshold
                  ? 'Solte para atualizar'
                  : 'Puxe para atualizar'}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
