import { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Avatar } from './Avatar';
import { CampoBusca } from './CampoBusca';
import { ModalBase } from './ModalBase';
import { POSICOES, TIMES, type TimeId } from '../lib/times';
import type { JogadorLista } from '../lib/jogadores';

type FiltroModal = 'todos' | 'goleiros' | 'linha' | 'mensalistas' | 'avulsos';

export interface ModalEscalarJogadorProps {
  timeDestino: TimeId;
  jogadoresAtivos: JogadorLista[];
  idsEscalados: Set<number>;
  onSelecionar: (jogador: JogadorLista, time: TimeId) => void;
  onClose: () => void;
}

// Montado condicionalmente pela rota: cada abertura começa com busca/filtro limpos.
export function ModalEscalarJogador({
  timeDestino,
  jogadoresAtivos,
  idsEscalados,
  onSelecionar,
  onClose,
}: ModalEscalarJogadorProps) {
  const [buscaJogador, setBuscaJogador] = useState('');
  const [filtroModal, setFiltroModal] = useState<FiltroModal>('todos');

  const candidatosAdicionar = useMemo(() => {
    const termo = buscaJogador.trim().toLowerCase();

    return jogadoresAtivos
      .filter((j) => !idsEscalados.has(j.id))
      .filter((j) => {
        if (filtroModal === 'goleiros') return j.posicao === 'goleiro';
        if (filtroModal === 'linha') return j.posicao !== 'goleiro';
        if (filtroModal === 'mensalistas') return j.is_mensalista;
        if (filtroModal === 'avulsos') return !j.is_mensalista;
        return true;
      })
      .filter((j) => !termo || j.username.toLowerCase().includes(termo));
  }, [jogadoresAtivos, idsEscalados, buscaJogador, filtroModal]);

  return (
    <ModalBase
      open
      onClose={onClose}
      titulo={`Adicionar ao ${TIMES[timeDestino].nome}`}
      icone={<UserPlus className="size-4 text-destaque-texto" />}
      tamanhoMaximo="md"
      posicao="centro"
      rodape={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-[3px] border border-borda text-xs font-display font-bold uppercase tracking-wider text-giz hover:bg-superficie cursor-pointer"
          >
            Fechar
          </button>
        </div>
      }
    >
      {/* Busca & Filtros */}
      <div className="p-3 border-b border-borda space-y-2 bg-superficie">
        <CampoBusca
          valor={buscaJogador}
          aoMudar={setBuscaJogador}
          placeholder="Buscar por @username..."
          autoFocus
        />

        {/* Filtros em Pílula */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
          {(
            [
              { id: 'todos', label: 'Todos' },
              { id: 'goleiros', label: '🧤 Goleiros' },
              { id: 'linha', label: 'Linha' },
              { id: 'mensalistas', label: 'Mensalistas' },
              { id: 'avulsos', label: 'Avulsos' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroModal(f.id)}
              className={`min-h-[44px] px-2.5 py-1 rounded-[3px] font-display font-bold uppercase tracking-wider whitespace-nowrap transition cursor-pointer ${
                filtroModal === f.id
                  ? 'bg-destaque text-destaque-tinta shadow-carimbo'
                  : 'bg-superficie-2 border border-borda text-giz-fraco hover:text-giz'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista com scroll otimizado */}
      <div className="flex-1 overflow-y-auto divide-y divide-borda p-2 space-y-1">
        {candidatosAdicionar.map((j) => (
          <button
            key={j.id}
            type="button"
            onClick={() => onSelecionar(j, timeDestino)}
            className="w-full min-h-[48px] p-2.5 rounded-[3px] flex items-center justify-between gap-3 text-left hover:bg-superficie-2 active:translate-y-px transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar username={j.username} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-giz truncate">@{j.username}</p>
                <p className="text-[10px] font-mono text-giz-fraco">
                  {j.is_mensalista ? 'Mensalista' : 'Avulso'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-display uppercase tracking-wider text-giz-fraco">
                {j.posicao === 'goleiro' ? '🧤 Goleiro' : (POSICOES[j.posicao] ?? 'Linha')}
              </span>
              <span className="min-h-[32px] inline-flex items-center px-2.5 py-1 rounded-[2px] bg-destaque/15 text-destaque-texto text-xs font-display font-bold uppercase tracking-wider">
                + Escalar
              </span>
            </div>
          </button>
        ))}

        {candidatosAdicionar.length === 0 && (
          <div className="py-12 text-center text-xs font-mono text-giz-fraco">
            {buscaJogador
              ? 'Nenhum jogador encontrado com essa busca.'
              : 'Nenhum jogador disponível neste filtro.'}
          </div>
        )}
      </div>
    </ModalBase>
  );
}
