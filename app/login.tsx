/**
 * app/login.tsx
 * Task: T1.4 - Tela de login PT-BR.
 *
 * - Logo placeholder + slogan PT-BR.
 * - Login local por username e senha.
 */

import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (loading) return;
    if (!username.trim() || !password) {
      Alert.alert('Dados incompletos', 'Informe seu username e sua senha.');
      return;
    }
    setLoading(true);
    try {
      await signIn(username, password);
      // useAuth atualiza o profile; o RootLayout (useSegments) redireciona sozinho.
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String(err.message)
            : 'Tente novamente em instantes.';
      Alert.alert('Falha no login', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-pitch-50 px-6">
      <View className="items-center gap-3">
        <View
          className="h-24 w-24 items-center justify-center rounded-3xl bg-field"
          accessibilityLabel="Logo FutAmigos"
        >
          <Text className="text-4xl font-bold text-white">FA</Text>
        </View>
        <Text className="text-3xl font-bold text-pitch-900">FutAmigos</Text>
        <Text className="text-center text-base text-pitch-700">
          Seu racha organizado: escalacao, presenca e aviso de jogao direto no bolso.
        </Text>
      </View>

      <View className="mt-10 w-full">
        <Text className="mb-1 text-sm font-semibold text-pitch-900">Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Seu username"
          placeholderTextColor="#64748b"
          className="mb-4 min-h-[48px] rounded-xl border border-pitch-200 bg-white px-4 text-base text-pitch-900"
        />
        <Text className="mb-1 text-sm font-semibold text-pitch-900">Senha</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="Sua senha"
          placeholderTextColor="#64748b"
          className="mb-6 min-h-[48px] rounded-xl border border-pitch-200 bg-white px-4 text-base text-pitch-900"
        />
        <Button title="Entrar" onPress={handleSignIn} loading={loading} variant="primary" />
        <Text className="mt-4 text-center text-xs text-pitch-500">
          Ao continuar voce concorda em receber notificacoes dos jogos.
        </Text>
      </View>
    </SafeAreaView>
  );
}
