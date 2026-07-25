/**
 * stores/auth.ts
 * Task: T2.1 - Store Zustand para AUTH (user, loading).
 *
 * Estado:
 *   - user: usuario autenticado (Supabase User)
 *   - loading: loading state
 *   - error: erro de auth
 *
 * Actions:
 *   - setUser: atualiza usuario
 *   - setLoading: atualiza loading
 *   - setError: atualiza erro
 *   - signOut: desloga usuario
 *
 * Uso: useAuthStore() hook.
 *
 * Nota: useAuth() hook (hooks/useAuth.ts) e este store sao complementares.
 * useAuth() gerencia a session Supabase; este store gerencia o estado UI.
 */

import { create } from 'zustand';

type AuthStore = {
  // Estado
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  loading: boolean;
  error: string | null;

  // Actions
  setUser: (
    user: {
      id: string;
      email: string;
      full_name: string;
      avatar_url: string | null;
    } | null,
  ) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  // Estado inicial
  user: null,
  loading: true,
  error: null,

  // Actions
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  signOut: async () => {
    // Supabase signOut - implementacao real via supabase.auth.signOut()
    set({ user: null, loading: false, error: null });
  },
}));
