import { useState, useRef, type ReactNode, type TouchEvent } from 'react';
import { vibrateLight } from '../lib/haptics';

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
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullDistance = useRef(0);
  const cruzouThreshold = useRef(false);

  const indicatorRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const textoRef = useRef<HTMLSpanElement>(null);

  function atualizarIndicador(dist: number, atingiu: boolean) {
    if (!indicatorRef.current) return;
    indicatorRef.current.style.height = `${dist}px`;
    indicatorRef.current.style.opacity = dist > 0 ? '1' : '0';

    if (spinnerRef.current) {
      const rot = Math.min(1, dist / threshold) * 360;
      spinnerRef.current.style.transform = `rotate(${rot}deg)`;
    }
    if (textoRef.current) {
      textoRef.current.textContent = atingiu ? 'Solte para atualizar' : 'Puxe para atualizar';
    }
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (refreshing) return;
    const scrollPos = getScrollTop(e.currentTarget);
    const touch = e.touches[0];
    if (scrollPos === 0 && e.touches.length === 1 && touch) {
      startY.current = touch.clientY;
      pullDistance.current = 0;
      cruzouThreshold.current = false;
    } else {
      startY.current = null;
    }
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (startY.current === null || refreshing) return;

    const touch = e.touches[0];
    if (!touch) return;
    const diff = touch.clientY - startY.current;

    if (diff <= 0) {
      if (pullDistance.current > 0) {
        pullDistance.current = 0;
        atualizarIndicador(0, false);
      }
      return;
    }

    // Aplica resistência ao puxar
    const distance = Math.min(diff * 0.5, threshold * 1.5);
    pullDistance.current = distance;

    const atingiu = distance >= threshold;
    if (atingiu !== cruzouThreshold.current) {
      cruzouThreshold.current = atingiu;
      if (atingiu) vibrateLight();
    }

    atualizarIndicador(distance, atingiu);
  }

  async function handleTouchEnd() {
    if (startY.current === null || refreshing) return;
    startY.current = null;

    const dist = pullDistance.current;
    const atingiu = dist >= threshold;

    if (atingiu) {
      setRefreshing(true);
      if (indicatorRef.current) {
        indicatorRef.current.style.height = `${threshold}px`;
        indicatorRef.current.style.opacity = '1';
      }
      if (textoRef.current) {
        textoRef.current.textContent = 'Atualizando súmula...';
      }
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        pullDistance.current = 0;
        cruzouThreshold.current = false;
        if (indicatorRef.current) {
          indicatorRef.current.style.height = '0px';
          indicatorRef.current.style.opacity = '0';
        }
      }
    } else {
      pullDistance.current = 0;
      cruzouThreshold.current = false;
      if (indicatorRef.current) {
        indicatorRef.current.style.height = '0px';
        indicatorRef.current.style.opacity = '0';
      }
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-full overflow-hidden"
    >
      {/* Indicador visual de Pull (controlado via DOM ref para 60fps sem disparar re-render no touchmove) */}
      <div
        ref={indicatorRef}
        style={{ height: '0px', opacity: 0 }}
        className="flex items-center justify-center transition-[height,opacity] duration-150 ease-out overflow-hidden"
      >
        <div className="flex items-center gap-2 text-xs font-mono text-giz-fraco py-2">
          <div
            ref={spinnerRef}
            className={`w-4 h-4 border-2 border-destaque border-t-transparent rounded-full ${
              refreshing ? 'animate-spin' : ''
            }`}
          />
          <span ref={textoRef}>{refreshing ? 'Atualizando súmula...' : 'Puxe para atualizar'}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
