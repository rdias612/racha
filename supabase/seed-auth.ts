/**
 * Seed: supabase/seed-auth.ts
 * Task: T1.3b - Cria goleiros + admin fake em `auth.users` + sync PROFILES.
 *
 * POR QUE ESTE SCRIPT EXISTE (nao pode ser SQL puro):
 *   - `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE`.
 *   - `auth.users` e gerenciado por GoTrue (Supabase Auth); SQL puro NAO
 *     consegue inserir usuarios la de forma valida.
 *   - Sendo assim, goleiro_pago e admin fake precisam ser criados via
 *     Admin API (service_role): `supabase.auth.admin.createUser()`.
 *
 * PREREQUISITOS:
 *   - Migrations aplicadas (`npm run db:reset`).
 *   - `.env.server` com SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *   - Trigger `handle_new_user()` (T1.5) opcional: se existir, cria PROFILES
 *     automaticamente; se nao, este script faz INSERT manual idempotente.
 *
 * IDEMPOTENTE:
 *   - Antes de criar usuario, faz lookup por `email` em `auth.users`
 *     (via admin.listUsers) e em `profiles`.
 *   - Re-executar o script nao duplica nada (so atualiza metadados).
 *
 * SEGURANCA:
 *   - Roda SOMENTE com service_role. Esta chave NUNCA entra no APK.
 *   - O script NAO loga a chave (apenas confirma ausencia/presenca).
 *
 * USO:
 *   npm run seed:auth
 */

import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// 0. Config + guards
// ---------------------------------------------------------------------------

dotenv.config({ path: '.env.server' });

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const GROUP_ID = '00000000-0000-0000-0000-000000000001';

interface UpserTarget {
  email: string;
  full_name: string;
  user_type: 'mensalista' | 'goleiro_pago';
  is_admin: boolean;
}

const TARGETS: UpserTarget[] = [
  {
    email: 'admin@futamigos.local',
    full_name: 'Administrador Temporario',
    user_type: 'mensalista',
    is_admin: true,
  },
  {
    email: 'goleiro1@futamigos.local',
    full_name: 'Goleiro 1',
    user_type: 'goleiro_pago',
    is_admin: false,
  },
  {
    email: 'goleiro2@futamigos.local',
    full_name: 'Goleiro 2',
    user_type: 'goleiro_pago',
    is_admin: false,
  },
];

function fail(msg: string): never {
  console.error(`[seed-auth] FALHA: ${msg}`);
  process.exit(1);
}

function log(msg: string): void {
  console.log(`[seed-auth] ${msg}`);
}

if (!SUPABASE_URL) {
  fail('SUPABASE_URL ausente em .env.server (ver .env.server.example).');
}
if (!SERVICE_ROLE_KEY) {
  fail('SUPABASE_SERVICE_ROLE_KEY ausente em .env.server.');
}

// Client admin (service_role -> bypassa RLS). NUNCA expor no APK.
const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// 1. Helpers idempotentes
// ---------------------------------------------------------------------------

/**
 * Busca id de usuario auth por email.
 * Retorna { id } ou null se nao existir.
 */
async function findAuthUserByEmail(email: string): Promise<string | null> {
  // listUsers retorna ate 1000 por pagina; MVP tem poucos usuarios fake.
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    fail(`listUsers falhou: ${error.message}`);
  }
  const match = (data?.users ?? []).find((u) => u.email === email);
  return match?.id ?? null;
}

/**
 * Cria (ou reusa) usuario em auth.users.
 * - Se ja existe por email: reusa o id.
 * - Senao: createUser com email_confirm=true (login imediato nao exigido,
 *   mas mantemos consistente para goleiros sem senha).
 */
async function ensureAuthUser(target: UpserTarget): Promise<string> {
  const existing = await findAuthUserByEmail(target.email);
  if (existing) {
    log(`Usuario auth ja existe: ${target.email} (${existing})`);
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: target.email,
    email_confirm: true,
    user_metadata: {
      full_name: target.full_name,
    },
  });
  if (error || !data?.user) {
    fail(`createUser(${target.email}) falhou: ${error?.message ?? 'sem dados'}`);
  }
  log(`Usuario auth criado: ${target.email} (${data.user.id})`);
  return data.user.id;
}

/**
 * Sincroniza PROFILES para o userId informado.
 * - Trigger handle_new_user (T1.5) pode ter criado a linha: UPDATE.
 * - Se nao existir: INSERT manual (idempotente via upsert).
 */
async function syncProfile(userId: string, target: UpserTarget): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      group_id: GROUP_ID,
      full_name: target.full_name,
      user_type: target.user_type,
      is_admin: target.is_admin,
    },
    { onConflict: 'id' },
  );
  if (error) {
    fail(`upsert profile(${target.email}) falhou: ${error.message}`);
  }
  const perfilMsg =
    target.user_type === 'goleiro_pago'
      ? `${target.full_name} atualizado: user_type=goleiro_pago, group_id=${GROUP_ID}`
      : target.is_admin
        ? `${target.full_name} atualizado para is_admin=true`
        : `${target.full_name} atualizado`;
  log(perfilMsg);
}

// ---------------------------------------------------------------------------
// 2. Orquestracao
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log('Iniciando seed auth (1 admin + 2 goleiros)...');
  log(`SUPABASE_URL=${SUPABASE_URL}`);
  log(`GROUP_ID=${GROUP_ID}`);
  log('SUPABASE_SERVICE_ROLE_KEY=*** (oculta por seguranca)');

  for (const target of TARGETS) {
    const userId = await ensureAuthUser(target);
    await syncProfile(userId, target);
  }

  log('Seed auth concluido com sucesso.');
}

main().catch((err) => {
  fail(`erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
});
