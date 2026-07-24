import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/**
 * Layout das abas (Tab Bar) - 4 placeholder PT-BR.
 * Task: T1.5.
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
 * Icons: @expo/vector-icons (Ionicons):
 *   people, wallet, shuffle, person.
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
  { name: 'index', title: 'Presenca', icon: 'people' },
  { name: 'caixa', title: 'Caixa', icon: 'wallet' },
  { name: 'sorteio', title: 'Sorteio', icon: 'shuffle' },
  { name: 'perfil', title: 'Perfil', icon: 'person' },
] as const;

export default function TabsLayout() {
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
