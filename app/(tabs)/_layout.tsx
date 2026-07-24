import { Tabs } from 'expo-router';

/**
 * Layout das abas. No MVP teremos: Inicio / Caixa / Sorteio / Perfil.
 * Por enquanto so a aba inicial para scaffold (YAGNI - T2.x adiciona as demais).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
        }}
      />
    </Tabs>
  );
}
