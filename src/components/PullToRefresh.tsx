import { useState, useRef, type ReactNode, type TouchEvent } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  threshold?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 60,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const passedThreshold = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  function getScrollTop(): number {
    const main =
      containerRef.current?.closest("main") || document.querySelector("main");
    if (main) return main.scrollTop;
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (getScrollTop() <= 0 && e.touches.length === 1) {
      startY.current = e.touches[0].clientY;
      passedThreshold.current = false;
    }
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (startY.current === null || refreshing) return;
    if (getScrollTop() > 0) {
      setPullDistance(0);
      startY.current = null;
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      // Aplica resistência ao puxar
      const distance = Math.min(diff * 0.5, threshold * 1.5);
      setPullDistance(distance);

      if (distance >= threshold && !passedThreshold.current) {
        passedThreshold.current = true;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(15);
          } catch {
            // Ignora se não suportado
          }
        }
      } else if (distance < threshold && passedThreshold.current) {
        passedThreshold.current = false;
      }
    }
  }

  async function handleTouchEnd() {
    if (startY.current === null) return;
    startY.current = null;
    passedThreshold.current = false;

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
      ref={containerRef}
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
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 py-2">
            <div
              className={`w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full ${
                refreshing ? "animate-spin" : ""
              }`}
              style={{
                transform: refreshing
                  ? "none"
                  : `rotate(${Math.min(1, pullDistance / threshold) * 360}deg)`,
              }}
            />
            <span>
              {refreshing
                ? "Atualizando..."
                : pullDistance >= threshold
                ? "Solte para atualizar"
                : "Puxe para atualizar"}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
