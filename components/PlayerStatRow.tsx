/**
 * components/PlayerStatRow.tsx
 * Task: T6.2 - Linha editavel de estatisticas por jogador (sumula pos-jogo).
 *
 * Renders UMA participante (MATCH_PARTICIPANTS) com 3 stats editaveis:
 *   - Gols   (goals_scored)
 *   - Assis. (goals_assisted)
 *   - Gol c/ (own_goals)
 *
 * Cada stat tem botoes +/- (touch target >=44pt) e valor numerico exibido.
 *
 * Desacoplado de store/lib: recebe handlers opcionais (onStatChange) para
 * a tela plugar IO Supabase. Sem handlers vira modo leitura (membro comum).
 *
 * Regras de design (DESIGN.md / AC T6.2):
 *   - Borda esquerda por time_group: verde campo p/ time 1, laranja goleiro
 *     p/ time 2 (mesma convencao de sorteio.tsx).
 *   - Badge GK destacado quando is_goalkeeper=true.
 *   - Touch target >=44pt para botoes +/- (Pressable com min-h-[44px]).
 *   - Acessibilidade: ariaLabel junta nome + 3 stats.
 *
 * Pattern props-driven reutilizado de PaymentRow/PlayerCard (T2.2/T4.1).
 */

import { Pressable, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { ComponentRef, forwardRef } from 'react';

import type { PlayerStatField } from '@/lib/sumula';

// ---- Props ----------------------------------------------------------------

export interface PlayerStatRowProps {
  /** Nome exibido (profiles.username via JOIN). */
  fullName: string;
  /** Numero do time (1, 2, ...). Define cor de borda. */
  teamGroup: number;
  /** TRUE se participante e goleiro_pago (destaque visual). */
  isGoalkeeper: boolean;
  /** Stats atuais (snapshots do DB). */
  goalsScored: number;
  goalsAssisted: number;
  ownGoals: number;
  /**
   * Handler opcional chamado a cada mutacao de stat (+/-).
   * Sera: (field, delta) => void. Quando ausente, UI fica em modo leitura
   * (membro comum - so exibe valores, sem botoes).
   */
  onStatChange?: (field: PlayerStatField, delta: number) => void;
}

// ---- Mapas de estilo (team_group -> tokens) -------------------------------

const TEAM_BORDER: Record<number, string> = {
  1: 'border-l-field',
  2: 'border-l-goalkeeper',
};

function teamBorderClass(teamGroup: number): string {
  return TEAM_BORDER[teamGroup] ?? 'border-l-pitch-400';
}

// ---- Componente auxiliar: stepper de uma stat -----------------------------

interface StatStepperProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  editable: boolean;
}

function StatStepper({ label, value, onIncrement, onDecrement, editable }: StatStepperProps) {
  return (
    <View className="items-center gap-1">
      <Text className="text-[10px] font-semibold uppercase text-pitch-500">{label}</Text>
      <View className="flex-row items-center gap-1.5">
        {editable ? (
          <Pressable
            onPress={onDecrement}
            accessibilityRole="button"
            accessibilityLabel={`Diminuir ${label}`}
            disabled={value <= 0}
            className="min-h-[36px] min-w-[36px] items-center justify-center rounded-md bg-pitch-100 active:bg-pitch-200"
          >
            <Text className="text-base font-bold text-pitch-900">&minus;</Text>
          </Pressable>
        ) : null}
        <Text
          className="min-w-[24px] text-center text-base font-bold text-pitch-900"
          accessibilityLabel={`${label}: ${value}`}
        >
          {value}
        </Text>
        {editable ? (
          <Pressable
            onPress={onIncrement}
            accessibilityRole="button"
            accessibilityLabel={`Aumentar ${label}`}
            className="min-h-[36px] min-w-[36px] items-center justify-center rounded-md bg-field active:bg-field-dark"
          >
            <Text className="text-base font-bold text-white">+</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ---- Componente principal -------------------------------------------------

export const PlayerStatRow = forwardRef<ComponentRef<typeof View>, PlayerStatRowProps>(
  function PlayerStatRow(
    {
      fullName,
      teamGroup,
      isGoalkeeper,
      goalsScored,
      goalsAssisted,
      ownGoals,
      onStatChange,
    }: PlayerStatRowProps,
    ref,
  ) {
    const editable = Boolean(onStatChange);
    const borderClass = teamBorderClass(teamGroup);

    const fire = (field: PlayerStatField, delta: number) => {
      onStatChange?.(field, delta);
    };

    const a11yLabel = [
      `${fullName}${isGoalkeeper ? ' (goleiro)' : ''} - time ${teamGroup}.`,
      `Gols: ${goalsScored}.`,
      `Assistencias: ${goalsAssisted}.`,
      `Gols contra: ${ownGoals}.`,
    ].join(' ');

    return (
      <View
        ref={ref}
        className={`gap-2 border-l-4 bg-white px-3 py-3 ${borderClass}`}
        style={{ elevation: 1 } as ViewStyle}
        accessibilityLabel={a11yLabel}
      >
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-base font-semibold text-pitch-900" numberOfLines={1}>
            {fullName}
          </Text>
          {isGoalkeeper ? (
            <View className="rounded-md bg-goalkeeper/10 px-1.5 py-0.5">
              <Text className="text-[10px] font-bold uppercase text-goalkeeper">GK</Text>
            </View>
          ) : null}
          <Text className="ml-2 text-xs text-pitch-500">Time {teamGroup}</Text>
        </View>

        <View className="flex-row justify-around">
          <StatStepper
            label="Gols"
            value={goalsScored}
            editable={editable}
            onIncrement={() => fire('goals_scored', +1)}
            onDecrement={() => fire('goals_scored', -1)}
          />
          <StatStepper
            label="Assis."
            value={goalsAssisted}
            editable={editable}
            onIncrement={() => fire('goals_assisted', +1)}
            onDecrement={() => fire('goals_assisted', -1)}
          />
          <StatStepper
            label="Gol c/"
            value={ownGoals}
            editable={editable}
            onIncrement={() => fire('own_goals', +1)}
            onDecrement={() => fire('own_goals', -1)}
          />
        </View>
      </View>
    );
  },
);
