import type { LinhaConfronto } from '../lib/jogadores';
import { MensagemEstado } from './Estado';
import { LinhaAtletaContexto } from './linhasComparador';

interface SecaoAdversosComparadorProps {
  usernameA: string;
  usernameB: string;
  linhaA: LinhaConfronto | undefined;
  linhaB: LinhaConfronto | undefined;
}

/** Retrospecto quando os dois atletas jogam em times opostos. */
export function SecaoAdversosComparador({
  usernameA,
  usernameB,
  linhaA,
  linhaB,
}: SecaoAdversosComparadorProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
        Quando se Enfrentam
      </h3>
      {linhaA && linhaA.partidas > 0 ? (
        <div className="space-y-2.5 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo">
          <div className="border-b border-borda pb-2">
            <span className="font-mono text-[11px] text-giz-fraco">
              {linhaA.partidas}{' '}
              {linhaA.partidas === 1 ? 'duelo em campos opostos' : 'duelos em campos opostos'}
            </span>
          </div>
          <LinhaAtletaContexto username={usernameA} linha={linhaA} comRetrospecto />
          {linhaB && (
            <LinhaAtletaContexto username={usernameB} linha={linhaB} comRetrospecto />
          )}
        </div>
      ) : (
        <MensagemEstado tipo="info">
          Ainda não se enfrentaram em campos opostos.
        </MensagemEstado>
      )}
    </section>
  );
}
