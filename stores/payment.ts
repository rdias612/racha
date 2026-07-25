/**
 * stores/payment.ts
 * Task: T2.1 - Store Zustand para PAYMENTS (mensalidade + avulsa).
 *
 * Estado:
 *   - payments: lista de pagamentos do grupo (mes atual ou todos).
 *   - loading: flag de fetch.
 *   - error: erro PT-BR da ultima operacao.
 *
 * Actions:
 *   - setPayments: troca a lista.
 *   - addPayment: append (INSERT, ex.: geracao de mensalidade no dia 5).
 *   - upsertPayment: UPDATE parcial por id (jogador marca / admin aprova).
 *   - removePayment: DELETE por id.
 *   - setLoading / setError: controle de UI.
 *
 * Observacoes:
 *   - PRD regra 6 = transparencia: qualquer membro do grupo ve todos os
 *     payments (RLS em T1.7 garante isolamento cross-group).
 *   - JS puro; fetch + Realtime ficam em lib/realtime.ts / app/(tabs)/_layout.tsx.
 */

import { create } from 'zustand';

import type { PaymentRow, PaymentUpdate } from '@/types/database.types';

type PaymentStore = {
  // Estado
  payments: PaymentRow[];
  loading: boolean;
  error: string | null;

  // Actions (CRUD generico)
  setPayments: (payments: PaymentRow[]) => void;
  addPayment: (payment: PaymentRow) => void;
  upsertPayment: (id: string, patch: PaymentUpdate) => void;
  removePayment: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Actions T4.2: dupla confirmacao (atomica na store; IO em lib/payments.ts).
  markPaid: (id: string, marked_paid_at: string) => void;
  approve: (id: string, stamp: string) => void;
};

export const usePaymentStore = create<PaymentStore>((set) => ({
  // Estado inicial
  payments: [],
  loading: false,
  error: null,

  // Actions (CRUD generico)
  setPayments: (payments) => set({ payments }),
  addPayment: (payment) => set((state) => ({ payments: [...state.payments, payment] })),
  upsertPayment: (id, patch) =>
    set((state) => ({
      payments: state.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  removePayment: (id) => set((state) => ({ payments: state.payments.filter((p) => p.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // T4.2: jogador marca como pago (1a confirmacao).
  markPaid: (id, marked_paid_at) =>
    set((state) => ({
      payments: state.payments.map((p) =>
        p.id === id ? { ...p, marked_paid_at, updated_at: marked_paid_at } : p,
      ),
    })),

  // T4.2: admin aprova (2a confirmacao). fecha o enum status=paid.
  approve: (id, stamp) =>
    set((state) => ({
      payments: state.payments.map((p) =>
        p.id === id
          ? {
              ...p,
              approved_at: stamp,
              paid_at: stamp,
              status: 'paid',
              updated_at: stamp,
            }
          : p,
      ),
    })),
}));
