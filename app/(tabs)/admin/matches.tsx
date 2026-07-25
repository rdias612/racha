/**
 * app/(tabs)/admin/matches.tsx
 * Task: T2.0 - UI admin para criar/editar/cancelar MATCH.
 *
 * Funcionalidades (PT-BR):
 *   - Listar MATCHES do group fixo (ordem por data desc).
 *   - Criar novo (entrada "dd/MM/yyyy HH:mm" -> UTC).
 *   - Editar date_time de um MATCH existente.
 *   - Cancelar match (status=cancelled) e reabrir.
 *
 * Acesso: require RLS is_admin() (matches_insert/update policies T1.7).
 * Rota não é aba: exposta via Perfil -> "Gerenciar partidas (admin)".
 *
 * Draft manual de validação (sucesso = ações sem erro).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Card } from '@/components/ui';
import {
  cancelMatch,
  createMatch,
  formatDateTimeBRT,
  listMatches,
  parsePtBRDateTime,
  reopenMatch,
  updateMatchDateTime,
  type MatchRow,
} from '@/lib/matches';

interface ConfirmButton {
  text: string;
  style?: 'cancel' | 'default' | 'destructive';
  onPress?: () => void;
}

const FMT_HINT = 'dd/MM/yyyy HH:mm';
const FMT_EXAMPLE = 'Ex.: 31/07/2026 19:00';

function alertInfo(title: string, msg: string) {
  const buttons: ConfirmButton[] = [{ text: 'OK', style: 'cancel' }];
  Alert.alert(title, msg, buttons);
}

export default function AdminMatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form novo match
  const [newDateTime, setNewDateTime] = useState('');
  const [creating, setCreating] = useState(false);

  // edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDateTime, setEditDateTime] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listMatches();
      setMatches(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      /* swallowed: refresh já seta error state */
    });
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    const iso = parsePtBRDateTime(newDateTime);
    if (!iso) {
      alertInfo('Data inválida', `Use ${FMT_HINT}. ${FMT_EXAMPLE}.`);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createMatch({ date_time_iso: iso });
      setNewDateTime('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [newDateTime, refresh]);

  const startEdit = useCallback((match: MatchRow) => {
    setEditingId(match.id);
    setEditDateTime('');
  }, []);

  const handleSaveEdit = useCallback(
    async (match: MatchRow) => {
      const iso = parsePtBRDateTime(editDateTime);
      if (!iso) {
        alertInfo('Data inválida', `Use ${FMT_HINT}. ${FMT_EXAMPLE}.`);
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await updateMatchDateTime(match.id, iso);
        setEditingId(null);
        setEditDateTime('');
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [editDateTime, refresh],
  );

  const handleCancel = useCallback(
    (match: MatchRow) => {
      Alert.alert(
        'Cancelar partida',
        `Cancelar partida de ${formatDateTimeBRT(match.date_time)}?`,
        [
          { text: 'Não', style: 'cancel' },
          {
            text: 'Cancelar partida',
            style: 'destructive',
            onPress: async () => {
              try {
                await cancelMatch(match.id);
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            },
          },
        ],
      );
    },
    [refresh],
  );

  const handleReopen = useCallback(
    async (match: MatchRow) => {
      try {
        await reopenMatch(match.id);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh],
  );

  const renderItem = ({ item }: { item: MatchRow }) => {
    const isEditing = editingId === item.id;
    const statusColor =
      item.status === 'cancelled'
        ? 'text-danger'
        : item.status === 'active'
          ? 'text-goalkeeper'
          : item.status === 'finished'
            ? 'text-pitch-500'
            : 'text-field-dark';

    return (
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-pitch-900 text-base font-semibold">
              {formatDateTimeBRT(item.date_time)}
            </Text>
            <Text className={`mt-0.5 text-xs uppercase ${statusColor}`}>{item.status}</Text>
          </View>
        </View>

        {isEditing ? (
          <View className="mt-2 gap-2">
            <TextInput
              value={editDateTime}
              onChangeText={setEditDateTime}
              placeholder={`${FMT_HINT} (${FMT_EXAMPLE})`}
              placeholderTextColor="#94a3b8"
              className="border-pitch-300 text-pitch-900 rounded-lg border px-3 py-2"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View className="flex-row gap-2">
              <Button
                title="Salvar"
                onPress={() => handleSaveEdit(item)}
                loading={saving}
                variant="primary"
              />
              <Button title="Voltar" onPress={() => setEditingId(null)} variant="ghost" />
            </View>
          </View>
        ) : (
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Button title="Editar" onPress={() => startEdit(item)} variant="secondary" />
            {item.status === 'cancelled' ? (
              <Button title="Reabrir" onPress={() => handleReopen(item)} variant="ghost" />
            ) : (
              <Button title="Cancelar match" onPress={() => handleCancel(item)} variant="danger" />
            )}
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView className="bg-pitch-50 flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="gap-3 p-4" keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between">
            <Text className="text-pitch-900 text-xl font-bold">Gerenciar partidas</Text>
            <Pressable onPress={() => router.replace('/(tabs)/perfil')}>
              <Text className="text-field-dark text-sm">Voltar</Text>
            </Pressable>
          </View>

          <Card>
            <Text className="text-pitch-900 text-base font-semibold">Criar nova partida</Text>
            <Text className="text-pitch-600 mt-1 text-xs">
              Use {FMT_HINT}. {FMT_EXAMPLE}. Horário BRT (será salvo em UTC).
            </Text>
            <TextInput
              value={newDateTime}
              onChangeText={setNewDateTime}
              placeholder={FMT_EXAMPLE}
              placeholderTextColor="#94a3b8"
              className="border-pitch-300 text-pitch-900 mt-2 rounded-lg border px-3 py-2"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View className="mt-2">
              <Button title="Criar partida" onPress={handleCreate} loading={creating} />
            </View>
          </Card>

          <View>
            <Text className="text-pitch-900 mb-2 text-base font-semibold">Partidas</Text>
            {loading ? (
              <ActivityIndicator />
            ) : matches.length === 0 ? (
              <Card>
                <Text className="text-pitch-600">Nenhuma partida encontrada.</Text>
              </Card>
            ) : (
              <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                scrollEnabled={false}
                contentContainerClassName="gap-2"
              />
            )}
          </View>

          {error ? (
            <Card>
              <Text className="text-danger text-sm">{error}</Text>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
