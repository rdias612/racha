import { useState, useMemo } from 'react';
import type { Participante, TipoEvento } from '../lib/partidas';
import { formatarNome } from '../lib/formatacao';
import { vibrateGoal } from '../lib/haptics';
import { ModalBase } from './ModalBase';

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
  const [etapa, setEtapa] = useState<Etapa>('tipo');

  const nome = useMemo(
    () => (jogador ? formatarNome(jogador.username ?? `#${jogador.jogador_id}`) : ''),
    [jogador]
  );
  const pretos = useMemo(() => jogadores.filter((j) => j.time === 'a'), [jogadores]);
  const brancos = useMemo(() => jogadores.filter((j) => j.time === 'b'), [jogadores]);

  if (!jogador) return null;

  const fechar = () => {
    if (!salvando) onClose();
  };

  function handleConfirmar(tipo: TipoEvento, assistenciaId: number | null) {
    vibrateGoal();
    onConfirmar(tipo, assistenciaId);
  }

  return (
    <ModalBase
      open={Boolean(jogador)}
      onClose={fechar}
      disableEscape={salvando}
      mostrarBotaoFechar={false}
      tamanhoMaximo="sm"
      posicao="bottom-sheet"
      className="p-5"
      titulo={
        etapa === 'tipo'
          ? editando
            ? 'Editar evento'
            : `Evento: ${nome}`
          : `Assistência no gol de ${nome}`
      }
      subtitulo={
        etapa === 'tipo'
          ? editando
            ? 'Altere o jogador, o tipo ou a assistência.'
            : 'O que rolou na jogada?'
          : 'Quem deu o passe pro gol?'
      }
    >
      {etapa === 'tipo' ? (
        <>
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
                  ? 'border-perigo bg-perigo text-branco-time'
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
          <button
            type="button"
            disabled={salvando}
            onClick={() => handleConfirmar('gol', null)}
            className={`mt-4 w-full min-h-[44px] cursor-pointer rounded-[4px] border px-3 py-2.5 text-xs font-display font-bold uppercase tracking-wider shadow-carimbo transition active:translate-y-px disabled:opacity-40 ${
              editando && assistenciaAtual == null && tipoAtual === 'gol'
                ? 'border-destaque bg-destaque/15 text-destaque-texto font-bold'
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
    </ModalBase>
  );
}
