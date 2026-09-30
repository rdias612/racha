import { useState } from 'react';
import { useInstalacaoPWA } from '../lib/pwa';
import { vibrateLight, vibrateSuccess } from '../lib/haptics';
import { Botao } from './ui/Botao';

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
    vibrateLight();
    setInstalando(true);
    await instalar();
    vibrateSuccess();
    setInstalando(false);
  }

  function handleToggleManual() {
    vibrateLight();
    setExpandido((v) => !v);
  }

  return (
    <section className="rounded-[4px] border border-destaque/40 bg-destaque/10 p-3.5 shadow-carimbo space-y-2">
      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-destaque-texto flex items-center gap-1.5">
        <span aria-hidden="true">📲</span> Instalar App na Tela Inicial
      </h3>

      {!iosManual ? (
        <>
          <p className="text-xs text-giz-fraco leading-relaxed">
            Adicione a Súmula de Quinta à tela inicial para acesso instantâneo em campo, sem barra
            do navegador.
          </p>
          <Botao type="button" onClick={handleClick} disabled={instalando} larguraCompleta>
            {instalando ? 'Instalando…' : 'Instalar Aplicativo'}
          </Botao>
        </>
      ) : (
        <>
          <p className="text-xs text-giz-fraco leading-relaxed">
            No iPhone / iPad, a instalação é feita pelo Safari:
          </p>
          <Botao
            type="button"
            variante="secundario"
            onClick={handleToggleManual}
            larguraCompleta
            className="cursor-pointer"
          >
            {expandido ? 'Ocultar passo a passo ▴' : 'Ver passo a passo ▾'}
          </Botao>
          {expandido && (
            <ol className="space-y-1.5 text-xs text-giz-fraco font-mono pl-1 pt-1">
              <li>
                <strong className="text-giz">1.</strong> Toque no botão{' '}
                <strong className="text-giz">Compartilhar</strong> <span aria-hidden="true">⎋</span>{' '}
                na barra do Safari.
              </li>
              <li>
                <strong className="text-giz">2.</strong> Role e toque em{' '}
                <strong className="text-giz">"Adicionar à Tela de Início"</strong>.
              </li>
              <li>
                <strong className="text-giz">3.</strong> Confirme. O ícone da Súmula de Quinta
                aparecerá na sua tela.
              </li>
            </ol>
          )}
        </>
      )}
    </section>
  );
}
