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

type MatchStore = {
  // Estado
  match: Database['public']['Tables']['matches']['Row'] | null;
  presences: Database['public']['Tables']['match_presences']['Row'][];
  participants: Database['public']['Tables']['match_participants']['Row'][];
  payments: Database['public']['Tables']['payments']['Row'][];
  expenses: Database['public']['Tables']['expenses']['Row'][];

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
};

export const useMatchStore = create<MatchStore>((set) => ({
  // Estado inicial
  match: null,
  presences: [],
  participants: [],
  payments: [],
  expenses: [],

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
}));
