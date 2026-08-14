/**
 * Utilitário de feedback tátil (Vibration API) com tema esportivo para interações no mobile.
 * Possui proteções contra erros em navegadores sem suporte ou em iOS Safari.
 */

function triggerVibration(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

/** Vibração sutil para toques leves, seleções e filtros */
export function vibrateLight() {
  triggerVibration(10);
}

/** Vibração média para confirmações de ações secundárias */
export function vibrateMedium() {
  triggerVibration(25);
}

/** Vibração de sucesso padrão (operações salvas, votos concluídos) */
export function vibrateSuccess() {
  triggerVibration([15, 50, 20]);
}

/** Vibração de erro (falha de rede, ações bloqueadas) */
export function vibrateError() {
  triggerVibration([40, 60, 40]);
}

/**
 * Vibração temática esportiva de GOL!
 * Pulso duplo empolgante comemorativo de balançar as redes.
 */
export function vibrateGoal() {
  triggerVibration([100, 60, 220]);
}

/**
 * Vibração temática esportiva de Apito do Juiz!
 * Padrão sonoro/tátil característico de início, fim ou falta grave.
 */
export function vibrateWhistle() {
  triggerVibration([180, 50, 80, 40, 90]);
}
