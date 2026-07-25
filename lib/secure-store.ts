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
export const ONBOARD_KEY = 'onboarded';

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

/**
 * Onboarding (T7.2):
 * - Marca no SecureStore que o usuario concluiu o onboarding inicial.
 * - Nao persiste no DB (YAGNI): flag resetavel apenas por uninstall.
 * - Offline-first: lido no boot do app (_layout.tsx).
 */
export async function markOnboarded(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARD_KEY, '1');
}

/**
 * Verifica se o usuario ja concluiu o onboarding.
 * - true  -> pular /onboarding, ir direto /(tabs).
 * - false -> redirecionar para /onboarding antes das tabs.
 */
export async function isOnboarded(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(ONBOARD_KEY);
  return raw === '1';
}
