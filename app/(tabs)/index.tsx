/**
 * app/(tabs)/index.tsx
 * Tasks: T2.2 (layout 3 listas) + T2.3 (bind UI <-> store/RSVP).
 *
 * Layout:
 *   1. Confirmados: ate 16 jogadores, com corte visual a partir do 17
 *      (reservas) e exibicao X/16 no cabecalho.
 *   2. Pendentes: avulso que ainda nao foi aprovado pelo admin.
 *   3. Fila de espera: FIFO com posicao #1 destacada como proxima.
 *
 * T2.3: troca mock data por `usePresenceStore` (fetch + Realtime T2.1);
 * plugar handlers confirm/decline com rebate FIFO M4 respeitando cutoff.
 * Toast fallback PT-BR via Alert.alert (sem nova dep; ver package.json).
 */

import { useEffect, useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PresenceList, type PresenceItem } from '@/components/PresenceList';
import { ShareButton } from '@/components/ShareButton';
import { usePresenceStore } from '@/stores/presence';
import { useProfileStore } from '@/stores/profile';
import { useAuth } from '@/hooks/useAuth';
import type { ProfileRow, RsvpStatus, UserType } from '@/types/database.types';

// ---- Constantes de dominio -------------------------------------------------

/** Capacidade maxima de confirmados: 2 goleiros + 14 jogadores (PRD). */
const CONFIRMED_CAPACITY = 16;

/**
 * Match corrente (MVP = 1 grupo fixo). T2.0 garante FK valida.
 * Placeholder enquanto T2.0 nao plugar match corrente do store.
 */
const CURRENT_MATCH_ID = '00000000-0000-0000-0000-000000000002';
const CURRENT_MATCH_DATE_TIME = '2026-07-24T22:00:00.000Z'; // quinta 19:00 BRT

// ---- Helper: fallback PT-BR de perfil -------------------------------------
//
// Quando o JOIN opcional com profiles ainda nao carregou (cenario edge),
// usamos placeholders PT-BR. Regra de ouro: nunca exibir nome tecnico.
type ProfileProjection = Pick<ProfileRow, 'full_name' | 'user_type' | 'avatar_url'>;

const placeholderProfile: ProfileProjection = {
  full_name: 'Jogador',
  user_type: 'avulso',
  avatar_url: null,
};

// ---- Adaptador store -> PresenceItem --------------------------------------

type StorePresence = ReturnType<typeof usePresenceStore.getState>['presences'][number];

function toPresenceItem(
  row: StorePresence,
  queuePosition: number | undefined,
  handlers: {
    onConfirm?: () => void;
    onLeave?: () => void;
  },
): PresenceItem {
  const profile = (row as { profile?: ProfileProjection }).profile ?? placeholderProfile;
  return {
    fullName: profile.full_name,
    userType: profile.user_type as UserType,
    status: row.status as RsvpStatus,
    queuePosition,
    onConfirm: handlers.onConfirm,
    onLeave: handlers.onLeave,
  };
}

// ---- Tela ------------------------------------------------------------------

