/**
 * lib/supabase.ts
 * Task: T1.4 - Cliente Supabase (singleton).
 *
 * Le EXPO_PUBLIC_* (empacotados no APK). NUNCA importar service_role aqui.
 * Usa react-native-url-polyfill antes do createClient (URL/URLSearchParams
 * ausentes em Hermes RN < novo). SecureStore fica em lib/secure-store.
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Falha explicita em dev; em prod o build bloqueia o boot se faltar env.
  throw new Error(
    'Supabase env ausente: defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY em .env',
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Gestao manual via SecureStore (lib/secure-store) dentro do useAuth.
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export type { Database };
