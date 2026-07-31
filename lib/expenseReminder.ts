/**
 * lib/expenseReminder.ts
 * Task: T4.3 - Notificacao LOCAL pos-jogo no device do admin (IO apenas).
 *
 * Pure logic (shouldFireGoalkeeperReminder, formatReminderTitle/Body) fica
 * em lib/expenses.ts (testavel sem RN). Este modulo soh cuida do IO:
 *   - fireGoalkeeperReminderNow(amount): agenda notif local imediata.
 *
 * Por que LOCAL e nao server push:
 *   - Push via pg_cron vem na T5.2 (outro escopo).
 *   - T4.3 soh precisa avisar o admin quando MATCHES.status -> finished.
 *   - Admin escuta MATCHES via Realtime (lib/realtime.ts T4.3 wire) e,
 *     ao transitar para finished, chama fireGoalkeeperReminderNow aqui.
 *
 * Garantias:
 *   - Nunca lanca excecao (permissao negada / erro Contexto: silencioso).
 *   - Match null / amount invalid => nao dispara (YAGNI safe default).
 */

import * as Notifications from 'expo-notifications';

import { formatReminderBody, formatReminderTitle } from './expenses';

/**
 * Agenda notificacao LOCAL imediata para o admin (device corrente).
 * Falha silenciosa (push token nao requerido p/ notif local).
 */
export async function fireGoalkeeperReminderNow(
  amount: number,
  matchDateTimeIso?: string | null,
): Promise<void> {
  try {
    if (!Number.isFinite(Number(amount)) || Number(amount) < 0) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: formatReminderTitle(),
        body: formatReminderBody(Number(amount)),
        data: {
          kind: 'goalkeeper_reminder',
          amount: String(amount),
          matchDateTime: matchDateTimeIso ?? null,
        },
        sound: true,
      },
      trigger: { seconds: 1 } as Notifications.NotificationTriggerInput,
    });
  } catch (err) {
    // Cenario comum: emulador sem Google Play Services. Nao interrompe fluxo.
    console.warn('[expenseReminder] Falha ao agendar notificacao:', err);
  }
}
