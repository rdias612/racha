import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, UserPlus, Check } from 'lucide-react';
import { Avatar } from './Avatar';
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const termo = busca.trim().toLowerCase();
  const goleirosFiltrados = useMemo(() => {
    if (!termo) return goleirosDisponiveis;
    return goleirosDisponiveis.filter((g) => (g.username ?? '').toLowerCase().includes(termo));
  }, [goleirosDisponiveis, termo]);

  if (!open) return null;

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

  return createPortal(
    <div
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md max-h-[85vh] sm:max-h-[80vh] flex flex-col rounded-t-[6px] sm:rounded-[4px] border-t sm:border border-borda bg-superficie shadow-carimbo-preto text-giz overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Cabeçalho */}
        <div className="px-4 py-3 bg-superficie-2 border-b border-borda flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className="px-2 py-0.5 rounded-[2px] font-display font-black text-xs uppercase tracking-widest border shadow-xs"
              style={{
                backgroundColor: ehPreto ? '#0d0d0e' : '#f4f1e8',
                color: ehPreto ? '#f4f1e8' : '#0d0d0e',
                borderColor: '#35302a',
              }}
            >
              Time {ehPreto ? 'Preto' : 'Branco'}
            </span>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
              Escolher Goleiro
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1 rounded-[4px] text-giz-fraco hover:text-giz hover:bg-superficie transition min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-2 focus-visible:outline-destaque"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Barra de Busca e Ações Rápidas */}
        <div className="p-3 border-b border-borda space-y-2 shrink-0 bg-superficie">
          <div className="relative">
            <Search className="size-4 text-giz-fraco absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar goleiro por nome…"
              className="w-full rounded-[4px] border border-borda bg-superficie-2 pl-9 pr-3 py-2 text-base sm:text-xs text-giz placeholder-giz-fraco focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2 min-h-[44px]"
            />
          </div>

          {onAbrirNovoGoleiro && (
            <button
              type="button"
              onClick={handleNovoGoleiro}
              className="w-full min-h-[40px] px-3 py-2 rounded-[3px] border border-destaque/40 bg-destaque/10 text-destaque hover:bg-destaque hover:text-destaque-tinta transition font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:translate-y-px"
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
              className="w-full min-h-[44px] px-3 py-2.5 rounded-[4px] border border-dashed border-borda/80 bg-superficie-2/40 text-giz-fraco hover:text-perigo hover:border-perigo/50 hover:bg-perigo/5 transition font-display uppercase tracking-wider text-xs font-bold flex items-center justify-center gap-1.5 active:translate-y-px"
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
                {busca
                  ? 'Nenhum goleiro encontrado para esta busca.'
                  : 'Nenhum goleiro disponível.'}
              </p>
              {onAbrirNovoGoleiro && (
                <button
                  type="button"
                  onClick={handleNovoGoleiro}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[3px] bg-destaque text-destaque-tinta font-display font-bold text-xs uppercase tracking-wider shadow-carimbo"
                >
                  <UserPlus className="size-3.5" />
                  <span>Cadastrar Goleiro</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3 bg-superficie-2 border-t border-borda shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie text-xs font-display font-bold uppercase tracking-wider text-giz hover:bg-superficie-2 transition active:translate-y-px shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
