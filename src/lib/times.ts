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

export type PosicaoId = keyof typeof POSICOES;
