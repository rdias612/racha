/**
 * app/(tabs)/caixa.tsx
 * Task: T4.1 (UI estatica) + T4.2 (bind real UI <-> store <-> supabase).
 *
 * Layout:
 *   1. Cabecalho "Caixa" + resumo do mes corrente (Pago / Marcado / Pendente).
 *   2. Filtros: Todos / Pendentes / Marcados / Pagos (4 toggles).
 *   3. Lista agrupada por mes (chave: YYYY-MM): header com mes PT-BR + total
 *      pago no mes, seguido de PaymentRows.
 *
 * Transparencia (PRD regra 6): todos do grupo veem a mesma lista.
 *
 * Bind T4.2:
 *   - Fonte primaria: usePaymentStore (hidratada no mount; Realtime ja assina
 *     PAYMENTS em _layout.tsx).
 *   - Fallback (store vazio em dev sem backend): MOCK_PAYMENTS T4.1.
 *   - Handler onMark: pendente do PROPRIO usuario -> markAsPaid().
 *     UI gate canUserMark; DB RLS T1.7 e fonte de verdade.
 *   - Handler onApprove: marcado + admin -> approvePayment().
 *     UI gate canUserApprove (is_admin).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaymentRow, type PaymentRowStatus, type PaymentRowType } from '@/components/PaymentRow';
import {
  approvePayment,
  canUserApprove,
  canUserMark,
  deriveStatus,
  friendlyPaymentError,
  listPaymentsWithProfiles,
  markAsPaid,
} from '@/lib/payments';
import { usePaymentStore } from '@/stores/payment';
import { useAuth } from '@/hooks/useAuth';
import type { PaymentRow as PaymentRowDb, ProfileRow } from '@/types/database.types';

// ---- Tipos internos -------------------------------------------------------

interface CaixaPayment {
  id: string;
  user_id: string | null;
  fullName: string;
  type: PaymentRowType;
  amount: number;
  status: PaymentRowStatus;
  /** Chave de agrupamento por mes (AAAA-MM). */
  monthKey: string;
  /** Linha enriquecida do DB para nome (denormalizado). */
  raw?: PaymentRowDb & { profile?: Pick<ProfileRow, 'full_name'> | null };
}

interface MockPayment {
  id: string;
  fullName: string;
  type: PaymentRowType;
  amount: number;
  status: PaymentRowStatus;
  monthKey: string;
}

// ---- Constantes PT-BR -----------------------------------------------------

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type FilterKey = 'all' | 'pending' | 'marked' | 'paid';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'marked', label: 'Marcados' },
  { key: 'paid', label: 'Pagos' },
];

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** Chave AAAA-MM atual (BRT) para o resumo destacado no topo. */
function currentMonthKey(): string {
  return new Date()
    .toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' })
    .slice(0, 7);
}

/** Label PT-BR curto a partir de AAAA-MM: "Julho/2026". */
function monthLabel(monthKey: string): string {
  const yyyy = monthKey.slice(0, 4);
  const mm = Number(monthKey.slice(5, 7));
  const name = MONTH_NAMES[mm - 1] ?? monthKey;
  return `${name}/${yyyy}`;
}

/** Extrai chave AAAA-MM de um ISO UTC (fallback p/ created_at se paid_at null). */
function monthKeyOf(iso: string | null | undefined): string {
  if (!iso) return currentMonthKey();
  return iso.slice(0, 7);
}

/**
 * Mapa PaymentType (ERD: monthly|casual) -> PaymentRowType (UI).
 * 'goalkeeper' e EXPENSE (nao existe em payments.type), mapeado defensivamente.
 */
function mapTypeToUi(dbType: string | null | undefined): PaymentRowType {
  if (dbType === 'casual') return 'casual';
  if (dbType === 'goalkeeper') return 'goalkeeper';
  return 'monthly';
}

