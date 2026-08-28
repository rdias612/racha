import { useMemo } from 'react';
import { Avatar } from './Avatar';
import { CabecalhoTime } from './CabecalhoTime';
import type { TimeId } from '../lib/times';
import type { Participante } from '../lib/partidas';

export interface GridTimesPartidaProps {
  participantes: Participante[];
}

export function GridTimesPartida({ participantes }: GridTimesPartidaProps) {
  const participantesPorTime = useMemo(() => {
    return {
      a: participantes
        .filter((p) => p.time === 'a')
        .sort((a, b) => b.gols - a.gols || b.assistencias - a.assistencias),
      b: participantes
        .filter((p) => p.time === 'b')
        .sort((a, b) => b.gols - a.gols || b.assistencias - a.assistencias),
    };
  }, [participantes]);

  return (
    <div className="grid grid-cols-2 gap-3">
      {(['a', 'b'] as TimeId[]).map((t) => {
        const jogadoresDoTime = participantesPorTime[t] ?? [];
        return (
          <div
            key={t}
            className="rounded-[4px] border border-borda bg-superficie overflow-hidden shadow-carimbo"
          >
            <CabecalhoTime time={t} totalJogadores={jogadoresDoTime.length} />
            <div className="divide-y divide-borda">
              {jogadoresDoTime.map((p) => (
                <div
                  key={p.jogador_id}
                  className="flex items-center justify-between px-2.5 py-2 text-xs hover:bg-superficie-2 transition"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar username={p.username ?? ''} posicao={p.posicao} size="xs" />
                    <span className="truncate font-medium text-giz">
                      {p.username ? `@${p.username}` : `#${p.jogador_id}`}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 font-mono text-[11px]">
                    {p.gols > 0 && (
                      <span className="font-bold text-destaque-texto" title="Gols">
                        ⚽{p.gols}
                      </span>
                    )}
                    {p.assistencias > 0 && (
                      <span className="font-medium text-giz-fraco" title="Assistências">
                        🅰️{p.assistencias}
                      </span>
                    )}
                    {p.gols_contra > 0 && (
                      <span className="font-bold text-perigo" title="Gol contra">
                        GC:{p.gols_contra}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {jogadoresDoTime.length === 0 && (
                <div className="px-3 py-3 text-xs font-mono text-giz-fraco text-center">
                  Sem jogadores escalados
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
