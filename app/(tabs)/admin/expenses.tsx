/**
 * app/(tabs)/admin/expenses.tsx
 * Task: T4.3 - UI admin para EXPENSES (goleiros / campo / outras).
 *
 * Funcionalidades (PT-BR):
 *   - Form criar despesa: tipo (goalkeeper|field|other), valor, descricao.
 *     Tipo goalkeeper pre-preenche valor default de GROUPS.goalkeeper_expense (R$ 40).
 *   - Lista de despesas com toggle confirmed_at (snapshot final).
 *   - Remover despesa (Alert -> deleteExpense).
 *   - Atualizacao automatica via Realtime (lib/realtime.ts assina EXPENSES).
 *
 * Acesso: requer RLS is_admin() (policy expenses_* T1.7).
 * Rota nao e aba: exposta via Perfil -> "Despesas (admin)".
 *
 * Schema (T1.3a): tipo goalkeeper default = GROUPS.goalkeeper_expense (R$ 40).
 * TDD: logica pura testada em tests/expenses.smoke.ts; UI valida em device.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Card } from '@/components/ui';
import {
  createExpense,
  deleteExpense,
  deriveExpenseStatus,
  expenseTypeLabel,
  formatBRL,
  friendlyExpenseError,
  getDefaultGoalkeeperExpense,
  listExpenses,
  toggleExpenseConfirmed,
  type ExpenseWithMatch,
} from '@/lib/expenses';
import type { ExpenseType } from '@/types/database.types';
import { useExpenseStore } from '@/stores/expense';
import { formatBRTShort } from '@/lib/timezone';

function alertInfo(title: string, msg: string) {
  Alert.alert(title, msg, [{ text: 'OK', style: 'cancel' }]);
}

const TYPE_OPTIONS: { key: ExpenseType; label: string }[] = [
  { key: 'goalkeeper', label: 'Goleiros' },
  { key: 'field', label: 'Campo' },
  { key: 'other', label: 'Outros' },
];

export default function AdminExpensesScreen() {
  const router = useRouter();
  const [list, setList] = useState<ExpenseWithMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState<ExpenseType>('goalkeeper');
  const [amountText, setAmountText] = useState<string>('40');
  const [description, setDescription] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // Default dinamico de GROUPS.goalkeeper_expense (R$ 40 da seed).
  const [defaultGoalkeeper, setDefaultGoalkeeper] = useState<number>(40);

  // Subscreve store para refletir mutacoes instantaneas (Realtime -> store -> UI).
  const upsertStore = useExpenseStore((s) => s.upsertExpense);
  const addStore = useExpenseStore((s) => s.addExpense);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listExpenses();
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega default de goleiros (R$ 40 seed) p/ pre-preencher form.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const value = await getDefaultGoalkeeperExpense();
        if (mounted) {
          setDefaultGoalkeeper(value);
          setAmountText(String(value));
        }
      } catch {
        /* mantem default 40 */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      /* swallowed */
    });
  }, [refresh]);

  // Resumo
  const totals = useMemo(() => {
    let confirmed = 0;
    let pending = 0;
    for (const e of list) {
      const amt = Number(e.amount ?? 0);
      if (deriveExpenseStatus(e) === 'confirmed') confirmed += amt;
      else pending += amt;
    }
    return { confirmed, pending };
  }, [list]);

  // Quando troca tipo -> goalkeeper, pre-preenche valor default do grupo.
  const onChangeType = (next: ExpenseType) => {
    setType(next);
    if (next === 'goalkeeper') {
      setAmountText(String(defaultGoalkeeper));
    }
  };

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const amount = Number(amountText.replace(',', '.'));
      if (!Number.isFinite(amount) || amount < 0) {
        setError('Valor invalido. Use formato 40 ou 40.50.');
        return;
      }
      const created = await createExpense({
        type,
        amount,
        description: description.trim() || undefined,
      });
      addStore(created);
      await refresh();
      setDescription('');
      alertInfo('Despesa criada', `${expenseTypeLabel(type)}: ${formatBRL(amount)}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [amountText, description, type, addStore, refresh]);

  const handleToggle = useCallback(
    (item: ExpenseWithMatch) => {
      setBusyId(item.id);
      (async () => {
        setError(null);
        try {
          const updated = await toggleExpenseConfirmed(item.id, item.confirmed_at);
          upsertStore(item.id, { confirmed_at: updated.confirmed_at });
          await refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusyId(null);
        }
      })();
    },
    [upsertStore, refresh],
  );

  const handleDelete = useCallback(
    (item: ExpenseWithMatch) => {
      Alert.alert(
        'Remover despesa',
        `Excluir ${expenseTypeLabel(item.type)} de ${formatBRL(Number(item.amount))}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Remover',
            style: 'destructive',
            onPress: async () => {
              setBusyId(item.id);
              setError(null);
              try {
                await deleteExpense(item.id);
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

  const renderItem = ({ item }: { item: ExpenseWithMatch }) => {
    const status = deriveExpenseStatus(item);
    const isBusy = busyId === item.id;
    const matchLabel = item.match?.date_time
      ? `Partida ${formatBRTShort(item.match.date_time)}`
      : 'Sem partida vinculada';
    return (
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-semibold text-pitch-900">
                {expenseTypeLabel(item.type)}
              </Text>
              <Text className="text-[10px] uppercase text-pitch-500">{matchLabel}</Text>
            </View>
            {item.description ? (
              <Text className="mt-0.5 text-sm text-pitch-600">{item.description}</Text>
            ) : null}
            <Text className="mt-1 text-xs text-pitch-500">
              Criada em {formatBRTShort(item.created_at)}
              {item.confirmed_at
                ? ` - Confirmada em ${formatBRTShort(item.confirmed_at)}`
                : ' - Pendente'}
            </Text>
          </View>
          <Text className="text-base font-bold text-pitch-900">
            {formatBRL(Number(item.amount))}
          </Text>
        </View>

        <View className="mt-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Switch
              value={status === 'confirmed'}
              onValueChange={() => handleToggle(item)}
              disabled={isBusy}
              accessibilityLabel={`Confirmar ${expenseTypeLabel(item.type)}`}
              trackColor={{ false: '#cbd5e1', true: '#22c55e' }}
              thumbColor="#ffffff"
            />
            <Text className="text-sm font-semibold text-pitch-700">
              {status === 'confirmed' ? 'Confirmada' : 'Confirmar'}
            </Text>
          </View>
          <Pressable onPress={() => handleDelete(item)} disabled={isBusy}>
            <Text className="text-sm text-danger">Remover</Text>
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-pitch-50">
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-pitch-900">Despesas (admin)</Text>
          <Pressable onPress={() => router.replace('/(tabs)/perfil')}>
            <Text className="text-sm text-field-dark">Voltar</Text>
          </Pressable>
        </View>

        <Card>
          <Text className="text-sm font-semibold text-pitch-900">Como funciona</Text>
          <Text className="mt-1 text-xs text-pitch-600">
            Registre saidas do caixa (goleiros, aluguel do campo ou outras). Marque como confirmada
            apos efetuar o pagamento - o saldo do Caixa atualiza em tempo real.
          </Text>
        </Card>

        <Card>
          <Text className="text-sm font-semibold text-pitch-900">Resumo</Text>
          <View className="mt-2 flex-row gap-3">
            <View className="flex-1 gap-1 rounded-lg bg-warning/10 p-2.5">
              <Text className="text-[10px] font-semibold uppercase text-warning">Pendente</Text>
              <Text className="text-sm font-bold text-pitch-900">{formatBRL(totals.pending)}</Text>
            </View>
            <View className="flex-1 gap-1 rounded-lg bg-danger/10 p-2.5">
              <Text className="text-[10px] font-semibold uppercase text-danger">Confirmada</Text>
              <Text className="text-sm font-bold text-pitch-900">
                {formatBRL(totals.confirmed)}
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text className="text-sm font-semibold text-pitch-900">Nova despesa</Text>

          <Text className="mt-2 text-xs text-pitch-600">Tipo</Text>
          <View className="mt-1 flex-row gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => onChangeType(opt.key)}
                  className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 py-2 ${
                    active ? 'bg-field' : 'bg-pitch-200'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={`Tipo ${opt.label}`}
                >
                  <Text
                    className={`text-xs font-semibold ${active ? 'text-white' : 'text-pitch-700'}`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mt-3 text-xs text-pitch-600">
            Valor (em R$){' '}
            {type === 'goalkeeper' ? `- padrao de goleiros ${formatBRL(defaultGoalkeeper)}` : ''}
          </Text>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            placeholder="40"
            accessibilityLabel="Valor da despesa"
            className="mt-1 rounded-lg border border-pitch-300 bg-white px-3 py-2 text-pitch-900"
            returnKeyType="next"
          />

          <Text className="mt-3 text-xs text-pitch-600">Descricao (opcional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Ex: Goleiros partida 24/07"
            accessibilityLabel="Descricao da despesa"
            className="mt-1 rounded-lg border border-pitch-300 bg-white px-3 py-2 text-pitch-900"
            returnKeyType="done"
          />

          <View className="mt-3">
            <Button title="Criar despesa" onPress={handleCreate} loading={creating} />
          </View>
        </Card>

        <View>
          <Text className="mb-2 text-base font-semibold text-pitch-900">Historico</Text>
          {loading ? (
            <ActivityIndicator />
          ) : list.length === 0 ? (
            <Card>
              <Text className="text-pitch-600">Nenhuma despesa registrada ainda.</Text>
            </Card>
          ) : (
            list.map((item) => (
              <View key={item.id} className="mb-2">
                {renderItem({ item })}
              </View>
            ))
          )}
        </View>

        {error ? (
          <Card>
            <Text className="text-sm text-danger">{error}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
