import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Detecta iOS/Safari (não suporta beforeinstallprompt; instalação é manual
// via "Adicionar à Tela de Início" no Safari).
function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// Detecta se o app já está rodando em modo standalone (instalado).
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error - propriedade iOS específica
    window.navigator.standalone === true
  );
}

// --- Store module-level: o listener é registrado uma única vez no boot,
// independentemente da rota atual. Assim o preventDefault() sempre suprime
// o mini-infobar automático do Chrome, e o prompt fica disponível para o
// botão customizado em qualquer tela.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let instalado = isStandalone();
const ios = isIOS();
const ouvintes = new Set<() => void>();

function notificar() {
  ouvintes.forEach((o) => o());
}

function inscrever(cb: () => void) {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}

/**
 * Deve ser chamado uma vez no boot do app (main.tsx). Registra os listeners
 * globais de `beforeinstallprompt` e `appinstalled`.
 */
export function initPWA() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // impede o banner/mini-infobar automático do Chrome
    deferredPrompt = e as BeforeInstallPromptEvent;
    instalado = false;
    notificar();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    instalado = true;
    notificar();
  });
}

/** Dispara o prompt de instalação nativo (Android/Chrome). */
export async function instalar() {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  notificar();
}

/**
 * Hook reativo ao estado de instalação do PWA.
 * - Android/Chrome: `podeInstalar` true quando há prompt capturado.
 * - iOS: `iosManual` true para a UI mostrar instruções manuais.
 * - Se já estiver instalado, não oferece instalação.
 */
export function useInstalacaoPWA() {
  const [, setTick] = useState(0);
  useEffect(() => inscrever(() => setTick((t) => t + 1)), []);

  const podeInstalar = !instalado && (!!deferredPrompt || ios);
  return { podeInstalar, instalar, iosManual: ios && !instalado };
}
