import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { ProfileRow, UserType } from '@/types/database.types';

const USER_TYPES: readonly { value: UserType; label: string }[] = [
  { value: 'mensalista', label: 'Mensalista' },
  { value: 'avulso', label: 'Avulso' },
  { value: 'goleiro_pago', label: 'Goleiro pago' },
];

type ManagedProfile = Pick<
  ProfileRow,
  'id' | 'username' | 'user_type' | 'is_admin' | 'phone_whatsapp' | 'created_at'
>;

type FunctionResponse = {
  error?: string;
  profile?: ManagedProfile;
};

function getFunctionError(error: { message?: string } | null, data: FunctionResponse | null) {
  return data?.error ?? error?.message ?? 'Operacao nao concluida.';
}

export default function AdminUsersScreen() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState<UserType>('mensalista');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('id, username, user_type, is_admin, phone_whatsapp, created_at')
      .order('username', { ascending: true });
    if (queryError) setError(queryError.message);
    else setProfiles((data ?? []) as ManagedProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((queryError) => {
      setError(queryError instanceof Error ? queryError.message : String(queryError));
      setLoading(false);
    });
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    if (!username.trim()) {
      setError('Informe o username.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke<FunctionResponse>(
        'provision-user',
        {
          body: {
            action: 'create',
            username,
            phone_whatsapp: phone.trim() || null,
            user_type: userType,
          },
        },
      );
      if (functionError || data?.error) {
        setError(getFunctionError(functionError, data));
        return;
      }
      setUsername('');
      setPhone('');
      setUserType('mensalista');
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setCreating(false);
    }
  }, [phone, refresh, userType, username]);

  const handleReset = useCallback((profile: ManagedProfile) => {
    Alert.alert('Resetar senha', `A senha de ${profile.username} voltara para a senha padrao?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resetar',
        onPress: async () => {
          setBusyId(profile.id);
          setError(null);
          try {
            const { data, error: functionError } =
              await supabase.functions.invoke<FunctionResponse>('provision-user', {
                body: { action: 'reset_password', user_id: profile.id },
              });
            if (functionError || data?.error) setError(getFunctionError(functionError, data));
          } catch (resetError) {
            setError(resetError instanceof Error ? resetError.message : String(resetError));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-pitch-50">
      <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-pitch-900">Jogadores (admin)</Text>
          <Pressable onPress={() => router.replace('/(tabs)/perfil')}>
            <Text className="text-sm text-field-dark">Voltar</Text>
          </Pressable>
        </View>

        <Card>
          <Text className="text-base font-semibold text-pitch-900">Adicionar jogador</Text>
          <Text className="mt-1 text-xs text-pitch-600">
            O jogador sera criado com a senha padrao. Ele podera trocar a senha depois.
          </Text>

          <Text className="mt-3 text-xs font-semibold text-pitch-700">Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Ex: joao.silva"
            placeholderTextColor="#94a3b8"
            className="mt-1 rounded-xl border border-pitch-300 bg-white px-3 py-2 text-pitch-900"
          />

          <Text className="mt-3 text-xs font-semibold text-pitch-700">WhatsApp (opcional)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="(11) 99999-9999"
            placeholderTextColor="#94a3b8"
            className="mt-1 rounded-xl border border-pitch-300 bg-white px-3 py-2 text-pitch-900"
          />

          <Text className="mt-3 text-xs font-semibold text-pitch-700">Tipo</Text>
          <View className="mt-1 flex-row flex-wrap gap-2">
            {USER_TYPES.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setUserType(option.value)}
                className={`rounded-lg border px-3 py-2 ${
                  userType === option.value
                    ? 'border-field bg-field/10'
                    : 'border-pitch-200 bg-white'
                }`}
              >
                <Text className="text-xs font-semibold text-pitch-900">{option.label}</Text>
              </Pressable>
            ))}
          </View>

          <View className="mt-4">
            <Button title="Adicionar jogador" onPress={handleCreate} loading={creating} />
          </View>
          {error ? <Text className="mt-2 text-sm text-danger">{error}</Text> : null}
        </Card>

        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-pitch-900">
            Jogadores cadastrados ({profiles.length})
          </Text>
          <Pressable onPress={() => void refresh()}>
            <Text className="text-sm text-field-dark">Atualizar</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : profiles.length === 0 ? (
          <Card>
            <Text className="text-sm text-pitch-600">Nenhum jogador cadastrado.</Text>
          </Card>
        ) : (
          profiles.map((profile) => {
            const isBusy = busyId === profile.id;
            return (
              <Card key={profile.id}>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-pitch-900">
                      {profile.username}
                    </Text>
                    <Text className="mt-1 text-xs uppercase text-pitch-600">
                      {profile.user_type}
                      {profile.is_admin ? ' - admin' : ''}
                    </Text>
                    {profile.phone_whatsapp ? (
                      <Text className="mt-1 text-xs text-pitch-500">{profile.phone_whatsapp}</Text>
                    ) : null}
                  </View>
                  {!profile.is_admin ? (
                    <Button
                      title="Resetar senha"
                      variant="secondary"
                      onPress={() => handleReset(profile)}
                      loading={isBusy}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
