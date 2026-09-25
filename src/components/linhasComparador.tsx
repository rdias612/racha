/** Helpers visuais compartilhados das seções de contexto do comparador. */

import type { LinhaConfronto } from '../lib/jogadores';

/** Produção de um atleta num contexto (juntos/adversos) do confronto. */
export function LinhaAtletaContexto({
  username,
  linha,
  comRetrospecto = false,
}: {
  username: string;
  linha: LinhaConfronto;
  comRetrospecto?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-giz">{username}</p>
        {comRetrospecto && (
          <p className="font-mono text-[11px] tabular-nums text-giz-fraco">
            {linha.vitorias}V {linha.empates}E {linha.derrotas}D
          </p>
        )}
      </div>
      <p className="shrink-0 font-mono text-[11px] tabular-nums text-giz-fraco">
        <span className="font-bold text-giz">{linha.gols}</span>G{' '}
        <span className="font-bold text-giz">{linha.assistencias}</span>A{' '}
        <span aria-hidden="true">·</span>{' '}
        {linha.media_nota != null ? linha.media_nota.toFixed(1) : '—'}
      </p>
    </div>
  );
}
