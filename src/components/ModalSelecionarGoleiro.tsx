import { useState, useEffect, useMemo } from 'react';
import { UserPlus, Check, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { CampoBusca } from './CampoBusca';
import { BadgeTime } from './BadgeTime';
import { ModalBase } from './ModalBase';
import { type JogadorLista } from '../lib/jogadores';
import { type TimeId } from '../lib/times';
import { vibrateLight } from '../lib/haptics';

export interface ModalSelecionarGoleiroProps {
  open: boolean;
  time: TimeId;
  goleiroAtualId: number | null;
  outroGoleiroId: number | null;
  goleirosDisponiveis: JogadorLista[];
  jogadoresNaLinha: Record<number, TimeId>;
  onSelecionar: (goleiroId: number | null) => void;
  onClose: () => void;
  onAbrirNovoGoleiro?: () => void;
}

export function ModalSelecionarGoleiro({
  open,
  time,
  goleiroAtualId,
  outroGoleiroId,
  goleirosDisponiveis,
  jogadoresNaLinha,
  onSelecionar,
  onClose,
  onAbrirNovoGoleiro,
}: ModalSelecionarGoleiroProps) {
  const [busca, setBusca] = useState('');
  const ehPreto = time === 'a';

  useEffect(() => {
    if (!open) return;
    setBusca('');
  }, [open]);

  const termo = busca.trim().toLowerCase();
  const goleirosFiltrados = useMemo(() => {
    if (!termo) return goleirosDisponiveis;
    return goleirosDisponiveis.filter((g) => (g.username ?? '').toLowerCase().includes(termo));
  }, [goleirosDisponiveis, termo]);

  function handleEscolher(goleiroId: number | null) {
    vibrateLight();
    onSelecionar(goleiroId);
    onClose();
  }

  function handleNovoGoleiro() {
    vibrateLight();
    onClose();
    onAbrirNovoGoleiro?.();
  }

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      titulo="Escolher Goleiro"
      headerExtra={<BadgeTime time={time} tamanho="xs" />}
      tamanhoMaximo="md"
      posicao="bottom-sheet"
      rodape={
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie text-xs font-display font-bold uppercase tracking-wider text-giz hover:bg-superficie-2 transition active:translate-y-px shadow-xs"
        >
          Fechar
        </button>
      }
    >
      {/* Barra de Busca e Ações Rápidas */}
      <div className="p-3 border-b border-borda space-y-2 shrink-0 bg-superficie">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar goleiro por nome…" />

        {onAbrirNovoGoleiro && (
          <button
            type="button"
            onClick={handleNovoGoleiro}
            className="w-full min-h-[44px] px-3 py-2 rounded-[3px] border border-destaque/40 bg-destaque/10 text-destaque hover:bg-destaque hover:text-destaque-tinta transition font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:translate-y-px cursor-pointer"
          >
            <UserPlus className="size-3.5" />
            <span>Cadastrar Novo Goleiro</span>
          </button>
        )}
      </div>

      {/* Lista de Goleiros Disponíveis */}
      <div className="overflow-y-auto p-2 sm:p-3 space-y-1 divide-y divide-borda/30 flex-1">
        {/* Opção para desmarcar se já tiver goleiro selecionado */}
        {goleiroAtualId !== null && (
          <button
            type="button"
            onClick={() => handleEscolher(null)}
            className="w-full min-h-[44px] px-3 py-2.5 rounded-[4px] border border-dashed border-borda/80 bg-superficie-2/40 text-giz-fraco hover:text-perigo hover:border-perigo/50 hover:bg-perigo/5 transition font-display uppercase tracking-wider text-xs font-bold flex items-center justify-center gap-1.5 active:translate-y-px cursor-pointer"
          >
            <X className="size-3.5" />
            <span>Remover goleiro deste time</span>
          </button>
        )}

        {goleirosFiltrados.map((g) => {
          const isSelecionado = g.id === goleiroAtualId;
          const isOutroTime = g.id === outroGoleiroId;
          const isLinha = Boolean(jogadoresNaLinha[g.id]);
          const disabled = isOutroTime || isLinha;

          return (
            <button
              key={g.id}
              type="button"
              disabled={disabled}
              onClick={() => handleEscolher(g.id)}
              className={`w-full min-h-[48px] px-3 py-2.5 rounded-[4px] flex items-center justify-between gap-3 text-left transition border ${
                isSelecionado
                  ? 'border-destaque bg-destaque/15 shadow-xs'
                  : disabled
                    ? 'border-transparent opacity-40 cursor-not-allowed bg-superficie-2/30'
                    : 'border-transparent bg-superficie hover:bg-superficie-2 hover:border-borda active:translate-y-px cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar nome={g.username} posicao="goleiro" size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`truncate font-display text-sm uppercase tracking-wider ${
                        isSelecionado ? 'font-bold text-destaque' : 'font-bold text-giz'
                      }`}
                    >
                      {g.username}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                {isSelecionado && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-destaque/20 border border-destaque text-destaque text-[11px] font-mono font-bold">
                    <Check className="size-3" />
                    Escalado
                  </span>
                )}
                {isOutroTime && (
                  <span className="px-2 py-0.5 rounded-[2px] bg-superficie-2 border border-borda text-giz-fraco text-[10px] font-mono">
                    No Time {ehPreto ? 'Branco' : 'Preto'}
                  </span>
                )}
                {isLinha && (
                  <span className="px-2 py-0.5 rounded-[2px] bg-superficie-2 border border-borda text-giz-fraco text-[10px] font-mono">
                    Escalado na linha
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {goleirosFiltrados.length === 0 && (
          <div className="py-8 px-4 text-center space-y-2">
            <p className="text-xs font-mono text-giz-fraco">
              {busca ? 'Nenhum goleiro encontrado para esta busca.' : 'Nenhum goleiro disponível.'}
            </p>
            {onAbrirNovoGoleiro && (
              <button
                type="button"
                onClick={handleNovoGoleiro}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[3px] bg-destaque text-destaque-tinta font-display font-bold text-xs uppercase tracking-wider shadow-carimbo min-h-[44px] cursor-pointer"
              >
                <UserPlus className="size-3.5" />
                <span>Cadastrar Goleiro</span>
              </button>
            )}
          </div>
        )}
      </div>
    </ModalBase>
  );
}
