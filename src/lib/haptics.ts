/**
 * Utilitário de feedback tátil (Vibration API) para interações no mobile.
 * Possui proteções contra erros em navegadores sem suporte ou em iOS Safari.
 */

export function vibrateLight() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(10);
    } catch {
      /* ignore */
    }
  }
}

export function vibrateMedium() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(25);
    } catch {
      /* ignore */
    }
  }
}

export function vibrateSuccess() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([15, 50, 20]);
    } catch {
      /* ignore */
    }
  }
}

export function vibrateError() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([40, 60, 40]);
    } catch {
      /* ignore */
    }
  }
}
