import type { ReactNode } from 'react';
import type { TimeId } from '../lib/times';
import { TIMES } from '../lib/times';

export interface CabecalhoTimeProps {
  time: TimeId;
  titulo?: string;
  totalJogadores?: number;
  totalGoleiros?: number;
  variante?: 'card-header' | 'bloco-separado';
  acoes?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho de time para súmulas, cédulas de votação e telas de edição/escalação.
 * Utiliza tokens semânticos (`bg-preto-time`, `bg-branco-time`) e elimina hexadecimais inline.
 */
export function CabecalhoTime({
  time,
  titulo,
  totalJogadores,
  totalGoleiros,
  variante = 'card-header',
  acoes,
  children,
  className = '',
}: CabecalhoTimeProps) {
  const ehPreto = time === 'a';
  const nomeTime = titulo ?? TIMES[time].nome;

  const temContador = typeof totalJogadores === 'number';

  if (variante === 'bloco-separado') {
    return (
      <div
        className={`rounded-[4px] px-3.5 py-2.5 flex items-center justify-between shadow-carimbo border border-borda ${
          ehPreto ? 'bg-preto-time text-branco-time' : 'bg-branco-time text-preto-time'
        } ${className}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-display font-bold uppercase tracking-wider">
            {nomeTime}
          </span>
          {temContador && (
            <span
              className={`text-xs px-2 py-0.5 rounded-[2px] font-mono font-medium border border-borda ${
                ehPreto ? 'bg-superficie text-giz' : 'bg-superficie-2 text-giz'
              }`}
            >
              {totalJogadores} jogadores{' '}
              {typeof totalGoleiros === 'number' && totalGoleiros > 0 && `· 🧤 ${totalGoleiros}`}
            </span>
          )}
          {children}
        </div>
        {acoes && <div className="flex items-center gap-2">{acoes}</div>}
      </div>
    );
  }

  // variante === 'card-header'
  return (
    <div
      className={`px-3 py-2 text-xs font-display font-bold uppercase tracking-wider border-b border-borda flex items-center justify-between ${
        ehPreto ? 'bg-preto-time text-branco-time' : 'bg-branco-time text-preto-time'
      } ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span>{nomeTime}</span>
        {temContador && (
          <span className="font-mono font-normal opacity-80">({totalJogadores})</span>
        )}
      </div>
      {(acoes || children) && (
        <div className="flex items-center gap-2">
          {children}
          {acoes}
        </div>
      )}
    </div>
  );
}
