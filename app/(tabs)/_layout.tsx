import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';

import {
  subscribeExpenses,
  subscribeMatchesForReminder,
  subscribePayments,
  subscribePresences,
  disposeChannel,
} from '@/lib/realtime';
import { fireGoalkeeperReminderNow } from '@/lib/expenseReminder';
import { supabase } from '@/lib/supabase';
import { FIXED_GROUP_ID, FIXED_MATCH_ID } from '@/lib/matches';

/**
 * Layout das abas (Tab Bar) - 4 abas PT-BR.
 * Tasks: T1.5 (scaffold) + T2.1 (Realtime wiring + tipagem).
 *
 * Abas:
 *   - Presenca (RSVP)
 *   - Caixa    (financeiro)
 *   - Sorteio  (times)
 *   - Perfil   (conta)
 *
 * Cores:
 *   - Ativo   : field (verde campo)
 *   - Inativo : pitch-500 (cinza neutro)
 *
 * Icons: @expo/vector-icons (Ionicons): people, wallet, shuffle, person.
 *
 * T2.1: ao montar, abre Realtime subscriptions para MATCH_PRESENCES e
 * PAYMENTS. IDs placeholders (MVP = 1 grupo fixo); T2.3 + T2.0 vao
 * trocar pelo match/grupo ativos lidos das stores. Nao bloqueia o
 * carregamento das abas se o servidor Realtime estiver indisponivel
 * (cleanup e defensivo).
 */

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: TabIconName;
}

interface TabBarIconProps {
  color: string;
  size: number;
}

const TABS: readonly TabConfig[] = [
  { name: 'index', title: 'Presença', icon: 'people' },
  { name: 'caixa', title: 'Caixa', icon: 'wallet' },
  { name: 'sorteio', title: 'Sorteio', icon: 'shuffle' },
  { name: 'perfil', title: 'Perfil', icon: 'person' },
] as const;

// Placeholders do MVP (1 grupo fixo). T2.0 + T2.3 substituirao por IDs das
// stores quando o match corrente estiver disponivel via T2.0 + hook.
export default function TabsLayout() {
  useEffect(() => {
    let presenceChannel: RealtimeChannel | undefined;
    let paymentChannel: RealtimeChannel | undefined;
    let expenseChannel: RealtimeChannel | undefined;
    let matchReminderChannel: RealtimeChannel | undefined;

    // Resolve is_admin (async); TEMP busca apenas o role corrente p/ gate do reminder.
    // (perfil.tsx e admin/payments.tsx mantem logica equivalente; aqui so serve
    // p/ nao-agendar notificacao em device de nao-admin.)
    let isAdmin = false;
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        const flag = Array.isArray(data)
          ? false
          : Boolean((data as { is_admin?: boolean } | null)?.is_admin);
        isAdmin = flag;
      } catch {
        isAdmin = false;
      }
    })();

    try {
      presenceChannel = subscribePresences(FIXED_MATCH_ID);
      paymentChannel = subscribePayments(FIXED_GROUP_ID);
      // T4.3: Expenses Realtime para atualizar SALDO do Caixa instantaneamente.
      expenseChannel = subscribeExpenses(FIXED_GROUP_ID);
      // T4.3: Reminder LOCAL pos-jogo no device admin (admin detecta status->finished).
      matchReminderChannel = subscribeMatchesForReminder(FIXED_GROUP_ID, {
        onFireReminder: (amount, matchIso) => {
          // isAdmin e resolvido lazy no closure; se ainda nao confirmado true,
          // fireGoalkeeperReminderNow faz o gate defensivo via chamada direta.
          if (isAdmin) void fireGoalkeeperReminderNow(amount, matchIso);
        },
      });
    } catch (err) {
      // Realtime nao deve impedir a navegacao entre abas.
      console.warn('[realtime] Falha ao abrir subscriptions:', err);
    }

    return () => {
      void disposeChannel(presenceChannel);
      void disposeChannel(paymentChannel);
      void disposeChannel(expenseChannel);
      void disposeChannel(matchReminderChannel);
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#16a34a', // field
        tabBarInactiveTintColor: '#64748b', // pitch-500
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0', // pitch-200
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      {TABS.map((tabCfg) => (
        <Tabs.Screen
          key={tabCfg.name}
          name={tabCfg.name}
          options={{
            title: tabCfg.title,
            tabBarIcon: ({ color, size }: TabBarIconProps) => (
              <Ionicons name={tabCfg.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
