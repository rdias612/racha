import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';

interface CarregandoProps {
  children?: ReactNode;
  className?: string;
  compacto?: boolean;
}

export function Carregando({
  children = 'Carregando dados da súmula…',
  className = '',
  compacto = false,
}: CarregandoProps) {
  if (compacto) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2 py-2 text-xs font-display uppercase tracking-wider text-giz-fraco ${className}`}
      >
        <Loader2 className="size-3.5 animate-spin text-destaque" aria-hidden="true" />
        <span>{children}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mx-auto w-full max-w-2xl space-y-4 px-3 py-6 sm:px-4 ${className}`}
    >
      <div className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-giz-fraco">
        <Loader2 className="size-4 animate-spin text-destaque" aria-hidden="true" />
        <span>{children}</span>
      </div>
      <div className="space-y-3">
        <div className="h-6 w-2/5 animate-pulse rounded-[4px] bg-superficie-2 border border-borda" />
        <div className="h-20 animate-pulse rounded-[4px] bg-superficie border border-borda shadow-carimbo" />
        <div className="h-20 animate-pulse rounded-[4px] bg-superficie border border-borda shadow-carimbo" />
      </div>
    </div>
  );
}

export type TipoMensagemEstado = 'erro' | 'sucesso' | 'info';

export interface MensagemEstadoProps {
  children: ReactNode;
  tipo?: TipoMensagemEstado;
  className?: string;
  icone?: ReactNode;
}

const ICONES_ESTADO: Record<TipoMensagemEstado, typeof AlertCircle> = {
  erro: AlertCircle,
  sucesso: CheckCircle2,
  info: Info,
};

const ESTILOS_ESTADO: Record<TipoMensagemEstado, string> = {
  erro: 'border-perigo/40 bg-perigo/10 text-perigo',
  sucesso: 'border-ok/40 bg-ok/10 text-ok',
  info: 'border-borda bg-superficie text-giz',
};

export function MensagemEstado({
  children,
  tipo = 'erro',
  className = '',
  icone,
}: MensagemEstadoProps) {
  const IconePadrao = ICONES_ESTADO[tipo];
  const isAlert = tipo === 'erro';

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live="polite"
      className={`flex items-start gap-2.5 rounded-[4px] border px-3.5 py-2.5 text-xs font-medium shadow-carimbo transition-normal ${ESTILOS_ESTADO[tipo]} ${className}`}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icone ?? <IconePadrao className="size-4" />}
      </span>
      <div className="flex-1 min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}
