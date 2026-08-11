import type { JogadorLista } from "./jogadores";
import type { TimeId, PosicaoId } from "./times";

export interface ParticipanteForm {
  jogador: JogadorLista;
  time: TimeId;
  posicao: PosicaoId;
  gols: number;
  assistencias: number;
  gols_contra: number;
}

function embaralhar<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
  Gerador de proposta de divisão automática de times com base nas posições A e B.
 */
export function gerarEscalacaoAutomatica(
  jogadores: JogadorLista[],
): ParticipanteForm[] {
  const limitePorTime = Math.ceil(jogadores.length / 2);
  const goleiros = embaralhar(jogadores.filter((j) => j.posicao === "goleiro"));
  const linha = embaralhar(jogadores.filter((j) => j.posicao !== "goleiro"));

  const timeA: JogadorLista[] = [];
  const timeB: JogadorLista[] = [];

  // 1. Distribuir Goleiros alternadamente
  for (let i = 0; i < goleiros.length; i++) {
    if (i % 2 === 0) {
      if (timeA.length < limitePorTime) timeA.push(goleiros[i]);
      else timeB.push(goleiros[i]);
    } else {
      if (timeB.length < limitePorTime) timeB.push(goleiros[i]);
      else timeA.push(goleiros[i]);
    }
  }

  // 2. Agrupar jogadores de linha por posição primária (posicao)
  const gruposPosicao: Record<string, JogadorLista[]> = {};
  for (const j of linha) {
    const pos = j.posicao;
    if (!gruposPosicao[pos]) gruposPosicao[pos] = [];
    gruposPosicao[pos].push(j);
  }

  const sobras: JogadorLista[] = [];

  // 3. Pares por posição primária
  for (const pos in gruposPosicao) {
    const lista = embaralhar(gruposPosicao[pos]);
    while (lista.length >= 2) {
      const p1 = lista.pop()!;
      const p2 = lista.pop()!;
      if (timeA.length < limitePorTime && timeB.length < limitePorTime) {
        timeA.push(p1);
        timeB.push(p2);
      } else {
        sobras.push(p1, p2);
      }
    }
    if (lista.length === 1) {
      sobras.push(lista.pop()!);
    }
  }

  // 4. Distribuir jogadores restantes considerando Posição A e Posição B
  const sobrasEmbaralhadas = embaralhar(sobras);

  function contarPosicao(time: JogadorLista[], pos: PosicaoId): number {
    return time.filter((j) => j.posicao === pos || j.posicao_b === pos).length;
  }

  for (const j of sobrasEmbaralhadas) {
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

    // Avaliar necessidade dos times considerando Posição A (peso 1.0) e Posição B (peso 0.5)
    const scoreA =
      (contarPosicao(timeB, j.posicao) - contarPosicao(timeA, j.posicao)) * 1.0 +
      (j.posicao_b
        ? (contarPosicao(timeB, j.posicao_b) - contarPosicao(timeA, j.posicao_b)) * 0.5
        : 0);

    const scoreB =
      (contarPosicao(timeA, j.posicao) - contarPosicao(timeB, j.posicao)) * 1.0 +
      (j.posicao_b
        ? (contarPosicao(timeA, j.posicao_b) - contarPosicao(timeB, j.posicao_b)) * 0.5
        : 0);

    if (scoreA > scoreB) {
      timeA.push(j);
    } else if (scoreB > scoreA) {
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
      time: "a",
      posicao: j.posicao,
      gols: 0,
      assistencias: 0,
      gols_contra: 0,
    });
  }

  for (const j of timeB) {
    resultado.push({
      jogador: j,
      time: "b",
      posicao: j.posicao,
      gols: 0,
      assistencias: 0,
      gols_contra: 0,
    });
  }

  return resultado;
}
