/**
 * stores/group.ts
 * Task: T2.1 - Store Zustand para GROUP (dados do grupo).
 *
 * Estado:
 *   - group: GROUP atual
 *   - profiles: perfis do grupo (mensalistas, avulsos, goleiros)
 *
 * Actions:
 *   - setGroup: atualiza grupo
 *   - setProfiles: atualiza lista de perfis
 *   - addProfile: adiciona perfil
 *   - updateProfile: atualiza perfil
 *   - removeProfile: remove perfil
 *
 * Uso: useGroupStore() hook.
 */

import { create } from 'zustand';
import type { Database } from '@/types/database.types';

type GroupStore = {
  // Estado
  group: Database['public']['Tables']['groups']['Row'] | null;
  profiles: Database['public']['Tables']['profiles']['Row'][];

  // Actions
  setGroup: (group: Database['public']['Tables']['groups']['Row'] | null) => void;
  setProfiles: (profiles: Database['public']['Tables']['profiles']['Row'][]) => void;
  addProfile: (profile: Database['public']['Tables']['profiles']['Row']) => void;
  updateProfile: (profile: Partial<Database['public']['Tables']['profiles']['Row']>) => void;
  removeProfile: (profileId: string) => void;
};

export const useGroupStore = create<GroupStore>((set) => ({
  // Estado inicial
  group: null,
  profiles: [],

  // Actions
  setGroup: (group) => set({ group }),
  setProfiles: (profiles) => set({ profiles }),
  addProfile: (profile) =>
    set((state) => ({
      profiles: [...state.profiles, profile],
    })),
  updateProfile: (profile) =>
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === profile.id ? { ...p, ...profile } : p)),
    })),
  removeProfile: (profileId) =>
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== profileId),
    })),
}));
