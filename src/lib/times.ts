export type TimeId = 'a' | 'b';

export interface TimeInfo {
  id: TimeId;
  nome: string;
  cor: string;
  bgClasse: string;
  textClasse: string;
  borderClasse: string;
}

export const TIMES = {
  a: {
    id: 'a',
    nome: 'Time Preto',
    cor: '#0d0d0e',
    bgClasse: 'bg-preto-time',
    textClasse: 'text-branco-time',
    borderClasse: 'border-led-borda',
  },
  b: {
    id: 'b',
    nome: 'Time Branco',
    cor: '#f4f1e8',
    bgClasse: 'bg-branco-time',
    textClasse: 'text-preto-time',
    borderClasse: 'border-borda',
  },
} as const satisfies Record<TimeId, TimeInfo>;

// Jogadores de linha por time. A capacidade de confirmações da partida
// (CAPACIDADE_PARTIDA em partidas.ts) deriva daqui: LIMITE_POR_TIME * 2.
export const LIMITE_POR_TIME = 7;

export const POSICOES = {
  goleiro: 'Goleiro',
  zagueiro: 'Zagueiro',
  lateral: 'Lateral',
  meia: 'Meia',
  atacante: 'Atacante',
  random: 'Random',
} as const;

// Posicoes secundarias validas (sem 'random'). Usada no form de novo jogador
// e em qualquer lugar que trate de `posicao_b`.
export const POSICOES_B = {
  goleiro: 'Goleiro',
  zagueiro: 'Zagueiro',
  lateral: 'Lateral',
  meia: 'Meia',
  atacante: 'Atacante',
} as const;

export type PosicaoId = keyof typeof POSICOES;
