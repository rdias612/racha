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
    <View className="bg-pitch-50 flex-1">
      <View className="gap-2 p-4">
        <Text className="text-pitch-900 text-lg font-semibold">Perfil</Text>
        <Text className="text-pitch-600 text-sm">Em breve.</Text>

        {loading ? (
          <ActivityIndicator />
        ) : (
          isAdmin && (
            <View className="mt-4 gap-2">
              <Pressable
                onPress={() => router.push('/(tabs)/admin/matches')}
                className="border-pitch-200 rounded-xl border bg-white p-3"
              >
                <Text className="text-field-dark text-sm font-semibold">
                  Gerenciar partidas (admin)
                </Text>
                <Text className="text-pitch-600 mt-0.5 text-xs">
                  Criar / editar / cancelar partidas
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/pending')}
                className="border-pitch-200 rounded-xl border bg-white p-3"
              >
                <Text className="text-field-dark text-sm font-semibold">
                  Gerenciar pendentes (admin)
                </Text>
                <Text className="text-pitch-600 mt-0.5 text-xs">
                  Promover / rejeitar avulsos (FIFO)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/admin/payments')}
                className="border-pitch-200 rounded-xl border bg-white p-3"
              >
                <Text className="text-field-dark text-sm font-semibold">
                  Pagamentos (admin)
                </Text>
                <Text className="text-pitch-600 mt-0.5 text-xs">
                  Aprovar pagamentos marcados (dupla confirmação)
                </Text>
              </Pressable>
            </View>
          )
        )}
      </View>
    </View>
  );
}
