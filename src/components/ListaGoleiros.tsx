import type { JogadorLista } from '../lib/jogadores';
import { LinhaGoleiro } from './LinhaGoleiro';

interface ListaGoleirosProps {
  goleiros: JogadorLista[];
  editandoId: number | null;
  editTelefone: string;
  editChavePix: string;
  salvandoEdicao: boolean;
  copiadoId: number | null;
  aoMudarTelefone: (valor: string) => void;
  aoMudarChavePix: (valor: string) => void;
  aoIniciarEdicao: (goleiro: JogadorLista) => void;
  aoSalvarEdicao: (id: number) => void;
  aoCancelarEdicao: () => void;
  aoCopiarPix: (id: number, pix: string) => void;
  aoPedirAlternanciaStatus: (goleiro: JogadorLista) => void;
}

/** Listagem contínua de goleiros: vazio, separadores e linhas. */
export function ListaGoleiros({
  goleiros,
  editandoId,
  editTelefone,
  editChavePix,
  salvandoEdicao,
  copiadoId,
  aoMudarTelefone,
  aoMudarChavePix,
  aoIniciarEdicao,
  aoSalvarEdicao,
  aoCancelarEdicao,
  aoCopiarPix,
  aoPedirAlternanciaStatus,
}: ListaGoleirosProps) {
  if (goleiros.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-borda rounded-[4px] bg-superficie">
        <p className="text-xs font-mono text-giz-fraco">Nenhum goleiro encontrado.</p>
      </div>
    );
  }

  return (
    <div className="border-y border-borda divide-y divide-borda/40 bg-superficie">
      {goleiros.map((g) => (
        <LinhaGoleiro
          key={g.id}
          goleiro={g}
          estaEditando={editandoId === g.id}
          editTelefone={editTelefone}
          editChavePix={editChavePix}
          salvando={salvandoEdicao}
          foiCopiado={copiadoId === g.id}
          aoMudarTelefone={aoMudarTelefone}
          aoMudarChavePix={aoMudarChavePix}
          aoIniciarEdicao={aoIniciarEdicao}
          aoSalvarEdicao={aoSalvarEdicao}
          aoCancelarEdicao={aoCancelarEdicao}
          aoCopiarPix={aoCopiarPix}
          aoPedirAlternanciaStatus={aoPedirAlternanciaStatus}
        />
      ))}
    </div>
  );
}
