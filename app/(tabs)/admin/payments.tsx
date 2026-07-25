/**
 * app/(tabs)/admin/payments.tsx
 * Task: T4.2 - UI admin para aprovar pagamentos marcados (2a confirmacao).
 *
 * Funcionalidades (PT-BR):
 *   - Listar PAYMENTS marcados (marked_paid_at != null && approved_at == null).
 *   - Botao "Aprovar" -> approvePayment() (seta approved_at + paid_at + status=paid).
 *   - Atualizacao automatica via Realtime (lib/realtime.ts ja assina PAYMENTS por group).
 *
 * Acesso: requer RLS is_admin() (policy payments_update T1.7).
 * Rota nao e aba: exposta via Perfil -> "Pagamentos (admin)".
 *
 * TDD: logica pura testada em tests/payments.smoke.ts.
 *      Validacao end-to-end com 2 contas fica como handoff.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Card } from '@/components/ui';
import {
  approvePayment,
  friendlyPaymentError,
  listPaymentsWithProfiles,
  type PaymentWithProfile,
} from '@/lib/payments';
import { usePaymentStore } from '@/stores/payment';

/**
 * Filtro: somente marcados aguardando aprovacao.
 * Status DERIVADO (schema enum so tem pending|paid) => marked = (marked_paid_at != null && approved_at == null).
 */
function isMarkedAwaitingApproval(p: PaymentWithProfile): boolean {
  return p.marked_paid_at != null && p.approved_at == null;
}

function alertInfo(title: string, msg: string) {
  Alert.alert(title, msg, [{ text: 'OK', style: 'cancel' }]);
}

export default function AdminPaymentsScreen() {
  const router = useRouter();
  const [marked, setMarked] = useState<PaymentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Subscreve store para refletir aprovacoes instantaneas (Realtime -> store -> UI).
  const payments = usePaymentStore((s) => s.payments);
  const approveStore = usePaymentStore((s) => s.approve);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPaymentsWithProfiles();
      setMarked(list.filter(isMarkedAwaitingApproval));
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

  // Espelha mudancas vindas da store (Realtime PAYMENTS UPDATE) no estado local.
  // Evita refresh manual apos aprovacao vinda de outro admin/device.
  useEffect(() => {
    setMarked((prev) => prev.filter((p) => isMarkedAwaitingApproval(p)));
  }, [payments]);

  const handleApprove = useCallback(
    (item: PaymentWithProfile) => {
      Alert.alert(
        'Aprovar pagamento',
        `Confirmar pagamento de ${item.profile?.full_name ?? 'jogador'} (${formatBRL(item.amount)})?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Aprovar',
            onPress: async () => {
              setBusyId(item.id);
              setError(null);
              try {
                const updated = await approvePayment(item.id);
                approveStore(item.id, updated.approved_at ?? new Date().toISOString());
                await refresh();
                alertInfo('Aprovado', 'Pagamento marcado como pago.');
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
    [approveStore, refresh],
  );

  const renderItem = ({ item }: { item: PaymentWithProfile }) => {
    const name = item.profile?.full_name ?? 'Jogador';
    const typeLabel =
      item.type === 'monthly' ? 'Mensalidade' : item.type === 'casual' ? 'Avulsa' : item.type;
    const isBusy = busyId === item.id;
    return (
      <Card>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-pitch-900 text-base font-semibold">{name}</Text>
            <Text className="text-pitch-600 mt-0.5 text-xs uppercase">{typeLabel}</Text>
            <Text className="text-warning mt-1 text-xs">
              Marcado em {formatBRTshort(item.marked_paid_at)}
            </Text>
          </View>
          <Text className="text-pitch-900 text-base font-bold">{formatBRL(item.amount)}</Text>
        </View>
        <View className="mt-2">
          <Button
            title="Aprovar"
            onPress={() => handleApprove(item)}
            loading={isBusy}
            variant="primary"
          />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView className="bg-pitch-50 flex-1">
      <View className="flex-1 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-pitch-900 text-xl font-bold">Pagamentos (admin)</Text>
          <Pressable onPress={() => router.replace('/(tabs)/perfil')}>
            <Text className="text-field-dark text-sm">Voltar</Text>
          </Pressable>
        </View>

        <Card>
          <Text className="text-pitch-900 text-sm font-semibold">Como funciona</Text>
          <Text className="text-pitch-600 mt-1 text-xs">
            Jogadores marcam como pago (1a confirmacao). Os marcados aparecem aqui para o admin
            aprovar (2a confirmacao), setando status final = pago. Realtime atualiza a lista
            instantaneamente.
          </Text>
        </Card>

        <View className="mt-2 flex-1">
          <Text className="text-pitch-900 mb-2 text-base font-semibold">Aguardando aprovacao</Text>
          {loading ? (
            <ActivityIndicator />
          ) : marked.length === 0 ? (
            <Card>
              <Text className="text-pitch-600">Nenhum pagamento aguardando aprovacao.</Text>
            </Card>
          ) : (
            <FlatList
              data={marked}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerClassName="gap-2"
            />
          )}
        </View>

        {error ? (
          <Card>
            <Text className="text-danger text-sm">{error}</Text>
          </Card>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ---- Helpers PT-BR (locais) ------------------------------------------------

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatBRL(amount: number): string {
  return brl.format(amount);
}

/** Formata ISO UTC -> "dd/MM/yyyy HH:mm" BRT (fallback p/ ambientes sem Intl completo). */
function formatBRTshort(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 16);
  }
}
