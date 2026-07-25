import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { subscribePayments, subscribePresences, disposeChannel } from '@/lib/realtime';

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
const PLACEHOLDER_GROUP_ID = '00000000-0000-0000-0000-000000000001';
const PLACEHOLDER_MATCH_ID = '00000000-0000-0000-0000-000000000002';

export default function TabsLayout() {
  useEffect(() => {
    let presenceChannel: RealtimeChannel | undefined;
    let paymentChannel: RealtimeChannel | undefined;

    try {
      presenceChannel = subscribePresences(PLACEHOLDER_MATCH_ID);
      paymentChannel = subscribePayments(PLACEHOLDER_GROUP_ID);
    } catch (err) {
      // Realtime nao deve impedir a navegacao entre abas.
      console.warn('[realtime] Falha ao abrir subscriptions:', err);
    }

    return () => {
      void disposeChannel(presenceChannel);
      void disposeChannel(paymentChannel);
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
