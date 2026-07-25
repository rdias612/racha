/**
 * lib/secure-store.ts
 * Task: T1.4 - Wrapper seguro para persistencia da session Supabase.
 *
 * expo-secure-store: valores em Keychain/Keystore (nao AsyncStorage plain).
 * Limite de valor do SecureStore ~ 2KB: session JSON cabe. Se estourar no
 * futuro, partir para SQLite encriptado (YAGNI p/ MVP).
 */

import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';

export const SESSION_KEY = 'supabase-session';

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    // Payload corrompido -> limpa e segue anonimo.
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
