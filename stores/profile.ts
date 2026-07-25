/**
 * stores/profile.ts
 * Task: T2.1 - Store Zustand para PROFILES do grupo logado.
 *
 * Estado:
 *   - profiles: perfis do grupo (mensalistas, avulsos, goleiro_pago).
 *   - currentProfile: perfil do usuario autenticado (para gating de UI).
 *   - loading: flag de fetch.
 *   - error: erro PT-BR.
 *
 * Actions:
 *   - setProfiles: troca a lista.
 *   - setCurrentProfile: troca o perfil corrente.
 *   - addProfile: append.
 *   - upsertProfile: UPDATE parcial por id.
 *   - removeProfile: DELETE por id.
 *   - setLoading / setError: controle de UI.
 *
 * Observacoes:
 *   - Store local; fetch/Realtime em lib/realtime.ts (T2.1 nao subscreve
 *     PROFILES via Realtime - mutacoes de perfil sao raras e via UI admin).
 *   - `is_admin` e `user_type` aqui sao o source-of-truth para o gating
 *     de botao (admin / mensalista / avulso).
 */

import { create } from 'zustand';

import type { ProfileRow, ProfileUpdate } from '@/types/database.types';

type ProfileStore = {
  // Estado
  profiles: ProfileRow[];
  currentProfile: ProfileRow | null;
  loading: boolean;
  error: string | null;

  // Actions
  setProfiles: (profiles: ProfileRow[]) => void;
  setCurrentProfile: (profile: ProfileRow | null) => void;
  addProfile: (profile: ProfileRow) => void;
  upsertProfile: (id: string, patch: ProfileUpdate) => void;
  removeProfile: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

export const useProfileStore = create<ProfileStore>((set) => ({
  // Estado inicial
  profiles: [],
  currentProfile: null,
  loading: false,
  error: null,

  // Actions
  setProfiles: (profiles) => set({ profiles }),
  setCurrentProfile: (currentProfile) => set({ currentProfile }),
  addProfile: (profile) => set((state) => ({ profiles: [...state.profiles, profile] })),
  upsertProfile: (id, patch) =>
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      currentProfile:
        state.currentProfile?.id === id
          ? { ...state.currentProfile, ...patch }
          : state.currentProfile,
    })),
  removeProfile: (id) =>
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
      currentProfile: state.currentProfile?.id === id ? null : state.currentProfile,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
