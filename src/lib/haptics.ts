/**
 * Utilitário para feedback tátil (Vibration API) com fallbacks defensivos
 * para dispositivos iOS / navegadores sem suporte.
 */

function vibrate(pattern: number | number[]): void {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignora silenciosamente em caso de erro de permissão
    }
  }
}

/**
 * Feedback ultraleve para toques em botões, abas e seletores (15ms).
 */
export function vibrateLight(): void {
  vibrate(15);
}

/**
 * Feedback comemorativo de sucesso / confirmação (duplo curto: [30, 40, 30]).
 */
export function vibrateSuccess(): void {
  vibrate([30, 40, 30]);
}

/**
 * Feedback de alerta ou violação de regra (ex: tentar escalar 2º goleiro).
 */
export function vibrateWarning(): void {
  vibrate([60, 50, 60]);
}

/**
 * Feedback de erro (padrão marcante: [50, 100, 50]).
 */
export function vibrateError(): void {
  vibrate([50, 100, 50]);
}

/**
 * Feedback especial de gol marcado (duplo comemorativo: [40, 60, 80]).
 */
export function vibrateGoal(): void {
  vibrate([40, 60, 80]);
}
