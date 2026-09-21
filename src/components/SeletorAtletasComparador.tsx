import type { JogadorLista } from '../lib/jogadores';

interface SeletorAtletasComparadorProps {
  jogadores: JogadorLista[];
  idA: number | null;
  idB: number | null;
  idLogado: number | null;
  aoMudarA: (id: number | null) => void;
  aoMudarB: (id: number | null) => void;
}

/** Selects A/B do comparador com bloqueio do mesmo atleta nos dois lados. */
export function SeletorAtletasComparador({
  jogadores,
  idA,
  idB,
  idLogado,
  aoMudarA,
  aoMudarB,
}: SeletorAtletasComparadorProps) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-[4px] border border-borda bg-superficie p-3 shadow-carimbo sm:grid-cols-2">
      <div className="space-y-1">
        <label
          htmlFor="select-atleta-a"
          className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco"
        >
          Atleta A
        </label>
        <select
          id="select-atleta-a"
          value={idA ?? ''}
          onChange={(e) => aoMudarA(e.target.value === '' ? null : Number(e.target.value))}
          className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
        >
          <option value="">Escolha o atleta…</option>
          {jogadores.map((j) => (
            <option key={j.id} value={j.id} disabled={j.id === idB}>
              {j.username}
              {j.id === idLogado ? ' (eu)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label
          htmlFor="select-atleta-b"
          className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco"
        >
          Atleta B
        </label>
        <select
          id="select-atleta-b"
          value={idB ?? ''}
          onChange={(e) => aoMudarB(e.target.value === '' ? null : Number(e.target.value))}
          className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base text-giz focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
        >
          <option value="">Escolha o adversário…</option>
          {jogadores.map((j) => (
            <option key={j.id} value={j.id} disabled={j.id === idA}>
              {j.username}
              {j.id === idLogado ? ' (eu)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
