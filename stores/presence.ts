/**
 * stores/presence.ts
 * Tasks: T2.1 (snapshot/Realtime actions) + T2.3 (RSVP IO actions).
 *
 * Estado:
 *   - presences: lista de RSVPs do match atual (FIFO + confirmados + pendentes).
 *   - loading: flag de fetch em andamento.
 *   - error: erro da ultima mutacao/fetch (PT-BR; null = sem erro).
 *
 * Actions T2.1 (mutacao local - sem IO):
 *   - setPresences / addPresence / upsertPresence / removePresence
 *   - setLoading / setError
 *
 * Actions T2.3 (IO Supabase via lib/rsvp.ts; PT-BR errors; rebate FIFO M4):
 *   - fetchPresences(matchId): carrega lista inicial enriquecida com profile.
 *   - confirmPresence({match_id,user_id,user_type,match}): RSVP confirma,
 *     respeitando regra 4 PRD (mensalista->confirmed, avulso->pending_approval)
 *     e rebate FIFO M4 (mensalista desistente pos-cutoff -> waiting_list final).
 *   - declinePresence({match_id,user_id,user_type}): RSVP recusa.
 *
 * Observacoes:
 *   - Tipado contra o mirror de schema (types/database.types.ts).
 *   - Subscription Realtime orquestrada em lib/realtime.ts (T2.1); as actions
 *     T2.3 apenas mutam o estado local apos sucesso do IO (Realtime tambem
 *     entrega o payload UPDATER e idempotente via upsertPresence).
 *   - Erros sao traduzidos por friendlyError (PT-BR) e expostos em `error`.
 */

import { create } from 'zustand';

import {
  confirmPresenceWithRebate as rsvpConfirm,
  declinePresence as rsvpDecline,
  fetchPresencesForMatch,
} from '@/lib/rsvp';
import type { MatchPresenceRow, MatchPresenceUpdate, UserType } from '@/types/database.types';

/** Match minimo para calculo de cutoff (rebate FIFO M4). */
export type CutoffAwareMatch = { date_time: string } | null;

interface RsvpActionInput {
  match_id: string;
  user_id: string;
  user_type: UserType;
  /** Match corrente (date_time em UTC) - habilita rebate FIFO M4. */
  match?: CutoffAwareMatch;
}

type PresenceStore = {
  // Estado
  presences: MatchPresenceRow[];
  loading: boolean;
  error: string | null;

  // Actions locais (T2.1)
  setPresences: (presences: MatchPresenceRow[]) => void;
  addPresence: (presence: MatchPresenceRow) => void;
  upsertPresence: (id: string, patch: MatchPresenceUpdate) => void;
  removePresence: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Actions IO (T2.3)
  fetchPresences: (matchId: string) => Promise<void>;
  confirmPresence: (input: RsvpActionInput) => Promise<boolean>;
  declinePresence: (input: RsvpActionInput) => Promise<boolean>;
};

export const usePresenceStore = create<PresenceStore>((set, get) => ({
  // Estado inicial
  presences: [],
  loading: false,
  error: null,

  // Actions locais (T2.1)
  setPresences: (presences) => set({ presences }),
  addPresence: (presence) => set((state) => ({ presences: [...state.presences, presence] })),
  upsertPresence: (id, patch) =>
    set((state) => ({
      presences: state.presences.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  removePresence: (id) =>
    set((state) => ({ presences: state.presences.filter((p) => p.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Actions IO (T2.3) -----------------------------------------------------
  fetchPresences: async (matchId) => {
    set({ loading: true, error: null });
    try {
      const rows = await fetchPresencesForMatch(matchId);
      set({ presences: rows, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar presencas.';
      set({ loading: false, error: message });
    }
  },

  confirmPresence: async ({ match_id, user_id, user_type, match }) => {
    set({ loading: true, error: null });
    try {
      const current =
        get().presences.find((p) => p.match_id === match_id && p.user_id === user_id) ?? null;
      const updated = await rsvpConfirm({
        match_id,
        user_id,
        user_type,
        current,
        match: match ?? null,
      });
      // Realtime tambem entregara o UPDATE; upsert local e idempotente.
      get().upsertPresence(updated.id, updated);
      set({ loading: false });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao confirmar presenca.';
      set({ loading: false, error: message });
      return false;
    }
  },

  declinePresence: async ({ match_id, user_id, user_type }) => {
    set({ loading: true, error: null });
    try {
      const current =
        get().presences.find((p) => p.match_id === match_id && p.user_id === user_id) ?? null;
      const updated = await rsvpDecline({
        match_id,
        user_id,
        user_type,
        current,
      });
      get().upsertPresence(updated.id, updated);
      set({ loading: false });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao desistir da presenca.';
      set({ loading: false, error: message });
      return false;
    }
  },
}));
