/**
 * stores/expense.ts
 * Task: T4.3 - Store Zustand para EXPENSES (caixa do racha - saidas).
 *
 * Estado:
 *   - expenses: lista de despesas do grupo.
 *   - loading: flag de fetch.
 *   - error: erro PT-BR da ultima operacao.
 *
 * Actions:
 *   - setExpenses: troca a lista (Realtime INSERT/UPDATE/DELETE refresh).
 *   - addExpense: append (INSERT).
 *   - upsertExpense: UPDATE parcial por id (admin toggle confirmed_at).
 *   - removeExpense: DELETE por id.
 *   - setLoading / setError: controle de UI.
 *   - confirm: marca confirmed_at = now() (snapshot final).
 *
 * Observacoes:
 *   - PRD regra 6 = transparencia: qualquer membro do grupo ve todas as
 *     despesas (RLS T1.7 garante isolamento cross-group; admin muta).
 *   - JS puro; fetch + Realtime ficam em lib/realtime.ts / app/_layout.
 */

import { create } from 'zustand';

import type { ExpenseRow, ExpenseUpdate } from '@/types/database.types';

type ExpenseStore = {
  // Estado
  expenses: ExpenseRow[];
  loading: boolean;
  error: string | null;

  // Actions (CRUD generico)
  setExpenses: (expenses: ExpenseRow[]) => void;
  addExpense: (expense: ExpenseRow) => void;
  upsertExpense: (id: string, patch: ExpenseUpdate) => void;
  removeExpense: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // T4.3: admin confirma despesa (snapshot final).
  confirm: (id: string, confirmed_at: string) => void;
};

export const useExpenseStore = create<ExpenseStore>((set) => ({
  // Estado inicial
  expenses: [],
  loading: false,
  error: null,

  // Actions (CRUD generico)
  setExpenses: (expenses) => set({ expenses }),
  addExpense: (expense) => set((state) => ({ expenses: [...state.expenses, expense] })),
  upsertExpense: (id, patch) =>
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),
  removeExpense: (id) => set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // T4.3: toggle confirmacao (snapshot final apos confirmar).
  confirm: (id, confirmed_at) =>
    set((state) => ({
      expenses: state.expenses.map((e) =>
        e.id === id ? { ...e, confirmed_at, updated_at: confirmed_at } : e,
      ),
    })),
}));
