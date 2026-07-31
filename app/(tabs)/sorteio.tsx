/**
 * app/(tabs)/sorteio.tsx
 * Task: T6.1 - Tela Sorteio de times (admin dispara, todos visualizam).
 *
 * Funcionalidades (PT-BR):
 *   - Admin: botao "Sortear times" que chama RPC draw_teams(match_id)
 *     (congela confirmados em MATCH_PARTICIPANTS + seta match->active).
 *   - Todos: exibicao dos 2 times em colunas (team_group 1 e 2) com
 *     goleiros destacados (is_goalkeeper=true).
 *   - Estados: loading inicial, sorteio pendente (sem participantes),
 *     erro PT-BR via Alert.alert (sem nova dep).
 *
 * Acesso: leitura para todos do grupo (RLS select T1.7); botao sortear
 * so aparece para admin (gate is_admin do profile).
 *
 * Validacao manual (AC T6.1): 3 sorteios consecutivos devem gerar combinacoes
 * diferentes; 2 goleiros em times opostos.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Card } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { fetchTeamsByMatch, drawTeams, friendlyError, type DrawnTeams } from '@/lib/teams';
import { FIXED_MATCH_ID } from '@/lib/matches';
import type { ProfileRow } from '@/types/database.types';

type TeamMember = ProfileRow & { is_goalkeeper: boolean };

interface ConfirmButton {
  text: string;
  style?: 'cancel' | 'default' | 'destructive';
  onPress?: () => void;
}

function alertInfo(title: string, msg: string) {
  const buttons: ConfirmButton[] = [{ text: 'OK', style: 'cancel' }];
  Alert.alert(title, msg, buttons);
}

function TeamColumn({
  title,
  color,
  members,
}: {
  title: string;
  color: string;
  members: TeamMember[];
}) {
  return (
    <View className="flex-1">
      <Text className={`text-center text-base font-bold ${color}`}>{title}</Text>
      <Text className="mb-2 text-center text-xs text-pitch-600">
        {members.length} jogador{members.length === 1 ? '' : 'es'}
      </Text>
      <View className="gap-2">
        {members.length === 0 ? (
          <Text className="text-center text-sm text-pitch-500">Vazio</Text>
        ) : (
          members.map((m) => (
            <View
              key={m.id}
              className={`rounded-lg border px-3 py-2 ${
                m.is_goalkeeper
                  ? 'border-goalkeeper bg-goalkeeper/10'
                  : 'border-pitch-200 bg-pitch-50'
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-sm font-semibold text-pitch-900" numberOfLines={1}>
                  {m.full_name}
                </Text>
                {m.is_goalkeeper ? (
                  <Text className="text-[10px] font-bold uppercase text-goalkeeper">GK</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export default function SorteioScreen() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);

  const [teams, setTeams] = useState<DrawnTeams | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTeamsByMatch(FIXED_MATCH_ID);
      setTeams(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      /* swallowed: refresh ja seta error state */
    });
  }, [refresh]);

  const handleDraw = useCallback(() => {
    Alert.alert(
      'Sortear times',
      'Sortear os times agora? A lista de confirmados sera congelada e a partida iniciada.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sortear',
          style: 'default',
          onPress: async () => {
            setDrawing(true);
            setError(null);
            try {
              await drawTeams(FIXED_MATCH_ID);
              await refresh();
            } catch (e) {
              const msg = e instanceof Error ? e.message : friendlyError(null);
              setError(msg);
              alertInfo('Erro ao sortear', msg);
            } finally {
              setDrawing(false);
            }
          },
        },
      ],
    );
  }, [refresh]);

  const team1 = useMemo<TeamMember[]>(() => teams?.team1 ?? [], [teams]);
  const team2 = useMemo<TeamMember[]>(() => teams?.team2 ?? [], [teams]);
  const hasDraw = team1.length > 0 || team2.length > 0;
  const goalkeepersCount = useMemo(
    () => [...team1, ...team2].filter((m) => m.is_goalkeeper).length,
    [team1, team2],
  );

  return (
    <SafeAreaView className="flex-1 bg-pitch-50">
      <ScrollView contentContainerClassName="gap-3 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-pitch-900">Sorteio de times</Text>
          {hasDraw ? (
            <Text className="text-xs text-pitch-600">
              {team1.length + team2.length} jogadores - {goalkeepersCount} goleiro
              {goalkeepersCount === 1 ? '' : 'es'}
            </Text>
          ) : null}
        </View>

        {isAdmin ? (
          <Card>
            <Text className="text-base font-semibold text-pitch-900">Iniciar partida</Text>
            <Text className="mt-1 text-xs text-pitch-600">
              Sorteia aleatoriamente 2 times (7+1 goleiro em cada) e congela a lista de confirmados.
            </Text>
            <View className="mt-3">
              <Button
                title={drawing ? 'Sorteando...' : 'Sortear times'}
                onPress={handleDraw}
                loading={drawing}
                disabled={drawing}
              />
            </View>
          </Card>
        ) : null}

        {loading ? (
          <ActivityIndicator className="mt-8" />
        ) : hasDraw ? (
          <View className="flex-row gap-3">
            <TeamColumn title="Time 1" color="text-field-dark" members={team1} />
            <View className="w-px bg-pitch-200" />
            <TeamColumn title="Time 2" color="text-goalkeeper" members={team2} />
          </View>
        ) : (
          <Card>
            <Text className="text-base font-semibold text-pitch-900">Sem sorteio ainda</Text>
            <Text className="mt-1 text-sm text-pitch-600">
              {isAdmin
                ? 'Toque em "Sortear times" para iniciar a partida.'
                : 'O administrador ainda nao realizou o sorteio.'}
            </Text>
          </Card>
        )}

        {error ? (
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-sm text-danger">{error}</Text>
              <Pressable onPress={() => refresh()}>
                <Text className="text-sm text-field-dark">Tentar novamente</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
