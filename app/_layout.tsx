import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import './global.css';

/**
 * Root layout do app FutAmigos.
 * Define o <Stack> principal do Expo Router.
 * NativeWind: o `global.css` e importado aqui para o build time.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
