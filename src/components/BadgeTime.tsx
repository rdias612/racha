import type { TimeId } from '../lib/times';
import { TIMES } from '../lib/times';

export interface BadgeTimeProps {
  time: TimeId;
  label?: string;
  tamanho?: 'xs' | 'sm' | 'md';
  className?: string;
}

const TAMANHOS = {
  xs: 'text-[10px] px-1.5 py-0.5 leading-none',
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

/**
 * Badge visual de time (Time Preto / Time Branco) com tokens semânticos.
 */
export function BadgeTime({
  time,
  label,
  tamanho = 'sm',
  className = '',
}: BadgeTimeProps) {
  const ehPreto = time === 'a';
  const texto = label ?? TIMES[time].nome;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-[2px] border font-display font-black uppercase tracking-widest shadow-xs ${
        ehPreto
          ? 'bg-preto-time text-branco-time border-led-borda'
          : 'bg-branco-time text-preto-time border-borda'
      } ${TAMANHOS[tamanho]} ${className}`}
    >
      {texto}
    </span>
  );
}
