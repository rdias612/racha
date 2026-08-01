import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeUsername } from '../_shared/auth-local.ts';

/**
 * Edge Function: provision-user
 * Autenticação local via `profiles` (sem auth.users):
 *   - action 'create'        -> cria jogador em profiles (username + senha).
 *   - action 'reset_password'-> restaura senha de jogador para a senha default.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DEFAULT_PASSWORD = Deno.env.get('LOCAL_AUTH_DEFAULT_PASSWORD') ?? '';
const GROUP_ID = Deno.env.get('FIXED_GROUP_ID') ?? '00000000-0000-0000-0000-000000000001';

const adminClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type UserType = 'mensalista' | 'avulso' | 'goleiro_pago';

type CreatePayload = {
  action: 'create';
  username: string;
  phone_whatsapp?: string | null;
  user_type?: UserType;
  password?: string;
};

type ResetPayload = {
  action: 'reset_password';
  user_id: string;
};

type RequestPayload = CreatePayload | ResetPayload;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isUserType(value: unknown): value is UserType {
  return value === 'mensalista' || value === 'avulso' || value === 'goleiro_pago';
}

/**
 * Autorizacao: requer caller com profile admin (RLS desativado na Opcao A,
 * entao o gate e feito aqui validando o bearer via RPC/consulta).
 */
async function requireAdmin(request: Request): Promise<Response | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Nao autenticado.' }, 401);

  const token = authorization.slice('Bearer '.length);
  const {
    data: { user },
    error: authError,
  } = await adminClient.auth.getUser(token);
  if (authError || !user) {
    // Auth local: sem Supabase Auth por jogador; apenas o admin tecnico
    // autenticado pelo Dashboard/service_role pode chamar esta funcao.
    return json({ error: 'Sessao invalida.' }, 401);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile?.is_admin) return json({ error: 'Acesso restrito ao admin.' }, 403);

  return null;
}

async function createPlayer(payload: CreatePayload): Promise<Response> {
  if (!DEFAULT_PASSWORD) return json({ error: 'Senha inicial nao configurada no servidor.' }, 500);

  let username: string;
  try {
    username = normalizeUsername(payload.username);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Username invalido.' }, 400);
  }

  const userType = payload.user_type ?? 'mensalista';
  if (!isUserType(userType)) return json({ error: 'Tipo de jogador invalido.' }, 400);

  const { data: existing, error: existingError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existingError) return json({ error: existingError.message }, 500);
  if (existing) return json({ error: 'Username ja cadastrado.' }, 409);

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .insert({
      group_id: GROUP_ID,
      username,
      password: (payload.password ?? DEFAULT_PASSWORD).trim(),
      phone_whatsapp: payload.phone_whatsapp?.trim() || null,
      user_type: userType,
      is_admin: false,
    })
    .select('id, username, phone_whatsapp, user_type, is_admin, created_at')
    .single();

  if (profileError || !profile) {
    return json({ error: profileError?.message ?? 'Nao foi possivel criar o profile.' }, 400);
  }

  return json({ profile }, 201);
}

async function resetPassword(payload: ResetPayload): Promise<Response> {
  if (!DEFAULT_PASSWORD) return json({ error: 'Senha inicial nao configurada no servidor.' }, 500);

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', payload.user_id)
    .maybeSingle();
  if (profileError || !profile) return json({ error: 'Jogador nao encontrado.' }, 404);
  if (profile.is_admin)
    return json({ error: 'A senha de um admin nao pode ser resetada aqui.' }, 400);

  const { error } = await adminClient
    .from('profiles')
    .update({ password: DEFAULT_PASSWORD })
    .eq('id', profile.id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);

  const authError = await requireAdmin(request);
  if (authError) return authError;

  let payload: RequestPayload;
  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return json({ error: 'JSON invalido.' }, 400);
  }

  if (payload.action === 'create') return createPlayer(payload);
  if (payload.action === 'reset_password') return resetPassword(payload);
  return json({ error: 'Acao invalida.' }, 400);
});
