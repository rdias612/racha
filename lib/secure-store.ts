/**
 * lib/secure-store.ts
 * Persistência segura (Keychain/Keystore via expo-secure-store) do profile
 * autenticado localmente (login via `profiles`, sem Supabase Auth).
 *
 * Limite do SecureStore ~2KB; AuthProfile (id/username/flags) cabe folgado.
 */

import * as SecureStore from 'expo-secure-store';

import type { AuthProfile } from '@/types/database.types';

export const PROFILE_KEY = 'active-profile';
export const ONBOARD_KEY = 'onboarded';

/** Salva o profile autenticado como sessão local. */
export async function saveProfile(profile: AuthProfile): Promise<void> {
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
}

/** Lê o profile ativo, ou null se não houver (ou payload corrompido). */
export async function loadProfile(): Promise<AuthProfile | null> {
  const raw = await SecureStore.getItemAsync(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthProfile;
  } catch {
    await SecureStore.deleteItemAsync(PROFILE_KEY);
    return null;
  }
}

/** Limpa a sessão local (logout). */
export async function clearProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(PROFILE_KEY);
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
