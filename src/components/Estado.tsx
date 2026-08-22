import type { ReactNode } from 'react';

interface CarregandoProps {
  children: string;
  className?: string;
  compacto?: boolean;
}

export function Carregando({ children, className = '', compacto = false }: CarregandoProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mx-auto w-full max-w-2xl space-y-3 px-3 py-4 sm:px-4 ${className}`}
    >
      <span className="sr-only">{children}</span>
      {compacto ? (
        <div className="h-5 w-32 animate-pulse rounded-[4px] bg-superficie-2 border border-borda" />
      ) : (
        <>
          <div className="h-6 w-2/5 animate-pulse rounded-[4px] bg-superficie-2 border border-borda" />
          <div className="h-20 animate-pulse rounded-[4px] bg-superficie border border-borda" />
          <div className="h-20 animate-pulse rounded-[4px] bg-superficie border border-borda" />
        </>
      )}
    </div>
  );
}

type MensagemEstadoProps = {
  children: ReactNode;
  tipo?: 'erro' | 'sucesso' | 'info';
  className?: string;
};

export function MensagemEstado({ children, tipo = 'erro', className = '' }: MensagemEstadoProps) {
  const sucesso = tipo === 'sucesso';
  const informativa = tipo === 'info';

  return (
    <div
      role={sucesso || informativa ? 'status' : 'alert'}
      aria-live="polite"
      className={`rounded-[4px] border px-3.5 py-2.5 text-xs font-medium shadow-carimbo ${
        sucesso
          ? 'border-ok/40 bg-ok/10 text-ok'
          : informativa
            ? 'border-borda bg-superficie text-giz-fraco'
            : 'border-perigo/40 bg-perigo/10 text-perigo'
      } ${className}`}
    >
      {children}
    </div>
  );
}
