export type TimeId = "a" | "b";

export interface TimeInfo {
  id: TimeId;
  nome: string;
  cor: string;
}

export const TIMES = {
  a: { id: "a", nome: "Time Preto", cor: "#111827" },
  b: { id: "b", nome: "Time Branco", cor: "#f9fafb" },
} as const satisfies Record<TimeId, TimeInfo>;

export const POSICOES = {
  goleiro: "Goleiro",
  zagueiro: "Zagueiro",
  lateral: "Lateral",
  meia: "Meia",
  atacante: "Atacante",
  random: "Random",
} as const;

// Posicoes secundarias validas (sem 'random'). Usada no form de novo jogador
// e em qualquer lugar que trate de `posicao_b`.
export const POSICOES_B = {
  goleiro: "Goleiro",
  zagueiro: "Zagueiro",
  lateral: "Lateral",
  meia: "Meia",
  atacante: "Atacante",
} as const;

export type PosicaoId = keyof typeof POSICOES;
