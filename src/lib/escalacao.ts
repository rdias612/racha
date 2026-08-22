import type { JogadorLista } from './jogadores';
import type { TimeId, PosicaoId } from './times';

export interface ParticipanteForm {
  jogador: JogadorLista;
  time: TimeId;
  posicao: PosicaoId;
  gols: number;
  assistencias: number;
  gols_contra: number;
  media_nota?: number;
}

const NOTA_PADRAO = 6.0;

function embaralhar<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = arr[i];
    const target = arr[j];
    if (current !== undefined && target !== undefined) {
      arr[i] = target;
      arr[j] = current;
    }
  }
  return arr;
}

interface JogadorComRating extends JogadorLista {
  nota: number;
}

/**
 * Gerador de proposta de divisão automática de times com base nas posições A e B
 * e no equilíbrio do nível técnico/média de notas dos jogadores.
 */
export function gerarEscalacaoAutomatica(
  jogadores: JogadorLista[],
  mediasNotas?: Record<number, number>
): ParticipanteForm[] {
  const limitePorTime = Math.ceil(jogadores.length / 2);

  // Atribuição de notas (padrão 6.0 se não tiver avaliação)
  const jogadoresComNota: JogadorComRating[] = jogadores.map((j) => {
    const notaCalculada = j.media_nota ?? mediasNotas?.[j.id] ?? NOTA_PADRAO;
    return {
      ...j,
      nota: Number(notaCalculada.toFixed(2)),
    };
  });

  const goleiros = embaralhar(jogadoresComNota.filter((j) => j.posicao === 'goleiro'));
  const linha = embaralhar(jogadoresComNota.filter((j) => j.posicao !== 'goleiro'));

  const timeA: JogadorComRating[] = [];
  const timeB: JogadorComRating[] = [];

  function somaNotas(time: JogadorComRating[]): number {
    return time.reduce((acc, j) => acc + j.nota, 0);
  }

  // 1. Distribuir Goleiros alternadamente (atribuindo o melhor goleiro ao time com menor saldo)
  goleiros.sort((a, b) => b.nota - a.nota);
  for (const g of goleiros) {
    if (
      timeA.length < limitePorTime &&
      (timeB.length >= limitePorTime || somaNotas(timeA) <= somaNotas(timeB))
    ) {
      timeA.push(g);
    } else if (timeB.length < limitePorTime) {
      timeB.push(g);
    } else {
      timeA.push(g);
    }
  }

  // 2. Agrupar jogadores de linha por posição primária (posicao)
  const gruposPosicao: Record<string, JogadorComRating[]> = {};
  for (const j of linha) {
    const pos = j.posicao;
    if (!gruposPosicao[pos]) gruposPosicao[pos] = [];
    gruposPosicao[pos]!.push(j);
  }

  const sobras: JogadorComRating[] = [];

  // 3. Pares por posição primária usando ABBA equilibrado pela soma das notas
  for (const pos in gruposPosicao) {
    // Ordena por nota (maior para menor) com pequena variação aleatória para não ser 100% estático
    const lista = (gruposPosicao[pos] ?? []).sort(
      (a, b) => b.nota - a.nota + (Math.random() * 0.2 - 0.1)
    );

    while (lista.length >= 2) {
      const p1 = lista.shift();
      const p2 = lista.shift();
      if (!p1 || !p2) break;

      if (timeA.length < limitePorTime && timeB.length < limitePorTime) {
        // Envia o jogador mais forte para o time com menor soma total de notas atual
        if (somaNotas(timeA) <= somaNotas(timeB)) {
          timeA.push(p1);
          timeB.push(p2);
        } else {
          timeB.push(p1);
          timeA.push(p2);
        }
      } else {
        sobras.push(p1, p2);
      }
    }

    if (lista.length === 1) {
      const resto = lista.shift();
      if (resto) sobras.push(resto);
    }
  }

  // 4. Distribuir jogadores restantes considerando Posição A, Posição B e Nível Técnico (Notas)
  const sobrasOrdenadas = embaralhar(sobras);

  function contarPosicao(time: JogadorComRating[], pos: PosicaoId): number {
    return time.filter((j) => j.posicao === pos || j.posicao_b === pos).length;
  }

  for (const j of sobrasOrdenadas) {
    const podeA = timeA.length < limitePorTime;
    const podeB = timeB.length < limitePorTime;

    if (podeA && !podeB) {
      timeA.push(j);
      continue;
    }
    if (!podeA && podeB) {
      timeB.push(j);
      continue;
    }
    if (!podeA && !podeB) {
      break;
    }

    // Avaliar Posição A (peso 1.0) e Posição B (peso 0.5)
    const scorePosA =
      (contarPosicao(timeB, j.posicao) - contarPosicao(timeA, j.posicao)) * 1.0 +
      (j.posicao_b
        ? (contarPosicao(timeB, j.posicao_b) - contarPosicao(timeA, j.posicao_b)) * 0.5
        : 0);

    const scorePosB =
      (contarPosicao(timeA, j.posicao) - contarPosicao(timeB, j.posicao)) * 1.0 +
      (j.posicao_b
        ? (contarPosicao(timeA, j.posicao_b) - contarPosicao(timeB, j.posicao_b)) * 0.5
        : 0);

    // Avaliar Equilíbrio da Soma de Notas (diferença absoluta resultante)
    const diffSeColocarA = Math.abs(somaNotas(timeA) + j.nota - somaNotas(timeB));
    const diffSeColocarB = Math.abs(somaNotas(timeA) - (somaNotas(timeB) + j.nota));

    // Pontuação combinada (Posição + Equilíbrio Técnico)
    const scoreTotalA = scorePosA * 2.0 - diffSeColocarA * 0.5;
    const scoreTotalB = scorePosB * 2.0 - diffSeColocarB * 0.5;

    if (scoreTotalA > scoreTotalB) {
      timeA.push(j);
    } else if (scoreTotalB > scoreTotalA) {
      timeB.push(j);
    } else {
      if (timeA.length <= timeB.length) {
        timeA.push(j);
      } else {
        timeB.push(j);
      }
    }
  }

  // Montar array final de ParticipanteForm
  const resultado: ParticipanteForm[] = [];

  for (const j of timeA) {
    resultado.push({
      jogador: j,
      time: 'a',
      posicao: j.posicao,
      gols: 0,
      assistencias: 0,
      gols_contra: 0,
      media_nota: j.nota,
    });
  }

  for (const j of timeB) {
    resultado.push({
      jogador: j,
      time: 'b',
      posicao: j.posicao,
      gols: 0,
      assistencias: 0,
      gols_contra: 0,
      media_nota: j.nota,
    });
  }

  return resultado;
}
