/**
 * app/login.tsx
 * Task: T1.4 - Tela de login PT-BR.
 *
 * - Logo placeholder + slogan PT-BR.
 * - Botao "Entrar com Google" (components/ui/Button).
 * - Apos login bem-sucedido: router.replace('/(tabs)').
 * - Apple Sign-In propositalmente ausente (decisao MVP).
 */

import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithGoogle();
      // useAuth atualiza a session; o RootLayout (useSegments) redireciona sozinho.
    } catch (err) {
      Alert.alert(
        'Falha no login',
        err instanceof Error ? err.message : 'Tente novamente em instantes.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="bg-pitch-50 flex-1 items-center justify-center px-6">
      <View className="items-center gap-3">
        <View
          className="bg-field h-24 w-24 items-center justify-center rounded-3xl"
          accessibilityLabel="Logo FutAmigos"
        >
          <Text className="text-4xl font-bold text-white">FA</Text>
        </View>
        <Text className="text-pitch-900 text-3xl font-bold">FutAmigos</Text>
        <Text className="text-pitch-700 text-center text-base">
          Seu racha organizado: escalacao, presenca e aviso de jogao direto no bolso.
        </Text>
      </View>

      <View className="mt-10 w-full">
        <Button
          title="Entrar com Google"
          onPress={handleSignIn}
          loading={loading}
          variant="primary"
        />
        <Text className="text-pitch-500 mt-4 text-center text-xs">
          Ao continuar voce concorda em receber notificacoes dos jogos.
        </Text>
      </View>
    </SafeAreaView>
  );
}
