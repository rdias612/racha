/**
 * lib/pushToken.ts
 * Task: T1.4 - Registro do Expo Push Token + persistencia em DEVICE_TOKENS.
 *
 * Fluxo:
 *   1. requestPermissionsAsync() (Android 13+ mostra system prompt).
 *   2. Se concedido: getExpoPushTokenAsync({ projectId }) -> token.
 *   3. upsert em device_tokens (onConflict: expo_push_token - unico global).
 *
 * Garantias:
 *   - Nunca derrubar o login se push falhar (emulador sem Google Play, etc).
 *   - user_id extraido da session atual do supabase.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { supabase } from './supabase';

const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

/**
 * Solicita permissao + persiste o Expo Push Token para o usuario autenticado.
 * Retorna true quando o token foi gravado com sucesso; false em qualquer
 * bypass (permissao negada, emulador, erro de rede). Nunca throw.
 */
export async function registerForPushNotifications(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[push] Permissao de notificacoes negada pelo usuario.');
      return false;
    }

    if (!PROJECT_ID) {
      console.warn(
        '[push] extra.eas.projectId ausente no app.json; nao foi possivel obter token Expo.',
      );
      return false;
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    // ExpoPushToken.data ja e a string bruta (ex.: "ExponentPushToken[xxx]").
    const token = typeof data === 'string' ? data : '';
    if (!token) {
      console.warn('[push] getTokenAsync retornou token vazio.');
      return false;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[push] Usuario ausente; nao eh possivel persistir token.');
      return false;
    }

    const { error } = await supabase
      .from('device_tokens')
      .upsert({ user_id: user.id, expo_push_token: token } as any, {
        onConflict: 'expo_push_token',
      });

    if (error) {
      console.warn('[push] Falha ao gravar device_tokens:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    // Cenario comum: emulador sem Google Play Services. Nao blocar login.
    console.warn('[push] Erro inesperado (intencionalmente silenciado):', err);
    return false;
  }
}
