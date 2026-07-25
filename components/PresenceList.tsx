/**
 * components/PresenceList.tsx
 * Task: T2.2 - Lista de presencas com cabecalho + capacidade + corte visual.
 *
 * Renderiza:
 *   - Cabecalho com titulo + contador (count) + (opcional) capacidade X/Y.
 *   - "Corte" visual na `splitAt` (linha tracejada + label) para exibir
 *     a partir de qual index comeca a "reserva" (capacidade atingida).
 *   - Lista vertical de PlayerCard (mock em T2.2; bind real T2.3).
 *
 * Desacoplado de store: recebe items ja filtrados. T2.3 plugar selectors.
 *
 * Regras a11y:
 *   - Cabecalho agrupado como `header` (accessibilityRole).
 *   - Touch targets dos cards garantidos em PlayerCard (>=44pt).
 *   - Liste semântica (扁平).
 */

import { View, Text } from 'react-native';

import { PlayerCard, type PlayerCardProps } from './PlayerCard';

// ---- Types ----------------------------------------------------------------

export type PresenceItem = PlayerCardProps;

export interface PresenceListProps {
  /** Titulo PT-BR da lista (ex.: 'Confirmados'). */
  title: string;
  /** Items a renderizar (presenca ja formatada). */
  items: PresenceItem[];
  /** Contador adicional. Default: items.length. */
  count?: number;
  /** Capacidade maxima (ex.: 16 confirmados). Renderiza `count/capacity`. */
  capacity?: number;
  /** Index (0-based) a partir do qual renderiza a linha de corte (reserva). */
  splitAt?: number;
  /** Label da secao apos o split (ex.: 'Reservas'). */
  splitLabel?: string;
}

// ---- Componente ------------------------------------------------------------

export function PresenceList({
  title,
  items,
  count,
  capacity,
  splitAt,
  splitLabel = 'Reservas',
}: PresenceListProps) {
  const total = count ?? items.length;
  const hasSplit = typeof splitAt === 'number' && splitAt > 0 && splitAt < items.length;

  const beforeSplit = hasSplit ? items.slice(0, splitAt) : items;
  const afterSplit = hasSplit ? items.slice(splitAt) : [];

  return (
    <View className="gap-2">
      <View accessibilityRole="header" className="flex-row items-baseline justify-between px-1">
        <Text className="text-pitch-600 text-sm font-semibold uppercase tracking-wide">
          {title}
        </Text>
        <Text className="text-pitch-900 text-sm font-semibold">
          {capacity ? `${total}/${capacity}` : total}
        </Text>
      </View>

      {beforeSplit.length > 0 ? (
        <View className="gap-2">
          {beforeSplit.map((item) => (
            <PlayerCard key={item.fullName} {...item} />
          ))}
        </View>
      ) : (
        <Text className="text-pitch-400 px-1 py-4 text-center text-sm italic">{title} vazia</Text>
      )}

      {hasSplit && afterSplit.length > 0 ? (
        <View className="gap-2">
          <View accessibilityRole="none" className="my-1 flex-row items-center gap-2">
            <View className="border-pitch-300 h-px flex-1 border-t border-dashed" />
            <Text className="text-pitch-500 text-xs font-medium uppercase">{splitLabel}</Text>
            <View className="border-pitch-300 h-px flex-1 border-t border-dashed" />
          </View>
          {afterSplit.map((item) => (
            <PlayerCard key={item.fullName} {...item} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
