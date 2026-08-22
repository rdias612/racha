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
    <section className="rounded-[4px] border border-destaque/40 bg-destaque/10 p-3.5 shadow-carimbo">
      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-destaque flex items-center gap-1.5">
        <span>📲</span> Instalar App na Tela Inicial
      </h3>

      {!iosManual ? (
        <>
          <p className="mt-1.5 text-xs text-giz-fraco">
            Adicione a Súmula de Quinta à tela inicial para acesso instantâneo em campo, sem barra do navegador.
          </p>
          <button
            onClick={handleClick}
            disabled={instalando}
            className="mt-3 w-full min-h-[44px] rounded-[3px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo hover:brightness-105 active:translate-y-px transition disabled:opacity-50"
          >
            {instalando ? "Instalando…" : "Instalar Aplicativo"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-xs text-giz-fraco">
            No iPhone / iPad, a instalação é feita pelo Safari:
          </p>
          <button
            onClick={() => setExpandido((v) => !v)}
            className="mt-2.5 w-full min-h-[40px] rounded-[3px] border border-destaque/50 bg-superficie px-4 py-2 font-display font-bold uppercase tracking-wider text-xs text-destaque hover:bg-superficie-2 transition"
          >
            {expandido ? "Ocultar passo a passo ▴" : "Ver passo a passo ▾"}
          </button>
          {expandido && (
            <ol className="mt-2.5 space-y-1.5 text-xs text-giz-fraco font-mono">
              <li>
                <strong className="text-giz">1.</strong> Toque no botão <strong className="text-giz">Compartilhar</strong>{" "}
                <span aria-hidden="true">⎋</span> na barra do Safari.
              </li>
              <li>
                <strong className="text-giz">2.</strong> Role e toque em{" "}
                <strong className="text-giz">"Adicionar à Tela de Início"</strong>.
              </li>
              <li>
                <strong className="text-giz">3.</strong> Confirme. O ícone da Súmula de Quinta aparecerá na sua tela.
              </li>
            </ol>
          )}
        </>
      )}
    </section>
  );
}
