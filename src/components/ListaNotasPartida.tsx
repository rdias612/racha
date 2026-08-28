import { useMemo } from 'react';
import { Avatar } from './Avatar';
import type { NotaPartida } from '../lib/partidas';

export interface ListaNotasPartidaProps {
  notas: NotaPartida[];
}

export function ListaNotasPartida({ notas }: ListaNotasPartidaProps) {
  const notasOrdenadas = useMemo(() => {
    return [...notas].sort(
      (a, b) => Number(b.avg_rating) - Number(a.avg_rating) || b.vote_count - a.vote_count
    );
  }, [notas]);

  return (
    <div className="rounded-[4px] border border-borda bg-superficie shadow-carimbo overflow-hidden">
      <div className="px-3 py-2 bg-superficie-2 border-b border-borda text-xs font-display font-bold uppercase tracking-wider text-giz">
        Notas da Partida (Súmula)
      </div>
      <div className="divide-y divide-borda">
        {notasOrdenadas.map((n) => (
          <div
            key={n.target_id}
            className="flex items-center justify-between px-3 py-2 text-sm hover:bg-superficie-2 transition"
          >
            <div className="flex items-center gap-2 text-giz">
              <Avatar username={n.username} size="xs" />
              <span className="font-medium">
                {n.is_craque ? '⭐ ' : ''}@{n.username}
              </span>
            </div>
            <span className="font-mono text-sm font-bold text-destaque-texto tabular-nums">
              {Number(n.avg_rating).toFixed(1)}{' '}
              <span className="text-xs font-normal text-giz-fraco font-mono">
                ({n.vote_count}v)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
