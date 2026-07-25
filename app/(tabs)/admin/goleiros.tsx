/**
 * app/(tabs)/admin/goleiros.tsx
 * Task: T7.2 - UI admin para cadastrar goleiros pagos (sem auth).
 *
 * Funcionalidades (PT-BR):
 *   - Form criar goleiro: full_name (obrigatorio), phone_whatsapp (opcional).
 *     Phone sanitizado para E.164 antes do INSERT.
 *   - Lista de goleiros pagos com nome, telefone formatado e created_at BRT.
 *   - Estado vazio amigavel.
 *
 * Acesso: requer RLS is_admin() (policy profiles_insert_policy T1.7).
 * Rota nao e aba: exposta via Perfil -> "Goleiros (admin)".
 *
 * Schema (T7.2): FK profiles.id -> auth.users DROPADA (migration 14);
 * goleiro_pago tem UUID proprio via crypto.randomUUID(), nao faz login.
 *
 * TDD: logica pura testada em tests/goleiros.smoke.ts; UI valida em device.
 */

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
import {
  createGoalkeeper,
  friendlyGoleiroError,
  listGoalkeepers,
  sanitizePhone,
  validateFullName,
  type GoleiroRow,
} from '@/lib/goleiros';

function alertInfo(title: string, msg: string) {
  Alert.alert(title, msg, [{ text: 'OK', style: 'cancel' }]);
}

/** Formata ISO UTC -> "dd/MM/yyyy HH:mm" America/Sao_Paulo. */
function formatBRTshort(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 16);
  }
}

/** Formata E.164 +5511999999999 -> "(11) 99999-9999" legivel. */
function formatPhoneDisplay(e164: string | null): string {
  if (!e164) return '-';
  const digits = e164.replace(/[^\d]/g, '');
  // +55 + DD(2) + numero (8 ou 9 digitos)
  const br = digits.startsWith('55') ? digits.slice(2) : digits;
  if (br.length === 11) {
    return `(${br.slice(0, 2)}) ${br.slice(2, 7)}-${br.slice(7)}`;
  }
  if (br.length === 10) {
    return `(${br.slice(0, 2)}) ${br.slice(2, 6)}-${br.slice(6)}`;
  }
  return e164;
}

export default function AdminGoleirosScreen() {
  const router = useRouter();
  const [list, setList] = useState<GoleiroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const [fullName, setFullName] = useState<string>('');
  const [phoneRaw, setPhoneRaw] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listGoalkeepers();
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      /* swallowed */
    });
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    setError(null);

    const nameErr = validateFullName(fullName);
    if (nameErr) {
      setError(nameErr);
      return;
    }

    let phone: string | undefined;
    if (phoneRaw.trim().length > 0) {
      const sanitized = sanitizePhone(phoneRaw);
      if (!sanitized) {
        setError('Telefone invalido. Use formato (11) 99999-9999 ou +5511999999999.');
        return;
      }
      phone = sanitized;
    }

    setCreating(true);
    try {
      const created = await createGoalkeeper({
        full_name: fullName,
        phone_whatsapp: phone,
      });
      await refresh();
      setFullName('');
      setPhoneRaw('');
      alertInfo('Goleiro cadastrado', `${created.full_name} adicionado.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [fullName, phoneRaw, refresh]);

  return (
    <SafeAreaView className="flex-1 bg-pitch-50">
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-pitch-900">Goleiros pagos (admin)</Text>
          <Pressable onPress={() => router.replace('/(tabs)/perfil')}>
            <Text className="text-sm text-field-dark">Voltar</Text>
          </Pressable>
        </View>

        <Card>
          <Text className="text-sm font-semibold text-pitch-900">Como funciona</Text>
          <Text className="mt-1 text-xs text-pitch-600">
            Cadastre goleiros pagos do racha. Eles nao fazem login no app - sao criados aqui com
            nome e telefone (opcional). Aparecem automaticamente no sorteio de times (T6.1) como
            goleiros fixos.
          </Text>
        </Card>

        <Card>
          <Text className="text-sm font-semibold text-pitch-900">Novo goleiro</Text>

          <View className="mt-2 gap-1">
            <Text className="text-xs font-semibold text-pitch-700">
              Nome completo (obrigatorio)
            </Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Ex: João Silva"
              placeholderTextColor="#94a3b8"
              className="rounded-xl border border-pitch-300 bg-white px-3 py-2 text-pitch-900"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View className="mt-2 gap-1">
            <Text className="text-xs font-semibold text-pitch-700">WhatsApp (opcional)</Text>
            <TextInput
              value={phoneRaw}
              onChangeText={setPhoneRaw}
              placeholder="(11) 99999-9999"
              placeholderTextColor="#94a3b8"
              className="rounded-xl border border-pitch-300 bg-white px-3 py-2 text-pitch-900"
              keyboardType="phone-pad"
              autoCorrect={false}
            />
          </View>

          <View className="mt-3">
            <Button
              title="Cadastrar goleiro"
              onPress={handleCreate}
              loading={creating}
              disabled={creating}
            />
          </View>

          {error ? <Text className="mt-2 text-sm text-danger">{error}</Text> : null}
        </Card>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-pitch-900">
            Goleiros cadastrados ({list.length})
          </Text>
        </View>

        {loading && list.length === 0 ? (
          <ActivityIndicator />
        ) : list.length === 0 ? (
          <Card>
            <Text className="text-sm text-pitch-600">Nenhum goleiro pago cadastrado.</Text>
          </Card>
        ) : (
          <View className="gap-2">
            {list.map((g) => (
              <Card key={g.id}>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-pitch-900">{g.full_name}</Text>
                    <Text className="mt-0.5 text-xs font-semibold text-goalkeeper">
                      Goleiro pago
                    </Text>
                    <Text className="mt-1 text-xs text-pitch-500">
                      WhatsApp: {formatPhoneDisplay(g.phone_whatsapp)}
                    </Text>
                    <Text className="mt-0.5 text-xs text-pitch-500">
                      Desde {formatBRTshort(g.created_at)}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
