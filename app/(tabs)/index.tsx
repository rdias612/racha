import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Tela inicial (placeholder) do FutAmigos.
 * Sera substituida pela Home com proxima pelada em T2.x.
 */
export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white">
      <View>
        <Text className="text-2xl font-bold text-neutral-900">
          Bem-vindo ao FutAmigos
        </Text>
        <Text className="mt-2 text-base text-neutral-500">
          Scaffold T1.1 - setup inicial pronto.
        </Text>
      </View>
    </SafeAreaView>
  );
}