// ---- Mock data (snapshot realista do racha campo) -------------------------
//
// Snapshot de cobrancas. Mescla mensalistas, avulsos e goleiro pago.
// Apenas nomes ficticios; nenhum dado privado.
const MOCK_PAYMENTS: MockPayment[] = [
  // --- Julho/2026 (mes corrente) ---
  {
    id: 'p-001',
    fullName: 'Joao Silva',
    type: 'monthly',
    amount: 100,
    status: 'paid',
    monthKey: '2026-07',
  },
  {
    id: 'p-002',
    fullName: 'Maria Coracao',
    type: 'monthly',
    amount: 100,
    status: 'paid',
    monthKey: '2026-07',
  },
  {
    id: 'p-003',
    fullName: 'Pedro Alves',
    type: 'monthly',
    amount: 100,
    status: 'marked',
    monthKey: '2026-07',
  },
  {
    id: 'p-004',
    fullName: 'Carlos Tanaka',
    type: 'monthly',
    amount: 100,
    status: 'pending',
    monthKey: '2026-07',
  },
  {
    id: 'p-005',
    fullName: 'Ana Beatriz',
    type: 'casual',
    amount: 20,
    status: 'paid',
    monthKey: '2026-07',
  },
  {
    id: 'p-006',
    fullName: 'Bruno Avulso',
    type: 'casual',
    amount: 20,
    status: 'marked',
    monthKey: '2026-07',
  },
  {
    id: 'p-007',
    fullName: 'Diego Avulso',
    type: 'casual',
    amount: 20,
    status: 'pending',
    monthKey: '2026-07',
  },
  {
    id: 'p-008',
    fullName: 'Goleiro Lino',
    type: 'goalkeeper',
    amount: 40,
    status: 'paid',
    monthKey: '2026-07',
  },

  // --- Junho/2026 (historico) ---
  {
    id: 'p-009',
    fullName: 'Joao Silva',
    type: 'monthly',
    amount: 100,
    status: 'paid',
    monthKey: '2026-06',
  },
  {
    id: 'p-010',
    fullName: 'Maria Coracao',
    type: 'monthly',
    amount: 100,
    status: 'paid',
    monthKey: '2026-06',
  },
  {
    id: 'p-011',
    fullName: 'Pedro Alves',
    type: 'monthly',
    amount: 100,
    status: 'paid',
    monthKey: '2026-06',
  },
  {
    id: 'p-012',
    fullName: 'Carlos Tanaka',
    type: 'monthly',
    amount: 100,
    status: 'paid',
    monthKey: '2026-06',
  },
  {
    id: 'p-013',
    fullName: 'Ana Beatriz',
    type: 'casual',
    amount: 20,
    status: 'paid',
    monthKey: '2026-06',
  },
];

// ---- Helpers --------------------------------------------------------------

function sumByStatus(rows: CaixaPayment[], status: PaymentRowStatus): number {
  return rows.filter((r) => r.status === status).reduce((acc, r) => acc + r.amount, 0);
}

/** TotalPago do mes para o subcabecalho de grupo ("Pago: R$ X"). */
function sumPaid(rows: CaixaPayment[]): number {
  return rows.filter((r) => r.status === 'paid').reduce((acc, r) => acc + r.amount, 0);
}

// ---- Tela -----------------------------------------------------------------

