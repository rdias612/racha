/**
 * app/(tabs)/admin/pending.tsx
 * Task: T3.1 - UI admin para promover/rejeitar avulsos pendentes.
 *
 * Funcionalidades (PT-BR):
 *   - Listar avulsos pendentes (status='pending_approval') do proximo MATCH.
 *   - Botao "Promover" -> approvePending() (pending_approval -> confirmed).
 *   - Botao "Rejeitar" -> rejectPending() (declined + dispara FIFO automatico).
 *   - Banner explicativo: rejeicao dispara promocao automatica do proximo
 *     avulso em waiting_list.
 *
 * Acesso: requer RLS is_admin() (gates dentro das functions SECURITY DEFINER
 * + policy match_presences_update_policy T1.7).
 * Rota nao e aba: exposta via Perfil -> "Gerenciar pendentes (admin)".
 *
 * TDD: logica pura testada em tests/fifo.smoke.ts (friendlyFifoError).
 *      Validacao end-to-end em device fica como handoff.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Card } from '@/components/ui';
import {
  approvePending,
  listPendingApprovals,
  rejectPending,
  type PendingWithProfile,
} from '@/lib/fifo';

function alertInfo(title: string, msg: string) {
  Alert.alert(title, msg, [{ text: 'OK', style: 'cancel' }]);
}

export default function AdminPendingScreen() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPendingApprovals();
      setPending(list);
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

  const sortedPending = useMemo(
    () => [...pending].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [pending],
  );

  const handleApprove = useCallback(
    (item: PendingWithProfile) => {
      Alert.alert(
        'Promover avulso',
        `Confirmar ${item.profile?.username ?? 'jogador'} na partida?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Promover',
            onPress: async () => {
              setBusyId(item.id);
              setError(null);
              try {
                await approvePending(item.id);
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusyId(null);
              }
            },
          },
        ],
      );
    },
    [refresh],
  );

  const handleReject = useCallback(
    (item: PendingWithProfile) => {
      Alert.alert(
        'Rejeitar avulso',
        `Rejeitar ${item.profile?.username ?? 'jogador'}? O proximo da fila (waiting_list) sera promovido automaticamente.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Rejeitar',
            style: 'destructive',
            onPress: async () => {
              setBusyId(item.id);
              setError(null);
              try {
                const promoted = await rejectPending(item.id);
                await refresh();
                if (promoted) {
                  alertInfo(
                    'Vaga preenchida',
                    'O proximo avulso da fila foi promovido automaticamente.',
                  );
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusyId(null);
              }
            },
          },
        ],
      );
    },
    [refresh],
  );

  const renderItem = ({ item }: { item: PendingWithProfile }) => {
    const name = item.profile?.username ?? 'Jogador';
    const userType = item.profile?.user_type ?? 'avulso';
    const isBusy = busyId === item.id;
    return (
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-pitch-900">{name}</Text>
            <Text className="mt-0.5 text-xs uppercase text-pitch-600">{userType}</Text>
          </View>
        </View>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <Button
            title="Promover"
            onPress={() => handleApprove(item)}
            loading={isBusy}
            variant="primary"
          />
          <Button
            title="Rejeitar"
            onPress={() => handleReject(item)}
            loading={isBusy}
            variant="danger"
          />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-pitch-50">
      <View className="flex-1 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-pitch-900">Pendentes (admin)</Text>
          <Pressable onPress={() => router.replace('/(tabs)/perfil')}>
            <Text className="text-sm text-field-dark">Voltar</Text>
          </Pressable>
        </View>

        <Card>
          <Text className="text-sm font-semibold text-pitch-900">Como funciona</Text>
          <Text className="mt-1 text-xs text-pitch-600">
            Avulsos em waiting_list sobem por FIFO (mais antigo primeiro). Ao rejeitar um pendente,
            o proximo da fila e promovido automaticamente.
          </Text>
        </Card>

        <View className="mt-2 flex-1">
          <Text className="mb-2 text-base font-semibold text-pitch-900">Jogadores pendentes</Text>
          {loading ? (
            <ActivityIndicator />
          ) : sortedPending.length === 0 ? (
            <Card>
              <Text className="text-pitch-600">Nenhum pendente no momento.</Text>
            </Card>
          ) : (
            <FlatList
              data={sortedPending}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerClassName="gap-2"
            />
          )}
        </View>

        {error ? (
          <Card>
            <Text className="text-sm text-danger">{error}</Text>
          </Card>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
