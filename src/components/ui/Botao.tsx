import type { ButtonHTMLAttributes } from 'react';

export type VarianteBotao = 'primario' | 'secundario' | 'perigo';

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 'primario' (padrão), 'secundario' e 'perigo'. */
  variante?: VarianteBotao;
  /** Ocupa a largura total (w-full): rodapés de modal, submits. */
  larguraCompleta?: boolean;
  /** Escape de layout/dimensão (ex.: 'flex-1'); entra por último. Não use para cor ou sombra. */
  className?: string;
}

const CLASSES_BASE =
  'min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-[4px] border font-display font-bold uppercase tracking-wider text-xs transition active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2';

const VARIANTE_CLASSES: Record<VarianteBotao, string> = {
  primario: 'border-destaque bg-destaque text-destaque-tinta shadow-carimbo hover:brightness-105',
  secundario: 'border-borda bg-superficie-2 text-giz shadow-xs hover:bg-superficie',
  perigo: 'border-perigo bg-perigo text-branco-time shadow-carimbo hover:brightness-110',
};

/**
 * Botão de ação padronizado dos três papéis do Design System "Súmula de Quinta".
 * Garante alvo de toque acessível (min-h-[44px]), foco acessível âmbar, estado
 * desabilitado legível e `type="button"` por padrão (submit só quando declarado).
 * Ícones vão como children, não como prop.
 */
export function Botao({
  variante = 'primario',
  larguraCompleta,
  className,
  type = 'button',
  ...resto
}: BotaoProps) {
  return (
    <button
      {...resto}
      type={type}
      className={`${CLASSES_BASE} ${VARIANTE_CLASSES[variante]} ${larguraCompleta ? 'w-full ' : ''}${className ?? ''}`}
    />
  );
}
