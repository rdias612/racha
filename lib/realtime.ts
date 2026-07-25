/**
 * lib/realtime.ts
 * Task: T2.1 - Subscriptions Supabase Realtime centralizadas.
 *
 * Por que existir (YAGNI-aware):
 *   - Stores Zustand sao puras (sem IO). Realtime IO fica aqui para manter
 *     testabilidade das stores e duracao de vida cleanup-friendly.
 *
 * Cobertura:
 *   - subscribePresences(matchId) - escuta INSERT/UPDATE/DELETE em
 *     match_presences para o match corrente. Repassa payload para a store.
 *   - subscribePayments(groupId) - escuta mutacoes em payments do grupo.
 *
 * Restricoes:
 *   - Realtime respeita RLS por padrao no Supabase (so chegam registros
 *     que o usuario poderia ler via SELECT).
 *   - Cada funcao retorna um `RealtimeChannel` em estado conectado; o caller
 *     deve chamar `.unsubscribe()` + `supabase.removeChannel(...)` no cleanup.
 *
 * Payload:
 *   - O callback `postgres_changes` entrega `new` (INSERT/UPDATE) e `old`
 *     (parcial, apenas PK por default). Suficiente para a store local.
 *   - Em DELETE sem replica identity full, so `old.id` esta disponivel.
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { usePresenceStore } from '@/stores/presence';
import { usePaymentStore } from '@/stores/payment';
import type { MatchPresenceRow, PaymentRow } from '@/types/database.types';

type PresencePayload =
  | { eventType: 'INSERT'; new: MatchPresenceRow }
  | { eventType: 'UPDATE'; new: MatchPresenceRow }
  | { eventType: 'DELETE'; old: { id: string } };

type PaymentPayload =
  | { eventType: 'INSERT'; new: PaymentRow }
  | { eventType: 'UPDATE'; new: PaymentRow }
  | { eventType: 'DELETE'; old: { id: string } };

/**
 * Subscreve mutacoes de MATCH_PRESENCES filtrando por match_id.
 * Retorna o canal para que o caller faca cleanup.
 */
export function subscribePresences(matchId: string): RealtimeChannel {
  const presenceStore = usePresenceStore.getState();

  const onChange = (payload: RealtimePostgresChangesPayload<MatchPresenceRow>) => {
    const typed = payload as unknown as PresencePayload;
    switch (typed.eventType) {
      case 'INSERT':
        presenceStore.addPresence(typed.new);
        break;
      case 'UPDATE':
        presenceStore.upsertPresence(typed.new.id, typed.new);
        break;
      case 'DELETE':
        presenceStore.removePresence(typed.old.id);
        break;
    }
  };

  return supabase
    .channel(`match_presences:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'match_presences',
        filter: `match_id=eq.${matchId}`,
      },
      onChange,
    )
    .subscribe();
}

/**
 * Subscreve mutacoes de PAYMENTS filtrando por group_id.
 */
export function subscribePayments(groupId: string): RealtimeChannel {
  const paymentStore = usePaymentStore.getState();

  const onChange = (payload: RealtimePostgresChangesPayload<PaymentRow>) => {
    const typed = payload as unknown as PaymentPayload;
    switch (typed.eventType) {
      case 'INSERT':
        paymentStore.addPayment(typed.new);
        break;
      case 'UPDATE':
        paymentStore.upsertPayment(typed.new.id, typed.new);
        break;
      case 'DELETE':
        paymentStore.removePayment(typed.old.id);
        break;
    }
  };

  return supabase
    .channel(`payments:${groupId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `group_id=eq.${groupId}`,
      },
      onChange,
    )
    .subscribe();
}

/**
 * Cleanup helper: unsubscribe + remove do cliente Supabase.
 * Aceita undefined (no-op) para callers simplificarem o useEffect cleanup.
 */
export async function disposeChannel(channel: RealtimeChannel | undefined): Promise<void> {
  if (!channel) return;
  try {
    await supabase.removeChannel(channel);
  } catch {
    // Erros de cleanup sao nao-fatais (e.g. app sendo desmontado).
  }
}
