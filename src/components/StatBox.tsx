import type { ReactNode } from 'react';

export interface StatBoxProps {
  /** Rótulo textual da métrica (ex.: "GOLS", "PARTIDAS", "ASSISTÊNCIAS") */
  label: string;
  /** Valor numérico ou textual em destaque */
  value: number | string;
  /** Classes CSS adicionais para o contêiner */
  className?: string;
  /** Elemento opcional adicional */
  extra?: ReactNode;
}

/**
 * Caixa de métrica estatística individual padronizada.
 * Segue a geometria com cantos rounded-[4px], borda padrão, sombra carimbo,
 * valor em font-mono tabular-nums e rótulo em font-display uppercase tracking-wider.
 */
export function StatBox({ label, value, className = '', extra }: StatBoxProps) {
  return (
    <div
      className={`rounded-[4px] border border-borda bg-superficie px-2 py-2.5 text-center shadow-carimbo ${className}`}
    >
      <div className="font-mono text-xl sm:text-2xl font-black text-destaque tabular-nums">
        {value}
      </div>
      <div className="font-display text-[10px] font-bold uppercase tracking-wider text-giz-fraco">
        {label}
      </div>
      {extra}
    </div>
  );
}
