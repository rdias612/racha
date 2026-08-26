import type { ReactNode } from 'react';
import type { PosicaoId } from '../lib/times';
import type { StatusPartida, StatusConfirmacao } from '../lib/partidas';

export type BadgeVariante = 'posicao' | 'destaque' | 'ok' | 'perigo' | 'neutro' | 'status';

export type StatusBadge =
  | StatusPartida
  | StatusConfirmacao
  | 'aberta'
  | 'ao-vivo'
  | 'ao vivo'
  | 'finalizada'
  | 'encerrada'
  | 'confirmada'
  | 'recusada';

export interface BadgeProps {
  children?: ReactNode;
  variante?: BadgeVariante;
  status?: StatusBadge;
  posicao?: PosicaoId | string;
  className?: string;
  icone?: ReactNode;
}

const SIGLAS_POSICAO: Record<string, string> = {
  goleiro: 'GOL',
  zagueiro: 'ZAG',
  lateral: 'LAT',
  meia: 'MEI',
  atacante: 'ATA',
  random: 'RND',
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variante: BadgeVariante; showPulse?: boolean }
> = {
  draft: { label: 'Agendada', variante: 'neutro' },
  aberta: { label: 'Aberta', variante: 'neutro' },
  live: { label: 'Ao Vivo', variante: 'destaque', showPulse: true },
  'ao-vivo': { label: 'Ao Vivo', variante: 'destaque', showPulse: true },
  'ao vivo': { label: 'Ao Vivo', variante: 'destaque', showPulse: true },
  published: { label: 'Votação Aberta', variante: 'destaque' },
  closed: { label: 'Encerrada', variante: 'ok' },
  encerrada: { label: 'Encerrada', variante: 'ok' },
  finalizada: { label: 'Finalizada', variante: 'ok' },
  pendente: { label: 'Pendente', variante: 'neutro' },
  confirmado: { label: 'Confirmado', variante: 'ok' },
  confirmada: { label: 'Confirmada', variante: 'ok' },
  recusado: { label: 'Não vai', variante: 'perigo' },
  recusada: { label: 'Recusada', variante: 'perigo' },
};

const VARIANTE_CLASSES: Record<BadgeVariante, string> = {
  posicao: 'border-borda bg-superficie text-giz shadow-xs',
  destaque: 'border-destaque/60 bg-destaque/15 text-destaque-texto',
  ok: 'border-ok/40 bg-ok/10 text-ok',
  perigo: 'border-perigo/40 bg-perigo/10 text-perigo',
  neutro: 'border-borda bg-superficie-2 text-giz-fraco',
  status: 'border-borda bg-superficie-2 text-giz-fraco',
};

export function Badge({ children, variante, status, posicao, className = '', icone }: BadgeProps) {
  let resolvedVariante: BadgeVariante = variante ?? 'neutro';
  let defaultContent: ReactNode = children;
  let showPulse = false;

  if (posicao) {
    resolvedVariante = 'posicao';
    if (!defaultContent) {
      defaultContent = SIGLAS_POSICAO[posicao.toLowerCase()] ?? posicao.toUpperCase();
    }
  } else if (status) {
    const config = STATUS_CONFIG[status.toLowerCase()];
    if (config) {
      resolvedVariante = variante ?? config.variante;
      showPulse = Boolean(config.showPulse);
      if (!defaultContent) {
        defaultContent = config.label;
      }
    }
  }

  const baseClasses =
    'inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 font-display font-black uppercase tracking-widest text-[10px] leading-tight select-none';
  const variantClass = VARIANTE_CLASSES[resolvedVariante] ?? VARIANTE_CLASSES.neutro;

  return (
    <span className={`${baseClasses} ${variantClass} ${className}`}>
      {showPulse && (
        <span
          className="size-1.5 rounded-full bg-destaque animate-pulse shrink-0"
          aria-hidden="true"
        />
      )}
      {icone && <span className="shrink-0 flex items-center">{icone}</span>}
      {defaultContent}
    </span>
  );
}