export default function CaixaScreen() {
  const { user } = useAuth();
  const payments = usePaymentStore((s) => s.payments);
  const setPayments = usePaymentStore((s) => s.setPayments);
  const markPaidStore = usePaymentStore((s) => s.markPaid);
  const approveStoreInner = usePaymentStore((s) => s.approve);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Hidrata store uma vez (Realtime depois mantem sincronizado).
  // Falha silenciosa em dev sem backend -> cai no fallback mock.
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPaymentsWithProfiles();
      setPayments(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [setPayments]);

  useEffect(() => {
    refresh().catch(() => {
      /* swallowed: refresh ja seta error state */
    });
  }, [refresh]);

  // is_admin do profile (gate UI onApprove; DB RLS T1.7 e fonte de verdade).
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error: err } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        if (err) return;
        const flag = Array.isArray(data)
          ? false
          : Boolean((data as Pick<ProfileRow, 'is_admin'> | null)?.is_admin);
        if (mounted) setIsAdmin(flag);
      } catch {
        if (mounted) setIsAdmin(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // Mapeia store -> linhas Caixa. Fallback mock se store vazio.
  const rows: CaixaPayment[] = useMemo(() => {
    if (payments.length === 0) {
      return MOCK_PAYMENTS.map((p) => ({ ...p, user_id: null }));
    }
    return payments.map((p) => {
      const enriched = p as PaymentRowDb & { profile?: Pick<ProfileRow, 'full_name'> | null };
      return {
        id: p.id,
        user_id: p.user_id,
        fullName: enriched.profile?.full_name ?? 'Jogador',
        type: mapTypeToUi(p.type),
        amount: Number(p.amount),
        status: deriveStatus({
          marked_paid_at: p.marked_paid_at,
          approved_at: p.approved_at,
          paid_at: p.paid_at,
        }),
        monthKey: monthKeyOf(p.paid_at ?? p.created_at),
        raw: enriched,
      };
    });
  }, [payments]);

  // Filtragem por status (AC2). `all` mostra todos os meses.
  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((p) => p.status === filter);
  }, [filter, rows]);

  // Agrupamento por mes (AC1). Ordem DESC (mes corrente primeiro).
  const groups = useMemo(() => {
    const map = new Map<string, CaixaPayment[]>();
    for (const p of filtered) {
      const arr = map.get(p.monthKey) ?? [];
      arr.push(p);
      map.set(p.monthKey, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([monthKey, items]) => ({ monthKey, rows: items }));
  }, [filtered]);

  // Resumo do mes corrente (AC1) - independente do filtro.
  const currentKey = currentMonthKey();
  const currentRows = useMemo(
    () => rows.filter((p) => p.monthKey === currentKey),
    [rows, currentKey],
  );
  const totalPaid = sumByStatus(currentRows, 'paid');
  const totalMarked = sumByStatus(currentRows, 'marked');
  const totalPending = sumByStatus(currentRows, 'pending');
  const totalMonth = totalPaid + totalMarked + totalPending;

  // Handlers T4.2.
  const handleMark = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const updated = await markAsPaid(id);
        markPaidStore(id, updated.marked_paid_at ?? new Date().toISOString());
      } catch (e) {
        setError(friendlyPaymentError({ message: e instanceof Error ? e.message : String(e) }));
      } finally {
        setBusyId(null);
      }
    },
    [markPaidStore],
  );

  const handleApprove = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const updated = await approvePayment(id);
        approveStoreInner(id, updated.approved_at ?? new Date().toISOString());
      } catch (e) {
        setError(friendlyPaymentError({ message: e instanceof Error ? e.message : String(e) }));
      } finally {
        setBusyId(null);
      }
    },
    [approveStoreInner],
  );

  return (
    <SafeAreaView edges={['top']} className="bg-pitch-50 flex-1">
      <ScrollView
        contentContainerClassName="gap-6 px-4 pb-8 pt-4"
        accessibilityLabel="Painel financeiro do racha"
      >
        {/* Cabecalho */}
        <View>
          <Text className="text-pitch-900 text-2xl font-bold">Caixa</Text>
          <Text className="text-pitch-600 text-sm">Acompanhe as cobrancas do racha.</Text>
        </View>

        {/* Resumo do mes corrente */}
        <View
          className="border-pitch-200 gap-3 rounded-xl border bg-white p-4"
          style={{ elevation: 2 } as never}
        >
          <View className="flex-row items-baseline justify-between">
            <Text className="text-pitch-600 text-sm font-semibold uppercase tracking-wide">
              {monthLabel(currentKey)}
            </Text>
            <Text className="text-pitch-900 text-sm font-semibold">
              Total {BRL.format(totalMonth)}
            </Text>
          </View>
          <View className="flex-row gap-3">
            <View className="bg-success/10 flex-1 gap-1 rounded-lg p-2.5">
              <Text className="text-success text-[10px] font-semibold uppercase">Pago</Text>
              <Text className="text-pitch-900 text-sm font-bold">{BRL.format(totalPaid)}</Text>
            </View>
            <View className="bg-warning/10 flex-1 gap-1 rounded-lg p-2.5">
              <Text className="text-warning text-[10px] font-semibold uppercase">Marcado</Text>
              <Text className="text-pitch-900 text-sm font-bold">{BRL.format(totalMarked)}</Text>
            </View>
            <View className="bg-pitch-200 flex-1 gap-1 rounded-lg p-2.5">
              <Text className="text-pitch-600 text-[10px] font-semibold uppercase">Pendente</Text>
              <Text className="text-pitch-900 text-sm font-bold">{BRL.format(totalPending)}</Text>
            </View>
          </View>
        </View>

        {loading ? <ActivityIndicator /> : null}
        {error ? <Text className="text-danger px-1 text-xs">{error}</Text> : null}

        {loading ? <ActivityIndicator /> : null}
        {error ? <Text className="text-danger px-1 text-xs">{error}</Text> : null}

        {/* Filtros (AC2) */}
        <View accessibilityRole="tablist" className="flex-row gap-2">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filtrar por ${label}`}
                className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 py-2 ${
                  active ? 'bg-field' : 'bg-pitch-200'
                } active:bg-field-dark`}
              >
                <Text
                  className={`text-xs font-semibold ${active ? 'text-white' : 'text-pitch-700'}`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Lista agrupada por mes (AC1) */}
        {groups.length === 0 ? (
          <Text className="text-pitch-400 py-8 text-center text-sm italic">
            Nenhuma cobranca para esse filtro.
          </Text>
        ) : (
          <View className="gap-6">
            {groups.map(({ monthKey, rows }) => (
              <View key={monthKey} className="gap-2">
                <View
                  accessibilityRole="header"
                  className="flex-row items-baseline justify-between px-1"
                >
                  <Text className="text-pitch-600 text-sm font-semibold uppercase tracking-wide">
                    {monthLabel(monthKey)}
                  </Text>
                  <Text className="text-success text-xs font-medium">
                    Pago {BRL.format(sumPaid(rows))}
                  </Text>
                </View>
                <View className="gap-2">
                  {rows.map((p) => {
                    const showMark =
                      p.status === 'pending' &&
                      canUserMark({ user_id: p.user_id as string }, user?.id);
                    const showApprove = p.status === 'marked' && canUserApprove(isAdmin);
                    const isBusy = busyId === p.id;
                    return (
                      <View key={p.id} className={isBusy ? 'opacity-50' : ''}>
                        <PaymentRow
                          fullName={p.fullName}
                          type={p.type}
                          amount={p.amount}
                          status={p.status}
                          onMark={showMark ? () => handleMark(p.id) : undefined}
                          onApprove={showApprove ? () => handleApprove(p.id) : undefined}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
