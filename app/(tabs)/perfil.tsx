/**
 * app/(tabs)/perfil.tsx
 * Task: T2.0 - adiciona entrada de admin para gerenciar matches.
 *
 * Mantém o placeholder anterior; adiciona botão visível apenas para
 * usuários com profiles.is_admin=true. RLS já protege (tela bateria de
 * testes), o link é conveniência de UX.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';

export default function PerfilScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        if (error) return;
        const isAdminFlag = Array.isArray(data)
          ? false
          : Boolean((data as { is_admin?: boolean } | null)?.is_admin);
        if (mounted) setIsAdmin(isAdminFlag);
      } catch {
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View className="flex-1 bg-pitch-50">
      <View className="gap-2 p-4">
        <Text className="text-lg font-semibold text-pitch-900">Perfil</Text>
        <Text className="text-sm text-pitch-600">Em breve.</Text>

        {loading ? (
          <ActivityIndicator />
        ) : (
          isAdmin && (
            <View className="mt-4 gap-2">
              <Pressable
                onPress={() => router.push('/(tabs)/admin/matches')}
                className="rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">
                  Gerenciar partidas (admin)
                </Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Criar / editar / cancelar partidas
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/pending')}
                className="rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">
                  Gerenciar pendentes (admin)
                </Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Promover / rejeitar avulsos (FIFO)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/payments')}
                className="rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">Pagamentos (admin)</Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Aprovar pagamentos marcados (dupla confirmação)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/expenses')}
                className="rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">Despesas (admin)</Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Goleiros / campo / outras - confirmar saídas do caixa
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/goleiros')}
                className="rounded-xl border border-pitch-200 bg-white p-3"
              >
                <Text className="text-sm font-semibold text-field-dark">
                  Goleiros pagos (admin)
                </Text>
                <Text className="mt-0.5 text-xs text-pitch-600">
                  Cadastrar goleiros sem login OAuth (sorteio fixo T6.1)
                </Text>
              </Pressable>
            </View>
          )
        )}
      </View>
    </View>
  );
}
