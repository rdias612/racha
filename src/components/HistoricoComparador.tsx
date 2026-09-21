import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import type { PartidaConfronto } from '../lib/jogadores';
import { MensagemEstado } from './Estado';
import { formatarDataLista } from '../lib/formatacao';
import { preCarregarRota } from '../lib/rotas';

// Badge compacta neutra (relação do confronto e empate) — mesmo padrão das
// badges de Estatisticas.tsx/Perfil.tsx.
const classeBadgeNeutra =
  'rounded-[2px] border border-borda bg-superficie-2 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-giz-fraco';

/**
 * Username do atleta que levou a melhor no duelo, ou null quando não há
 * vencedor (juntos/empate) ou quando o username do lado não foi resolvido (fallback
 * '—'): sem dono identificado, o troféu não renderiza — só o placar âmbar.
 */
function primeiroNomeVencedor(
  vencedor: 'a' | 'b' | null,
  usernameLadoA: string,
  usernameLadoB: string
): string | null {
  if (vencedor === null) return null;
  const username = (vencedor === 'a' ? usernameLadoA : usernameLadoB).trim();
  if (!username || username === '—') return null;
  return username;
}

interface HistoricoComparadorProps {
  historico: PartidaConfronto[];
  usernameA: string;
  usernameB: string;
  /** Resolve o vencedor do duelo numa partida ('a' | 'b' | null). */
  resolverVencedor: (partida: PartidaConfronto) => 'a' | 'b' | null;
}

/** Lista das últimas partidas entre os dois atletas, com links e prefetch. */
export function HistoricoComparador({
  historico,
  usernameA,
  usernameB,
  resolverVencedor,
}: HistoricoComparadorProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
        Últimos Confrontos
      </h3>
      {historico.length === 0 ? (
        <MensagemEstado tipo="info">
          Estes atletas ainda não se cruzaram em súmula nenhuma.
        </MensagemEstado>
      ) : (
        <div className="divide-y divide-borda/40 border-y border-borda">
          {historico.map((p) => {
            // gols_time_a/b são os gols dos times 'a'/'b' da partida;
            // time_a é o time do ATLETA A — inverte quando A jogou no branco.
            const golsA = p.time_a === 'a' ? p.gols_time_a : p.gols_time_b;
            const golsB = p.time_a === 'a' ? p.gols_time_b : p.gols_time_a;
            const destino = `/partida/${p.partida_id}`;
            const vencedor = resolverVencedor(p);
            const empate = p.relacao === 'adversos' && p.vencedor === 'empate';
            const nomeVencedor = primeiroNomeVencedor(vencedor, usernameA, usernameB);
            return (
              <Link
                key={p.partida_id}
                to={destino}
                onTouchStart={() => preCarregarRota(destino)}
                onMouseEnter={() => preCarregarRota(destino)}
                onFocus={() => preCarregarRota(destino)}
                className="flex min-h-[44px] items-center justify-between gap-2 px-1 py-2 transition hover:bg-superficie-2/50 focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
              >
                <span className="font-mono text-xs text-giz-fraco">
                  {formatarDataLista(p.data_jogo)}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-giz">
                  <span className={vencedor === 'a' ? 'text-destaque-texto' : undefined}>
                    {golsA}
                  </span>
                  {' × '}
                  <span className={vencedor === 'b' ? 'text-destaque-texto' : undefined}>
                    {golsB}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={classeBadgeNeutra}>
                    {p.relacao === 'juntos' ? 'Juntos' : 'Rival'}
                  </span>
                  {nomeVencedor && (
                    <span className="inline-flex max-w-28 items-center gap-1 rounded-[2px] bg-destaque px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-destaque-tinta">
                      <Trophy className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{nomeVencedor}</span>
                      <span className="sr-only">venceu o duelo</span>
                    </span>
                  )}
                  {empate && <span className={classeBadgeNeutra}>Empate</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
