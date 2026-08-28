import { Avatar } from './Avatar';
import type { NotaPartida } from '../lib/partidas';

export interface CardCraquePartidaProps {
  craque: NotaPartida;
}

export function CardCraquePartida({ craque }: CardCraquePartidaProps) {
  return (
    <div className="relative rounded-[4px] border-2 border-destaque bg-superficie p-4 text-center flex flex-col items-center gap-2 shadow-carimbo -rotate-1">
      {/* Fita adesiva translúcida no canto */}
      <div className="absolute -top-2.5 -right-2.5 w-10 h-3.5 bg-destaque/30 rotate-45 pointer-events-none rounded-xs border border-destaque/40" />

      <div className="bg-preto-time border border-destaque/40 text-destaque-texto font-display font-black text-xs uppercase tracking-[0.2em] px-4 py-0.5 rounded-[2px] shadow-xs">
        CRAQUE DA PARTIDA
      </div>

      <div className="flex items-center justify-center gap-4 my-1">
        <div className="text-right">
          <span className="block font-mono text-3xl sm:text-4xl font-black text-destaque-texto tabular-nums leading-none">
            {Number(craque.avg_rating).toFixed(1)}
          </span>
          <span className="text-[10px] font-mono text-giz-fraco uppercase">
            {craque.vote_count} votos
          </span>
        </div>
        <div className="ring-2 ring-destaque ring-offset-2 ring-offset-superficie rounded-[3px]">
          <Avatar username={craque.username} size="lg" />
        </div>
      </div>

      <p className="font-display font-bold text-lg uppercase tracking-wide text-giz">
        @{craque.username}
      </p>
    </div>
  );
}
