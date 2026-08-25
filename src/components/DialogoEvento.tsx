import { useId, useState } from 'react';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Participante, TipoEvento } from '../lib/partidas';
import { formatarNome } from '../lib/formatacao';
import { vibrateGoal } from '../lib/haptics';
import { useModalA11y } from '../hooks/useModalA11y';

interface DialogoEventoProps {
  jogador: Participante | null;
  companheiros: Participante[];
  jogadores?: Participante[];
  salvando: boolean;
  editando?: boolean;
  tipoAtual?: TipoEvento;
  assistenciaAtual?: number | null;
  onClose: () => void;
  onTrocarJogador?: (jogador: Participante) => void;
  onConfirmar: (tipo: TipoEvento, assistenciaId: number | null) => void;
}

type Etapa = 'tipo' | 'assistencia';

export function DialogoEvento({
  jogador,
  companheiros,
  jogadores = [],
  salvando,
  editando = false,
  tipoAtual,
  assistenciaAtual,
  onClose,
  onTrocarJogador,
  onConfirmar,
}: DialogoEventoProps) {
  const tituloId = useId();
  const [etapa, setEtapa] = useState<Etapa>('tipo');

  const { containerRef, handleKeyDown, visivel } = useModalA11y({
    open: Boolean(jogador),
    onClose,
    disableEscape: salvando,
  });

  if (!jogador) return null;

  function handleConfirmar(tipo: TipoEvento, assistenciaId: number | null) {
    vibrateGoal();
    onConfirmar(tipo, assistenciaId);
  }

  const nome = formatarNome(jogador.username ?? `#${jogador.jogador_id}`);
  const pretos = jogadores.filter((j) => j.time === 'a');
  const brancos = jogadores.filter((j) => j.time === 'b');

  return createPortal(
    <div
      onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !salvando) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-xs sm:items-center sm:p-4 text-giz"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`w-full max-w-sm rounded-t-[8px] border-t-2 border-x-2 sm:border-2 border-borda bg-superficie p-5 shadow-carimbo-preto transition sm:rounded-[6px] ${
          visivel ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {etapa === 'tipo' ? (
          <>
            <h2
              id={tituloId}
              className="font-display font-bold text-lg uppercase tracking-wide text-giz"
            >
              {editando ? 'Editar evento' : `Evento: ${nome}`}
            </h2>
            <p className="mt-1 text-xs text-giz-fraco">
              {editando ? 'Altere o jogador, o tipo ou a assistência.' : 'O que rolou na jogada?'}
            </p>

            {editando && onTrocarJogador && jogadores.length > 0 && (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase font-display tracking-wider text-giz-fraco">
                  Jogador
                </span>
                <select
                  value={jogador.jogador_id}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const escolhido = jogadores.find((j) => j.jogador_id === id);
                    if (escolhido) onTrocarJogador(escolhido);
                  }}
                  className="w-full cursor-pointer rounded-[4px] border border-borda bg-superficie-2 px-3 py-2.5 text-sm text-giz shadow-xs min-h-[44px]"
                >
                  {pretos.length > 0 && (
                    <optgroup label="Time Preto">
                      {pretos.map((j) => (
                        <option key={j.jogador_id} value={j.jogador_id}>
                          {formatarNome(j.username ?? `#${j.jogador_id}`)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {brancos.length > 0 && (
                    <optgroup label="Time Branco">
                      {brancos.map((j) => (
                        <option key={j.jogador_id} value={j.jogador_id}>
                          {formatarNome(j.username ?? `#${j.jogador_id}`)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={salvando}
                onClick={() => setEtapa('assistencia')}
                className={`min-h-[44px] cursor-pointer rounded-[4px] border border-destaque px-3 py-3 text-xs font-display font-bold uppercase tracking-wider shadow-carimbo transition active:translate-y-px disabled:opacity-40 ${
                  editando && tipoAtual === 'gol'
                    ? 'bg-destaque text-destaque-tinta ring-2 ring-destaque ring-offset-2 ring-offset-superficie'
                    : 'bg-destaque text-destaque-tinta'
                }`}
              >
                ⚽ Gol
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => handleConfirmar('gol_contra', null)}
                className={`min-h-[44px] cursor-pointer rounded-[4px] border px-3 py-3 text-xs font-display font-bold uppercase tracking-wider shadow-carimbo transition active:translate-y-px disabled:opacity-40 ${
                  editando && tipoAtual === 'gol_contra'
                    ? 'border-perigo bg-perigo text-white'
                    : 'border-perigo/50 bg-superficie-2 text-perigo hover:bg-perigo/10'
                }`}
              >
                Gol contra
              </button>
            </div>
            <button
              type="button"
              disabled={salvando}
              onClick={onClose}
              className="mt-3 w-full min-h-[44px] cursor-pointer rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-xs font-display uppercase tracking-wider font-semibold text-giz-fraco hover:text-giz"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <h2
              id={tituloId}
              className="font-display font-bold text-lg uppercase tracking-wide text-giz"
            >
              Assistência no gol de {nome}
            </h2>
            <p className="mt-1 text-xs text-giz-fraco">Quem deu o passe pro gol?</p>
            <button
              type="button"
              disabled={salvando}
              onClick={() => handleConfirmar('gol', null)}
              className={`mt-4 w-full min-h-[44px] cursor-pointer rounded-[4px] border px-3 py-2.5 text-xs font-display font-bold uppercase tracking-wider shadow-carimbo transition active:translate-y-px disabled:opacity-40 ${
                editando && assistenciaAtual == null && tipoAtual === 'gol'
                  ? 'border-destaque bg-destaque/15 text-destaque font-bold'
                  : 'border-borda bg-superficie-2 text-giz hover:bg-superficie'
              }`}
            >
              Sem assistência (Gol Individual)
            </button>
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {companheiros.map((c) => {
                const ativo = editando && assistenciaAtual === c.jogador_id;
                return (
                  <button
                    key={c.jogador_id}
                    type="button"
                    disabled={salvando}
                    onClick={() => handleConfirmar('gol', c.jogador_id)}
                    className={`w-full min-h-[44px] cursor-pointer rounded-[4px] border px-3 py-2.5 text-left text-xs font-semibold uppercase font-display tracking-wider transition active:translate-y-px disabled:opacity-40 ${
                      ativo
                        ? 'border-destaque bg-destaque text-destaque-tinta shadow-carimbo'
                        : 'border-borda bg-superficie-2 text-giz hover:border-destaque hover:bg-superficie'
                    }`}
                  >
                    {formatarNome(c.username ?? `#${c.jogador_id}`)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={salvando}
              onClick={() => setEtapa('tipo')}
              className="mt-3 w-full min-h-[44px] cursor-pointer rounded-[4px] px-3 py-2 text-xs font-display uppercase tracking-wider text-giz-fraco hover:text-giz"
            >
              ← Voltar ao tipo de evento
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
