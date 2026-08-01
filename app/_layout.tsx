import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { isOnboarded } from '@/lib/secure-store';
import '../global.css';

/**
 * Root layout do app FutAmigos (T1.4: gating de autenticacao; T7.2: onboarding).
 * - Boot: useAuth() le SecureStore('supabase-session').
 * - Sem session -> /login. Com session -> /(tabs) ou /onboarding.
 * - Onboarding (T7.2): session valida mas isOnboarded() === false -> /onboarding.
 *   Flag persistida em SecureStore (resetavel apenas por uninstall).
 * - onAuthStateChange (interno ao useAuth) cobre refresh e signOut.
 */
export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  // Le flag onboarding quando session muda (T7.2).
  useEffect(() => {
    if (!session) {
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
  }, [session]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      // Login concluido: checa onboarding antes das tabs.
      if (onboarded === false) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } else if (session && !inOnboarding && onboarded === false) {
      // Session valida mas onboarding pendente (qualquer rota exceto /onboarding).
      router.replace('/onboarding');
    } else if (session && inOnboarding && onboarded === true) {
      // Ja onboardou mas caiu em /onboarding -> manda para tabs.
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router, onboarded]);

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
