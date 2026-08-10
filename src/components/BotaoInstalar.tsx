import { useState } from "react";
import { useInstalacaoPWA } from "../lib/pwa";

/**
 * Cartão de instalação do PWA.
 * - Android/Chrome: mostra botão "Instalar app" que dispara o prompt nativo.
 * - iOS/Safari: mostra instruções manuais ("Compartilhar → Adicionar à Tela de Início").
 * - Some completamente quando o app já está instalado (standalone) ou quando
 *   o navegador não oferece instalação.
 */
export function BotaoInstalar() {
  const { podeInstalar, instalar, iosManual } = useInstalacaoPWA();
  const [expandido, setExpandido] = useState(false);
  const [instalando, setInstalando] = useState(false);

  if (!podeInstalar && !iosManual) return null;

  async function handleClick() {
    setInstalando(true);
    await instalar();
    setInstalando(false);
  }

  return (
    <section className="rounded-lg border border-(--cor-destaque)/30 bg-(--cor-destaque)/10 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-(--cor-destaque)">
        📲 Instalar app
      </h3>

      {!iosManual ? (
        <>
          <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            Adicione o Racha à tela inicial para abrir como um app, sem a barra
            do navegador.
          </p>
          <button
            onClick={handleClick}
            disabled={instalando}
            className="mt-2.5 w-full rounded-lg bg-(--cor-destaque) px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {instalando ? "Instalando…" : "Instalar app"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            No iPhone, a instalação é feita pelo Safari:
          </p>
          <button
            onClick={() => setExpandido((v) => !v)}
            className="mt-2 w-full rounded-lg border border-(--cor-destaque)/40 px-4 py-2 text-sm font-medium text-(--cor-destaque)"
          >
            {expandido ? "Ver passo a passo ▴" : "Ver passo a passo ▾"}
          </button>
          {expandido && (
            <ol className="mt-2.5 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300">
              <li>
                <strong>1.</strong> Toque no botão <strong>Compartilhar</strong>{" "}
                <span aria-hidden="true">⎋</span> na barra do Safari.
              </li>
              <li>
                <strong>2.</strong> Role e toque em{" "}
                <strong>"Adicionar à Tela de Início"</strong>.
              </li>
              <li>
                <strong>3.</strong> Confirme. O ícone do Racha aparece na tela
                inicial.
              </li>
            </ol>
          )}
        </>
      )}
    </section>
  );
}
