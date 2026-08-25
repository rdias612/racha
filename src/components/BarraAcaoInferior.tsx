import type { ReactNode } from 'react';

export interface BarraAcaoInferiorProps {
  /** Elementos interativos principais (botões, CTAs) */
  children: ReactNode;
  /** Legenda explicativa ou texto de auxílio exibido abaixo dos botões */
  legenda?: ReactNode;
  /** Classes adicionais para o contêiner externo fixo */
  className?: string;
  /** Classes adicionais para o contêiner interno com largura máxima */
  innerClassName?: string;
}

/**
 * Barra de ação inferior fixa padronizada para telas de fluxo focado.
 * Inclui backdrop blur, borda superior, sombra carimbo e preenchimento
 * seguro para a área de gestos do sistema operacional (safe-area-inset-bottom).
 */
export function BarraAcaoInferior({
  children,
  legenda,
  className = '',
  innerClassName = '',
}: BarraAcaoInferiorProps) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 p-3 bg-superficie/95 backdrop-blur border-t border-borda shadow-carimbo-preto ${className}`}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className={`max-w-2xl mx-auto space-y-1 ${innerClassName}`}>
        {children}
        {legenda && (
          <p className="text-center text-[10px] font-mono text-giz-fraco">
            {legenda}
          </p>
        )}
      </div>
    </div>
  );
}
