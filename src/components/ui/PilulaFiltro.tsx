import type { ComponentProps } from 'react';

export interface PilulaFiltroProps extends ComponentProps<'button'> {
  /** Estado toggle da pílula; define o par ativo/inativo e o aria-pressed. */
  ativo: boolean;
}

/**
 * Pílula de filtro toggle (botão ativo/inativo) dos modais de gestão.
 * Garante alvo de toque acessível (min-h-[44px]) e `type="button"` com
 * `aria-pressed` centralizado. Padding/whitespace-nowrap são do call site
 * via `className`; rótulo vai como children.
 */
export function PilulaFiltro({ ativo, className, ...props }: PilulaFiltroProps) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={`min-h-[44px] rounded-[3px] font-display font-bold uppercase tracking-wider text-xs transition cursor-pointer ${
        ativo
          ? 'bg-destaque text-destaque-tinta shadow-carimbo'
          : 'border border-borda bg-superficie-2 text-giz-fraco hover:text-giz'
      } ${className ?? ''}`}
      {...props}
    />
  );
}
