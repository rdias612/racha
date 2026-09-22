import { useState, useEffect, useMemo } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import { POSICOES, type PosicaoId } from '../lib/times';
import { vibrateLight } from '../lib/haptics';
import { ModalBase } from './ModalBase';

export type PosicaoFiltro = Exclude<PosicaoId, 'random'> | 'todas';

export const POSICOES_FILTRO = (Object.keys(POSICOES) as PosicaoId[]).filter(
  (pos): pos is Exclude<PosicaoId, 'random'> => pos !== 'random'
);

export interface ModalFiltrosRankingProps {
  open: boolean;
  onClose: () => void;
  posicao: PosicaoFiltro;
  minimoPartidas: number;
  maximoPartidas: number;
  onAplicar: (posicao: PosicaoFiltro, minimoPartidas: number) => void;
  onLimpar: () => void;
}

export function ModalFiltrosRanking({
  open,
  onClose,
  posicao,
  minimoPartidas,
  maximoPartidas,
  onAplicar,
  onLimpar,
}: ModalFiltrosRankingProps) {
  const [draftPosicao, setDraftPosicao] = useState<PosicaoFiltro>(posicao);
  const [draftMinimo, setDraftMinimo] = useState<number>(minimoPartidas);

  // Sincroniza o rascunho sempre que o modal abre ou os valores externos mudam
  useEffect(() => {
    if (open) {
      setDraftPosicao(posicao);
      setDraftMinimo(minimoPartidas);
    }
  }, [open, posicao, minimoPartidas]);

  const presets = useMemo(() => {
    const lista = [
      { label: 'Sem mín. (0)', valor: 0 },
      { label: 'Padrão (6)', valor: 6 },
    ];
    if (maximoPartidas >= 12) {
      lista.push({ label: '12+ jogos', valor: 12 });
    }
    if (maximoPartidas >= 20) {
      lista.push({ label: '20+ jogos', valor: 20 });
    }
    return lista;
  }, [maximoPartidas]);

  function handleTrocarPosicao(novaPosicao: PosicaoFiltro) {
    vibrateLight();
    setDraftPosicao(novaPosicao);
  }

  function handleTrocarPreset(valor: number) {
    vibrateLight();
    setDraftMinimo(Math.min(valor, maximoPartidas));
  }

  function handleAplicar() {
    vibrateLight();
    onAplicar(draftPosicao, draftMinimo);
    onClose();
  }

  function handleLimpar() {
    vibrateLight();
    onLimpar();
    onClose();
  }

  const alterado = draftPosicao !== 'todas' || draftMinimo !== 6;

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      titulo="Filtros do Ranking"
      subtitulo="Refine a classificação por posição e volume de partidas"
      icone={<SlidersHorizontal className="w-4 h-4 text-destaque-texto" />}
      tamanhoMaximo="md"
      posicao="bottom-sheet"
      rodape={
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={handleLimpar}
            disabled={!alterado}
            className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-[4px] border font-display uppercase tracking-wider text-xs font-bold transition active:translate-y-px ${
              alterado
                ? 'border-borda bg-superficie-2 text-giz hover:bg-superficie cursor-pointer shadow-xs'
                : 'border-borda/40 bg-superficie-2/40 text-giz-fraco/50 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
          <button
            type="button"
            onClick={handleAplicar}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center rounded-[4px] border border-destaque bg-destaque font-display uppercase tracking-wider text-xs font-black text-destaque-tinta shadow-carimbo-destaque hover:brightness-105 active:translate-y-px transition cursor-pointer"
          >
            Aplicar Filtros
          </button>
        </div>
      }
    >
      <div className="p-4 sm:p-5 space-y-5">
        {/* Seção Posição */}
        <div>
          <span className="block text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-2">
            Posição do Atleta
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleTrocarPosicao('todas')}
              className={`min-h-[44px] inline-flex items-center justify-center rounded-[3px] px-2 py-2 text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer ${
                draftPosicao === 'todas'
                  ? 'bg-destaque text-destaque-tinta shadow-xs border border-destaque font-black'
                  : 'border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:bg-superficie'
              }`}
            >
              Todas
            </button>
            {POSICOES_FILTRO.map((pos) => {
              const ativo = draftPosicao === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => handleTrocarPosicao(pos)}
                  className={`min-h-[44px] inline-flex items-center justify-center rounded-[3px] px-2 py-2 text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer ${
                    ativo
                      ? 'bg-destaque text-destaque-tinta shadow-xs border border-destaque font-black'
                      : 'border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:bg-superficie'
                  }`}
                >
                  {POSICOES[pos]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seção Mínimo de Partidas */}
        <div>
          <div className="flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider text-giz-fraco mb-2">
            <span>Mínimo de partidas disputadas</span>
            <span className="font-mono text-destaque-texto text-sm font-bold">
              {draftMinimo} {draftMinimo === 1 ? 'jogo' : 'jogos'}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={maximoPartidas}
            value={draftMinimo}
            onChange={(e) => {
              const val = Number(e.target.value);
              setDraftMinimo(val <= maximoPartidas ? val : maximoPartidas);
            }}
            className="w-full accent-destaque cursor-pointer mb-2.5"
          />

          {/* Atalhos Rápidos */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-sans text-giz-fraco">Atalhos rápidos:</span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => {
                const ativo = draftMinimo === p.valor;
                return (
                  <button
                    key={p.valor}
                    type="button"
                    onClick={() => handleTrocarPreset(p.valor)}
                    className={`min-h-[36px] px-2.5 py-1 inline-flex items-center justify-center rounded-[3px] text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer ${
                      ativo
                        ? 'border border-destaque bg-destaque/15 text-destaque-texto'
                        : 'border border-borda bg-superficie-2 text-giz-fraco hover:text-giz'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-2.5 text-[11px] text-giz-fraco font-sans leading-tight">
            Exclui atletas com poucas atuações para evitar distorções na média e no aproveitamento.
          </p>
        </div>
      </div>
    </ModalBase>
  );
}
