/**
 * hooks/useAuth.ts
 * Task: T1.4 - Hook de autenticacao Google OAuth (Expo Auth Session, web flow).
 *
 * Fonte do fluxo: docs T1.4 (plan.yaml).
 *  - signInWithGoogle():
 *      redirectUri = AuthSession.makeRedirectUri({ useProxy: true })
 *      signInWithOAuth(provider=google, skipBrowserRedirect=true)
 *      WebBrowser.openAuthSessionAsync(url, redirectUri) -> URL final
 *      parsear access_token/refresh_token da query/fragment
 *      supabase.auth.setSession(...) + SecureStore.saveSession
 *  - signOut(): supabase.auth.signOut() + SecureStore.clearSession()
 *
 * Estado: `session`, `user`, `loading`.
 */

import { useCallback, useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { clearSession, loadSession, saveSession } from '@/lib/secure-store';
import { registerForPushNotifications } from '@/lib/pushToken';

WebBrowser.maybeCompleteAuthSession();

export interface UseAuthResult {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  // Boot: restaura session do SecureStore.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const restored = await loadSession();
      if (!mounted) return;
      if (restored) {
        const {
          data: { user },
        } = await supabase.auth.getUser(restored.access_token);
        if (!user) {
          // Token expirado/invalidado -> limpa para forcar relogin.
          await clearSession();
          if (mounted) setSession(null);
        } else {
          // setSession hidrata o cliente e dispara onAuthStateChange.
          const { error } = await supabase.auth.setSession({
            access_token: restored.access_token,
            refresh_token: restored.refresh_token,
          });
          if (mounted) {
            setSession(error ? null : restored);
          } else if (error) {
            await clearSession();
          }
        }
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Sessao reativa: sincroniza com mudancas do supabase (refresh, signOut).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      // makeRedirectUri usa o `scheme` do app.json (futamigos://) em builds
      // nativos e exp:// em Expo Go. Sem useProxy (removido em SDK 51+).
      const redirectTo = AuthSession.makeRedirectUri({ scheme: 'futamigos' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) throw error ?? new Error('OAuth sem url de redirect.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        // Usuario cancelou ou falhou a abertura do browser.
        return;
      }

      const parsed = extractTokensFromUrl(result.url);
      if (!parsed) throw new Error('Tokens ausentes na URL de retorno OAuth.');

      const { error: setErr } = await supabase.auth.setSession(parsed);
      if (setErr) throw setErr;

      const {
        data: { session: fresh },
      } = await supabase.auth.getSession();
      if (fresh) await saveSession(fresh);

      // Push e nao-obrigatorio: falha silenciosa (log interno) e mantem login.
      void registerForPushNotifications();
    } finally {
      setSigningIn(false);
    }
  }, [signingIn]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      await clearSession();
      setSession(null);
    }
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading: loading || signingIn,
    signInWithGoogle,
    signOut,
  };
}

/**
 * Extrai access_token + refresh_token da URL de retorno OAuth Supabase.
 * Supabase envia ambos em query string (#access_token tambem ocorre em alguns flows).
 */
function extractTokensFromUrl(url: string): { access_token: string; refresh_token: string } | null {
  try {
    const u = new URL(url);
    const fromQuery = pickTokens(u.searchParams);
    if (fromQuery) return fromQuery;

    const hashParams = new URLSearchParams(u.hash.replace(/^#/, ''));
    const fromHash = pickTokens(hashParams);
    if (fromHash) return fromHash;
  } catch {
    return null;
  }
  return null;
}

function pickTokens(
  params: URLSearchParams,
): { access_token: string; refresh_token: string } | null {
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { access_token, refresh_token };
  return null;
}
