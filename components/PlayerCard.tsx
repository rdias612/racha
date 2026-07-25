/**
 * components/PlayerCard.tsx
 * Task: T2.2 - Card de jogador para listas de presenca.
 *
 * Renderiza UMA-presenca (player + status). Desacoplado de store:
 * recebe `onConfirm?` / `onLeave?` opcionais para T2.3 plugar handlers.
 *
 * Regras de design:
 *   - Badge lateral colorida por status (verde/amarelo/cinza/laranja goleiro).
 *   - user_type badge (Mensalista / Avulso / Goleiro) secundario.
 *   - Touch target >=44pt (min-h-[44px]) + botao低调 ghost com px-4 py-2.
 *   - Campo morto 'avatar' removido (N2): nome inicial em circulo substitui.
 *
 * Estados visuais (cor de borda-esquerda):
 *   - confirmed          -> success (#22c55e) - verde
 *   - pending_approval   -> warning (#eab308) - amarelo
 *   - waiting_list       -> pitch-400        - cinza
 *   - declined/absent    -> danger (#dc2626) - vermelho
 */

import { Pressable, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { ComponentRef, forwardRef } from 'react';

import type { RsvpStatus, UserType } from '@/types/database.types';

// ---- Props ----------------------------------------------------------------

export interface PlayerCardProps {
  /** Nome exibido (profiles.full_name). */
  fullName: string;
  /** Tipo de usuario (enum do DB). Define badge secundario. */
  userType: UserType;
  /** Status RSVP (enum do DB). Define cor de borda + label de status. */
  status: RsvpStatus;
  /** Posicao na fila FIFO (apenas para waiting_list). 1 = proximo. */
  queuePosition?: number;
  /** Handler opcional (T2.3). Quando ausente, botao nao renderiza. */
  onConfirm?: () => void;
  /** Handler opcional (T2.3). Quando ausente, botao nao renderiza. */
  onLeave?: () => void;
}

// ---- Mapas de estilo (status -> tokens) -----------------------------------

const STATUS_BORDER: Record<RsvpStatus, string> = {
  confirmed: 'border-l-success',
  pending_approval: 'border-l-warning',
  waiting_list: 'border-l-pitch-400',
  declined: 'border-l-danger',
};

const STATUS_LABEL: Record<RsvpStatus, string> = {
  confirmed: 'Confirmado',
  pending_approval: 'Pendente',
  waiting_list: 'Na fila',
  declined: 'Desistente',
};

/** Mapa user_type -> (label PT-BR + classes badge). */
const USER_TYPE_BADGE: Record<UserType, { label: string; classes: string }> = {
  mensalista: {
    label: 'Mensalista',
    classes: 'bg-field-light text-field-dark',
  },
  avulso: {
    label: 'Avulso',
    classes: 'bg-pitch-200 text-pitch-700',
  },
  goleiro_pago: {
    label: 'Goleiro',
    classes: 'bg-goalkeeper/10 text-goalkeeper',
  },
};

// ---- Helper: primeira inicial do nome -------------------------------------

function getInitial(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  return cleaned.charAt(0).toUpperCase();
}

// ---- Componente ------------------------------------------------------------

export const PlayerCard = forwardRef<ComponentRef<typeof View>, PlayerCardProps>(
  function PlayerCard(
    { fullName, userType, status, queuePosition, onConfirm, onLeave }: PlayerCardProps,
    ref,
  ) {
    const userTypeBadge = USER_TYPE_BADGE[userType];
    const isQueue = status === 'waiting_list';
    const showConfirm = Boolean(onConfirm);
    const showLeave = Boolean(onLeave);

    return (
      <View
        ref={ref}
        className={`flex-row items-center gap-3 border-l-4 bg-white py-3 pl-3 pr-2 ${STATUS_BORDER[status]}`}
        style={{ elevation: 1 } as ViewStyle}
        accessibilityLabel={`${STATUS_LABEL[status]}: ${fullName}, ${userTypeBadge.label}`}
      >
        <View
          className="bg-field-light h-10 w-10 items-center justify-center rounded-full"
          accessibilityElementsHidden
        >
          <Text className="text-field-dark text-base font-bold">{getInitial(fullName)}</Text>
        </View>

        <View className="flex-1 gap-1">
          <Text className="text-pitch-900 text-base font-medium" numberOfLines={1}>
            {fullName}
            {isQueue && typeof queuePosition === 'number' ? (
              <Text className="text-pitch-500 ml-1 text-xs">#{queuePosition}</Text>
            ) : null}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View className={`rounded-md px-1.5 py-0.5 ${userTypeBadge.classes}`}>
              <Text className="text-[10px] font-semibold uppercase">{userTypeBadge.label}</Text>
            </View>
          </View>
        </View>

        {showConfirm ? (
          <Pressable
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel={`Confirmar ${fullName}`}
            className="bg-field active:bg-field-dark min-h-[44px] items-center justify-center rounded-lg px-4 py-2"
          >
            <Text className="text-sm font-semibold text-white">Confirmar</Text>
          </Pressable>
        ) : null}

        {showLeave ? (
          <Pressable
            onPress={onLeave}
            accessibilityRole="button"
            accessibilityLabel={`Desistir ${fullName}`}
            className="bg-pitch-100 active:bg-pitch-200 min-h-[44px] items-center justify-center rounded-lg px-4 py-2"
          >
            <Text className="text-pitch-700 text-sm font-medium">Desistir</Text>
          </Pressable>
        ) : null}
      </View>
    );
  },
);