export default function HomeScreen() {
  const presences = usePresenceStore((s) => s.presences);
  const loading = usePresenceStore((s) => s.loading);
  const error = usePresenceStore((s) => s.error);
  const fetchPresences = usePresenceStore((s) => s.fetchPresences);
  const confirmPresence = usePresenceStore((s) => s.confirmPresence);
  const declinePresence = usePresenceStore((s) => s.declinePresence);
  const { user } = useAuth();
  const currentUserId = user?.id;
  // Gate admin (T3.2): botao Compartilhar so aparece para admin.
  const currentProfile = useProfileStore((s) => s.currentProfile);
  const isAdmin = Boolean(currentProfile?.is_admin);

  // Boot T2.3: carrega presencas do match corrente (mock substituido por store).
  useEffect(() => {
    void fetchPresences(CURRENT_MATCH_ID);
  }, [fetchPresences]);

  // Handlers RSVP - toast PT-BR via Alert.alert (sem nova dep; ver constraints).
  const handleConfirm = (user_id: string, user_type: UserType) => () => {
    void (async () => {
      const ok = await confirmPresence({
        match_id: CURRENT_MATCH_ID,
        user_id,
        user_type,
        match: { date_time: CURRENT_MATCH_DATE_TIME },
      });
      // Erro ja esta em `error` (reativo). Apenas toasta aqui.
      if (!ok) {
        const msg = usePresenceStore.getState().error ?? 'Falha ao confirmar presenca.';
        Alert.alert('Presenca', msg);
      }
    })();
  };

  const handleLeave = (user_id: string, user_type: UserType) => () => {
    void (async () => {
      const ok = await declinePresence({
        match_id: CURRENT_MATCH_ID,
        user_id,
        user_type,
      });
      if (!ok) {
        const msg = usePresenceStore.getState().error ?? 'Falha ao desistir da presenca.';
        Alert.alert('Presenca', msg);
      }
    })();
  };

  // Build das 3 listas. Handlers so aparecem para a linha do proprio usuario.
  const { confirmedItems, pendingItems, waitingItems } = useMemo(() => {
    // Ordena por created_at ASC para FIFO estavel na waiting_list.
    const byCreatedAsc = [...presences].sort((a, b) => a.created_at.localeCompare(b.created_at));

    const confirmed = byCreatedAsc.filter((p) => p.status === 'confirmed');
    const pending = byCreatedAsc.filter((p) => p.status === 'pending_approval');
    const waiting = byCreatedAsc.filter((p) => p.status === 'waiting_list');

    const buildHandlers = (row: StorePresence) => {
      const profile = (row as { profile?: ProfileProjection }).profile ?? placeholderProfile;
      const isSelf = row.user_id === currentUserId;
      if (!isSelf) return {};
      // Apenas o proprio usuario confirma/desiste da sua linha.
      // Admin approval de pending fica para a tela admin (fora do escopo T2.3).
      return {
        onConfirm: handleConfirm(row.user_id, profile.user_type),
        onLeave: handleLeave(row.user_id, profile.user_type),
      };
    };

    return {
      confirmedItems: confirmed.map((row) => toPresenceItem(row, undefined, buildHandlers(row))),
      pendingItems: pending.map((row) => toPresenceItem(row, undefined, buildHandlers(row))),
      waitingItems: waiting.map((row, i) => toPresenceItem(row, i + 1, buildHandlers(row))),
    };
  }, [presences, currentUserId]);

  return (
    <SafeAreaView className="bg-pitch-50 flex-1" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-4">
        <View>
          <Text className="text-pitch-900 text-2xl font-bold">Presenca</Text>
          <Text className="text-pitch-500 mt-1 text-sm">Quinta-feira - Pelada do mes</Text>
        </View>

        {/* T3.2: Botao Compartilhar - gate admin. */}
        {isAdmin ? (
          <ShareButton
            matchLabel="Quinta-feira - Pelada do mes"
            confirmed={confirmedItems.map((p) => ({ fullName: p.fullName }))}
            pending={pendingItems.map((p) => ({ fullName: p.fullName }))}
            waiting={waitingItems.map((p) => ({ fullName: p.fullName }))}
          />
        ) : null}

        {/* Erro reativo PT-BR (nao bloqueia listas). */}
        {error ? (
          <View className="border-danger/30 bg-danger/5 rounded-lg border px-3 py-2">
            <Text className="text-danger text-sm">{error}</Text>
          </View>
        ) : null}

        {loading && presences.length === 0 ? (
          <Text className="text-pitch-400 px-1 py-4 text-center text-sm italic">
            Carregando presencas...
          </Text>
        ) : null}

        <PresenceList
          title="Confirmados"
          items={confirmedItems}
          capacity={CONFIRMED_CAPACITY}
          splitAt={CONFIRMED_CAPACITY}
          splitLabel="Reservas"
        />

        <PresenceList title="Pendentes" items={pendingItems} />

        <PresenceList title="Fila de espera" items={waitingItems} />
      </ScrollView>
    </SafeAreaView>
  );
}
