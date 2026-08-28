import { useState, useCallback, useMemo } from 'react';
import { gerarEscalacaoAutomatica, NOTA_PADRAO } from '../lib/escalacao';
import type { JogadorLista } from '../lib/jogadores';
import { LIMITE_POR_TIME, type TimeId } from '../lib/times';
import { vibrateWarning, vibrateSuccess } from '../lib/haptics';

export interface UseEscalacaoTimesOptions {
  jogadores: JogadorLista[];
  mediasNotas: Record<number, number>;
  limitePorTime?: number;
}

export function useEscalacaoTimes({
  jogadores,
  mediasNotas,
  limitePorTime = LIMITE_POR_TIME,
}: UseEscalacaoTimesOptions) {
  // Times sempre nascem vazios: a hidratação (partida já salva) é feita pelo
  // caller via `setTimes` após carregar os dados — sem prop de valor inicial
  // que precisasse de sincronização.
  const [times, setTimes] = useState<Record<number, TimeId>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const jogadoresPorId = useMemo(() => new Map(jogadores.map((j) => [j.id, j])), [jogadores]);

  const atribuirTime = useCallback(
    (id: number, time: TimeId) => {
      setFeedback(null);
      const jogador = jogadoresPorId.get(id);
      if (!jogador) return;

      const ehGoleiro = jogador.posicao === 'goleiro';
      const atual = times[id];

      // Já está nesse time -> remove (sem time)
      if (atual && atual === time) {
        setTimes((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }

      // Regra: cada time pode ter no máximo 1 goleiro.
      const destinoTemGoleiro = Object.entries(times).some(
        ([jidStr, tm]) =>
          tm === time &&
          Number(jidStr) !== id &&
          jogadoresPorId.get(Number(jidStr))?.posicao === 'goleiro'
      );
      if (ehGoleiro && destinoTemGoleiro) {
        vibrateWarning();
        setFeedback(
          `Cada time só pode ter 1 goleiro. @${jogador.username} não pode ir para o ${
            time === 'a' ? 'Preto' : 'Branco'
          }.`
        );
        return;
      }

      // Bloqueia se o time alvo já está cheio.
      const destinoCheio = Object.values(times).filter((tm) => tm === time).length >= limitePorTime;
      if (destinoCheio) {
        vibrateWarning();
        return;
      }

      setTimes((prev) => ({ ...prev, [id]: time }));
    },
    [times, limitePorTime, jogadoresPorId]
  );

  const autoEscalar = useCallback(() => {
    setFeedback(null);
    if (jogadores.length < limitePorTime * 2) {
      vibrateWarning();
      setFeedback(
        `Precisa de ${limitePorTime * 2} confirmados para gerar os times automaticamente.`
      );
      return;
    }
    const proposta = gerarEscalacaoAutomatica(jogadores, mediasNotas);
    const novos: Record<number, TimeId> = {};
    for (const p of proposta) {
      novos[p.jogador.id] = p.time;
    }
    setTimes(novos);

    const timeAPart = proposta.filter((p) => p.time === 'a');
    const timeBPart = proposta.filter((p) => p.time === 'b');
    const avgA = timeAPart.length
      ? (
          timeAPart.reduce((s, p) => s + (p.media_nota ?? NOTA_PADRAO), 0) / timeAPart.length
        ).toFixed(1)
      : '0.0';
    const avgB = timeBPart.length
      ? (
          timeBPart.reduce((s, p) => s + (p.media_nota ?? NOTA_PADRAO), 0) / timeBPart.length
        ).toFixed(1)
      : '0.0';
    vibrateSuccess();
    setFeedback(`Times equilibrados! (Preto ${avgA}★ vs Branco ${avgB}★)`);
  }, [jogadores, mediasNotas, limitePorTime]);

  const limparTimes = useCallback(() => {
    setTimes({});
    setFeedback(null);
  }, []);

  return {
    times,
    setTimes,
    feedback,
    setFeedback,
    atribuirTime,
    autoEscalar,
    limparTimes,
  };
}
