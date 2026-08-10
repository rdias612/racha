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

/**
 * Hook que controla a instalação do PWA.
 * - No Android/Chrome: captura `beforeinstallprompt` e permite chamar `instalar()`.
 * - No iOS: sinaliza `iosManual` para a UI mostrar instruções manuais.
 * - Se já estiver instalado (standalone), não oferece instalação.
 */
export function useInstalacaoPWA() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(isStandalone());
  const ios = isIOS();

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault(); // impede o banner automático do Chrome
      setEvento(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setEvento(null);
      setInstalado(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    setEvento(null);
  }

  // Só oferece instalação se: não está instalado E (tem evento no Android OU é iOS).
  const podeInstalar = !instalado && (!!evento || ios);

  return { podeInstalar, instalar, iosManual: ios && !instalado };
}
