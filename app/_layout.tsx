import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { isOnboarded } from '@/lib/secure-store';
import '../global.css';

/**
 * Root layout do app FutAmigos (gating de autenticacao; T7.2: onboarding).
 * - Boot: useAuth() le o profile ativo no SecureStore('active-profile').
 * - Sem profile -> /login. Com profile -> /(tabs) ou /onboarding.
 * - Onboarding (T7.2): profile valido mas isOnboarded() === false -> /onboarding.
 *   Flag persistida em SecureStore (resetavel apenas por uninstall).
 */
export default function RootLayout() {
  const { profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  // Le flag onboarding quando o profile muda (T7.2).
  useEffect(() => {
    if (!profile) {
      setOnboarded(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const flag = await isOnboarded();
        if (mounted) setOnboarded(flag);
      } catch {
        if (mounted) setOnboarded(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [profile]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login';
    const inOnboarding = segments[0] === 'onboarding';

    if (!profile && !inAuthGroup) {
      router.replace('/login');
    } else if (profile && inAuthGroup) {
      // Login concluido: checa onboarding antes das tabs.
      if (onboarded === false) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } else if (profile && !inOnboarding && onboarded === false) {
      // Profile valido mas onboarding pendente (qualquer rota exceto /onboarding).
      router.replace('/onboarding');
    } else if (profile && inOnboarding && onboarded === true) {
      // Ja onboardou mas caiu em /onboarding -> manda para tabs.
      router.replace('/(tabs)');
    }
  }, [profile, loading, segments, router, onboarded]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-pitch-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="sumula/[match_id]"
          options={{
            title: 'Sumula',
            headerShown: true,
          }}
        />
      </Stack>
    </>
  );
}
