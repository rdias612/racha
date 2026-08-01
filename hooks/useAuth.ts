/**
 * hooks/useAuth.ts
 * Autenticação local: login por username + senha contra `profiles` via RPC
 * public.login(). Sessão persistida localmente (Secure Store).
 * Sem Supabase Auth / auth.users por jogador.
 */

import { useCallback, useEffect, useState } from 'react';

import { normalizeUsername } from '@/lib/auth-local';
import { registerForPushNotifications } from '@/lib/pushToken';
import { clearProfile, loadProfile, saveProfile } from '@/lib/secure-store';
import { supabase } from '@/lib/supabase';
import type { AuthProfile } from '@/types/database.types';

export interface UseAuthResult {
  profile: AuthProfile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

type LoginRpcRow = AuthProfile;
type LoginRpcData = LoginRpcRow | LoginRpcRow[] | null;

let sharedProfile: AuthProfile | null = null;
const profileListeners = new Set<(profile: AuthProfile | null) => void>();

function publishProfile(profile: AuthProfile | null): void {
  sharedProfile = profile;
  profileListeners.forEach((listener) => listener(profile));
}

export function useAuth(): UseAuthResult {
  const [profile, setProfile] = useState<AuthProfile | null>(sharedProfile);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  // Restaura sessão local ao abrir o app.
  useEffect(() => {
    profileListeners.add(setProfile);
    let mounted = true;
    (async () => {
      const restored = await loadProfile();
      if (!mounted) return;
      publishProfile(restored);
      setLoading(false);
    })();
    return () => {
      mounted = false;
      profileListeners.delete(setProfile);
    };
  }, []);

  const signIn = useCallback(
    async (rawUsername: string, password: string) => {
      if (signingIn) return;
      setSigningIn(true);
      try {
        const username = normalizeUsername(rawUsername);
        const { data, error } = await supabase.rpc('login', {
          p_username: username,
          p_password: password,
        });

        if (error) throw error;
        const loginData = data as unknown as LoginRpcData;
        const row = Array.isArray(loginData) ? loginData[0] : loginData;
        if (!row) throw new Error('Usuario ou senha invalidos.');

        const next: AuthProfile = {
          id: row.id,
          username: row.username,
          user_type: row.user_type,
          is_admin: row.is_admin,
          group_id: row.group_id,
        };
        await saveProfile(next);
        publishProfile(next);
        void registerForPushNotifications();
      } finally {
        setSigningIn(false);
      }
    },
    [signingIn],
  );

  const signOut = useCallback(async () => {
    await clearProfile();
    publishProfile(null);
  }, []);

  return {
    profile,
    loading: loading || signingIn,
    signIn,
    signOut,
  };
}
