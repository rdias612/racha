import type { LinhaConfronto } from '../lib/jogadores';
import { MensagemEstado } from './Estado';
import { LinhaAtletaContexto } from './linhasComparador';

interface SecaoJuntosComparadorProps {
  usernameA: string;
  usernameB: string;
  linhaA: LinhaConfronto | undefined;
  linhaB: LinhaConfronto | undefined;
}

/** Retrospecto quando os dois atletas jogam no mesmo time. */
export function SecaoJuntosComparador({
  usernameA,
  usernameB,
  linhaA,
  linhaB,
}: SecaoJuntosComparadorProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
        Quando Vestem o Mesmo Manto
      </h3>
      {linhaA && linhaA.partidas > 0 ? (
        <div className="space-y-2.5 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div className="flex items-center justify-between gap-2 border-b border-borda pb-2">
            <span className="font-mono text-[11px] text-giz-fraco">
              {linhaA.partidas}{' '}
              {linhaA.partidas === 1 ? 'partida no mesmo time' : 'partidas no mesmo time'}
            </span>
            <span className="font-mono text-xs font-bold tabular-nums text-giz">
              {linhaA.vitorias}V {linhaA.empates}E {linhaA.derrotas}D
            </span>
          </div>
          <LinhaAtletaContexto username={usernameA} linha={linhaA} />
          {linhaB && <LinhaAtletaContexto username={usernameB} linha={linhaB} />}
        </div>
      ) : (
        <MensagemEstado tipo="info">Ainda não dividiram o mesmo time.</MensagemEstado>
      )}
    </section>
  );
}
