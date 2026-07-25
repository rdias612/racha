/**
 * app/onboarding.tsx
 * Task: T7.2 - Tela de onboarding PT-BR minimal (primeiro login).
 *
 * Funcionalidades:
 *   - Card de boas-vindas + secao "Como funciona" com bullets PT-BR.
 *   - Botao "Entendi, vamos jogar!" -> markOnboarded() + redirect /(tabs).
 *
 * Persistencia:
 *   - Flag persistida em SecureStore (lib/secure-store.ts): ONBOARD_KEY.
 *   - Resetavel apenas por uninstall do app (YAGNI: sem flag DB).
 *
 * Gating (app/_layout.tsx):
 *   - Sem onboarding && ja autenticado -> redireciona para /onboarding.
 *   - Com onboarding -> direto para /(tabs).
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Card } from '@/components/ui';
import { markOnboarded } from '@/lib/secure-store';

const BULLETS: ReadonlyArray<{ icon: string; text: string }> = [
  {
    icon: '⚽',
    text: 'Sorteio de times toda semana.',
  },
  {
    icon: '✅',
    text: 'Confirme sua presenca ate terca 19h.',
  },
  {
    icon: '🎟️',
    text: 'Mensalistas tem prioridade; avulsos entram na fila FIFO.',
  },
  {
    icon: '🧤',
    text: 'Goleiros pagos garantem a meta semanal.',
  },
  {
    icon: '💬',
    text: 'Pagamentos via PIX; avisos pelo WhatsApp.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleFinish = async () => {
    setBusy(true);
    try {
      await markOnboarded();
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-pitch-50">
      <ScrollView contentContainerClassName="gap-6 p-4">
        <Card>
          <Text className="text-center text-2xl font-bold text-pitch-900">
            Bem-vindo ao FutAmigos!
          </Text>
          <Text className="mt-2 text-center text-sm text-pitch-600">
            Seu racha organizado. Sorteio automatico de times, lista de presenca, goleiros pagos e
            caixa transparente - tudo num so app.
          </Text>
        </Card>

        <View className="gap-2">
          <Text className="text-base font-semibold text-pitch-900">Como funciona:</Text>
          {BULLETS.map((b, idx) => (
            <Card key={idx}>
              <View className="flex-row items-start gap-2">
                <Text className="text-base">{b.icon}</Text>
                <Text className="flex-1 text-sm text-pitch-700">{b.text}</Text>
              </View>
            </Card>
          ))}
        </View>

        <Button
          title="Entendi, vamos jogar!"
          onPress={handleFinish}
          loading={busy}
          disabled={busy}
        />

        {busy ? (
          <View className="flex-row items-center justify-center gap-2">
            <ActivityIndicator size="small" />
            <Text className="text-xs text-pitch-600">Carregando...</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
