/**
 * stores/match.ts
 * Task: T2.1 - Store Zustand para MATCH (presenca, participantes, pagamentos).
 *
 * Estado:
 *   - match: MATCH atual (selecionado)
 *   - presences: RSVPs do match (ordenados por FIFO)
 *   - participants: participantes congelados (match->active)
 *   - payments: pagamentos do match
 *
 * Actions:
 *   - confirmPresence() - confirma presenca (mensalista direto, avulso pendente)
 *   - declinePresence() - recusa presenca
 *   - approveCasualPayment() - marca pagamento casual como pago
 *   - approveMonthlyPayment() - marca mensalidade como paga
 *   - approveExpense() - confirma despesa
 *
 * Uso: useMatchStore() hook.
 */

import { create } from 'zustand';
import type { Database } from '@/types/database.types';
import type { TeamScoresMap, PlayerStatField, SumulaParticipant } from '@/lib/sumula';

type MatchStore = {
  // Estado
  match: Database['public']['Tables']['matches']['Row'] | null;
  presences: Database['public']['Tables']['match_presences']['Row'][];
  participants: Database['public']['Tables']['match_participants']['Row'][];
  payments: Database['public']['Tables']['payments']['Row'][];
  expenses: Database['public']['Tables']['expenses']['Row'][];

  // Sumula T6.2 (estado enriquecido p/ UI de pos-jogo)
  teamScores: TeamScoresMap;
  sumulaParticipants: SumulaParticipant[];
  sumulaLoading: boolean;
  sumulaError: string | null;

  // Actions
  setMatch: (match: Database['public']['Tables']['matches']['Row'] | null) => void;
  setPresences: (presences: Database['public']['Tables']['match_presences']['Row'][]) => void;
  addPresence: (presence: Database['public']['Tables']['match_presences']['Row']) => void;
  updatePresence: (
    presence: Partial<Database['public']['Tables']['match_presences']['Row']>,
  ) => void;
  removePresence: (matchId: string, userId: string) => void;
  setParticipants: (
    participants: Database['public']['Tables']['match_participants']['Row'][],
  ) => void;
  addParticipant: (participant: Database['public']['Tables']['match_participants']['Row']) => void;
  setPayments: (payments: Database['public']['Tables']['payments']['Row'][]) => void;
  addPayment: (payment: Database['public']['Tables']['payments']['Row']) => void;
  updatePayment: (payment: Partial<Database['public']['Tables']['payments']['Row']>) => void;
  setExpenses: (expenses: Database['public']['Tables']['expenses']['Row'][]) => void;
  addExpense: (expense: Database['public']['Tables']['expenses']['Row']) => void;
  updateExpense: (expense: Partial<Database['public']['Tables']['expenses']['Row']>) => void;

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
  presences: [],
  participants: [],
  payments: [],
  expenses: [],

  // Sumula T6.2
  teamScores: {},
  sumulaParticipants: [],
  sumulaLoading: false,
  sumulaError: null,

  // Actions
  setMatch: (match) => set({ match }),
  setPresences: (presences) => set({ presences }),
  addPresence: (presence) =>
    set((state) => ({
      presences: [...state.presences, presence],
    })),
  updatePresence: (presence) =>
    set((state) => ({
      presences: state.presences.map((p) => (p.id === presence.id ? { ...p, ...presence } : p)),
    })),
  removePresence: (matchId, userId) =>
    set((state) => ({
      presences: state.presences.filter((p) => !(p.match_id === matchId && p.user_id === userId)),
    })),
  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),
  setPayments: (payments) => set({ payments }),
  addPayment: (payment) =>
    set((state) => ({
      payments: [...state.payments, payment],
    })),
  updatePayment: (payment) =>
    set((state) => ({
      payments: state.payments.map((p) => (p.id === payment.id ? { ...p, ...payment } : p)),
    })),
  setExpenses: (expenses) => set({ expenses }),
  addExpense: (expense) =>
    set((state) => ({
      expenses: [...state.expenses, expense],
    })),
  updateExpense: (expense) =>
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === expense.id ? { ...e, ...expense } : e)),
    })),

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
