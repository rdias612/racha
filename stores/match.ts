/**
 * stores/match.ts
 * Task: T2.1 - Store Zustand para MATCH (presenca, participantes, pagamentos).
 *
 * Estado: match e estado local da sumula pos-jogo.
 *
 * Uso: useMatchStore() hook.
 */

import { create } from 'zustand';
import type { Database } from '@/types/database.types';
import type { TeamScoresMap, PlayerStatField, SumulaParticipant } from '@/lib/sumula';

type MatchStore = {
  // Estado
  match: Database['public']['Tables']['matches']['Row'] | null;

  // Sumula T6.2 (estado enriquecido p/ UI de pos-jogo)
  teamScores: TeamScoresMap;
  sumulaParticipants: SumulaParticipant[];
  sumulaLoading: boolean;
  sumulaError: string | null;

  // Actions
  setMatch: (match: Database['public']['Tables']['matches']['Row'] | null) => void;

  // Actions T6.2 (sumula pos-jogo)
  setTeamScores: (t: TeamScoresMap) => void;
  patchTeamScore: (teamGroup: number, score: number) => void;
  setSumulaParticipants: (p: SumulaParticipant[]) => void;
  patchParticipantStat: (participantId: string, field: PlayerStatField, value: number) => void;
  upsertSumulaParticipant: (p: SumulaParticipant) => void;
  setSumulaLoading: (b: boolean) => void;
  setSumulaError: (e: string | null) => void;
  setMatchStatus: (status: Database['public']['Tables']['matches']['Row']['status']) => void;
  setSumulaSnapshot: (input: {
    match: Database['public']['Tables']['matches']['Row'];
    teamScores: TeamScoresMap;
    participants: SumulaParticipant[];
  }) => void;
};

export const useMatchStore = create<MatchStore>((set) => ({
  // Estado inicial
  match: null,

  // Sumula T6.2
  teamScores: {},
  sumulaParticipants: [],
  sumulaLoading: false,
  sumulaError: null,

  // Actions
  setMatch: (match) => set({ match }),

  // Actions T6.2 (sumula pos-jogo) - mutacoes LOCAIS otimistas.
  // As chamadas IO ficam na tela (app/sumula/[match_id].tsx) que decide
  // estrategia de erro/rollback (UX minimal p/ admin em dispositivo fraco).
  setTeamScores: (t) => set({ teamScores: t }),
  patchTeamScore: (teamGroup, score) =>
    set((state) => {
      const next = { ...state.teamScores, [String(teamGroup)]: Math.max(0, Math.trunc(score)) };
      return { teamScores: next };
    }),
  setSumulaParticipants: (participants) => set({ sumulaParticipants: participants }),
  patchParticipantStat: (participantId, field, value) =>
    set((state) => ({
      sumulaParticipants: state.sumulaParticipants.map((p) =>
        p.id === participantId ? { ...p, [field]: Math.max(0, Math.trunc(value)) } : p,
      ),
    })),
  upsertSumulaParticipant: (p) =>
    set((state) => {
      const exists = state.sumulaParticipants.some((x) => x.id === p.id);
      return {
        sumulaParticipants: exists
          ? state.sumulaParticipants.map((x) => (x.id === p.id ? p : x))
          : [...state.sumulaParticipants, p],
      };
    }),
  setSumulaLoading: (sumulaLoading) => set({ sumulaLoading }),
  setSumulaError: (sumulaError) => set({ sumulaError }),
  setMatchStatus: (status) =>
    set((state) => ({
      teamScores: state.teamScores,
      match: state.match ? { ...state.match, status } : state.match,
    })),
  setSumulaSnapshot: ({ match, teamScores, participants }) =>
    set({
      match,
      teamScores,
      sumulaParticipants: participants,
      sumulaError: null,
    }),
}));
