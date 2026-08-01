/**
 * app/(tabs)/perfil.tsx
 * Task: T2.0 - adiciona entrada de admin para gerenciar matches.
 *
 * Mantém o placeholder anterior; adiciona botão visível apenas para
 * usuários com profiles.is_admin=true. RLS já protege (tela bateria de
 * testes), o link é conveniência de UX.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { StatBadge } from '@/components/StatBadge';
import { Button, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import type { ProfileRow } from '@/types/database.types';

type PlayerStats = {
  goals: number;
  assists: number;
  ownGoals: number;
};

type ParticipantStatsRow = {
  goals_scored: number;
  goals_assisted: number;
  own_goals: number;
};

const EMPTY_STATS: PlayerStats = { goals: 0, assists: 0, ownGoals: 0 };

const USER_TYPE_LABELS: Record<ProfileRow['user_type'], string> = {
  mensalista: 'Mensalista',
  avulso: 'Avulso',
  goleiro_pago: 'Goleiro pago',
};

export default function PerfilScreen() {
  const router = useRouter();
  const { profile: activeProfile, signOut } = useAuth();
  const isAdmin = useIsAdmin(activeProfile?.id);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stats, setStats] = useState<PlayerStats>(EMPTY_STATS);
  const [signingOut, setSigningOut] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!activeProfile) return;
        const [{ data: profileData, error: profileError }, { data: participantData, error }] =
          await Promise.all([
            supabase.from('profiles').select('*').eq('id', activeProfile.id).maybeSingle(),
            supabase
              .from('match_participants')
              .select('goals_scored, goals_assisted, own_goals')
              .eq('player_id', activeProfile.id),
          ]);
        if (profileError || error) return;

        const nextStats = ((participantData ?? []) as ParticipantStatsRow[]).reduce<PlayerStats>(
          (total, participant) => ({
            goals: total.goals + participant.goals_scored,
            assists: total.assists + participant.goals_assisted,
            ownGoals: total.ownGoals + participant.own_goals,
          }),
          EMPTY_STATS,
        );

        if (mounted) {
          setProfile(profileData);
          setStats(nextStats);
        }
      } catch {
        if (mounted) {
          setProfile(null);
          setStats(EMPTY_STATS);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeProfile]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Senha invalida', 'Use pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== passwordConfirmation) {
      Alert.alert('Senhas diferentes', 'A confirmacao precisa ser igual a nova senha.');
      return;
    }

    setChangingPassword(true);
    try {
      if (!activeProfile) throw new Error('Sessão expirada. Faça login novamente.');
      const { error } = await supabase
        .from('profiles')
        .update({ password: newPassword })
        .eq('id', activeProfile.id);
      if (error) throw error;
      setNewPassword('');
      setPasswordConfirmation('');
      Alert.alert('Senha alterada', 'Sua nova senha ja esta ativa.');
    } catch (error) {
      Alert.alert('Falha ao alterar senha', error instanceof Error ? error.message : String(error));
    } finally {
      setChangingPassword(false);
    }
  };

  const initials = profile?.username
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <ScrollView className="flex-1 bg-pitch-50" contentContainerClassName="gap-4 p-4 pb-8">
      <Text className="text-2xl font-bold text-pitch-900">Perfil</Text>

      {loading ? (
        <ActivityIndicator accessibilityLabel="Carregando perfil" />
      ) : (
        <>
          <Card>
            <View className="flex-row items-center gap-3">
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  className="h-16 w-16 rounded-full bg-pitch-100"
                  accessibilityLabel={`Avatar de ${profile.username}`}
                />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-full bg-field-light">
                  <Text className="text-xl font-bold text-field-dark">{initials || '?'}</Text>
                </View>
              )}
              <View className="flex-1 gap-1">
                <Text className="text-lg font-bold text-pitch-900">
                  {profile?.username || 'Jogador'}
                </Text>
                {profile ? (
                  <View className="self-start rounded-md bg-field/10 px-2 py-1">
                    <Text className="text-xs font-semibold text-field-dark">
                      {USER_TYPE_LABELS[profile.user_type]}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Card>

          <Card>
            <Text className="text-base font-bold text-pitch-900">Estatisticas</Text>
            <View className="flex-row gap-2">
              <StatBadge label="Gols" value={stats.goals} />
              <StatBadge label="Assistencias" value={stats.assists} />
              <StatBadge label="Gols contra" value={stats.ownGoals} />
            </View>
          </Card>

          <Card>
            <Text className="text-base font-bold text-pitch-900">Alterar senha</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Nova senha"
              placeholderTextColor="#64748b"
              className="mt-3 rounded-xl border border-pitch-200 bg-white px-4 py-3 text-pitch-900"
            />
            <TextInput
              value={passwordConfirmation}
              onChangeText={setPasswordConfirmation}
              secureTextEntry
              placeholder="Confirme a nova senha"
              placeholderTextColor="#64748b"
              className="mt-2 rounded-xl border border-pitch-200 bg-white px-4 py-3 text-pitch-900"
            />
            <View className="mt-3">
              <Button
                title="Salvar nova senha"
                onPress={handleChangePassword}
                loading={changingPassword}
              />
            </View>
          </Card>

          <Button title="Sair" onPress={handleSignOut} variant="danger" loading={signingOut} />

          {isAdmin ? (
            <View className="gap-2">
              <Pressable
                onPress={() => router.push('/(tabs)/admin/users')}
                className="min-h-[44px] justify-center rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">Jogadores (admin)</Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Ver, adicionar e resetar senha de jogadores
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/matches')}
                className="min-h-[44px] justify-center rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">
                  Gerenciar partidas (admin)
                </Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Criar / editar / cancelar partidas
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/pending')}
                className="min-h-[44px] justify-center rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">
                  Gerenciar pendentes (admin)
                </Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Promover / rejeitar avulsos (FIFO)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/payments')}
                className="min-h-[44px] justify-center rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">Pagamentos (admin)</Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Aprovar pagamentos marcados (dupla confirmação)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/expenses')}
                className="min-h-[44px] justify-center rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">Despesas (admin)</Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Goleiros / campo / outras - confirmar saídas do caixa
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/goleiros')}
                className="min-h-[44px] justify-center rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">
                  Goleiros pagos (admin)
                </Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Cadastrar goleiros sem login OAuth (sorteio fixo T6.1)
                </Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
