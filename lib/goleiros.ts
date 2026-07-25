/**
 * lib/goleiros.ts
 * Task: T7.2 - Gestao de PROFILES goleiro_pago sem auth (FK dropada).
 *
 * Principios:
 *   - Funcoes PURAS no topo (testaveis sem IO/Supabase): validateFullName,
 *     sanitizePhone, friendlyGoleiroError.
 *   - Acoes de IO (Supabase) abaixo: createGoalkeeper, listGoalkeepers.
 *     Mutam PROFILES respeitando RLS T1.7:
 *       * admin INSERT qualquer UUID (policy profiles_insert_policy).
 *       * membros do grupo leem (SELECT is_group_member).
 *     Lancam Error com mensagem PT-BR (traduzida por friendlyGoleiroError).
 *
 * Schema (T7.2 / migration 00000000000014_drop_profiles_auth_fk.sql):
 *   - FK profiles.id -> auth.users(id) removida para permitir goleiro_pago
 *     sem auth entry (nao faz login no app).
 *   - Trigger handle_new_user (00000000000004_trigger.sql) ainda funciona
 *     para OAuth signups normais.
 *   - RLS profiles_insert_policy (00000000000007_rls.sql:57-82) ja permite
 *     admin INSERT qualquer UUID. Comentario explicita intencional:
 *     "admin cria goleiro_pago".
 *
 * Restricoes:
 *   - group_id fixo do seed T1.3b (FIXED_GROUP_ID em lib/matches.ts).
 *   - Sem novas deps: crypto.randomUUID() disponivel em RN 0.76+.
 *   - Dynamic import supabase dentro das actions IO (nao top-level).
 */

/** Erro com codigo Postgres (Supabase PostgrestError / similar). */
interface DbLikeError {
  code?: string;
  message?: string;
}

// ----- Types --------------------------------------------------------------

/** Input de UI para createGoalkeeper (nome obrigatorio; phone opcional). */
export type GoleiroInsert = {
  full_name: string;
  phone_whatsapp?: string;
};

/** Linha simplificada retornada pelas actions IO (apenas o necessario p/ UI). */
export interface GoleiroRow {
  id: string;
  full_name: string;
  phone_whatsapp: string | null;
  created_at: string;
}

// ----- Pure logic (testavel sem IO) ---------------------------------------

/**
 * Valida nome completo de goleiro (PT-BR friendly).
 *
 * Regras:
 *   - null/vazio/soh espacos => erro.
 *   - minimo 1 char (apos trim).
 *   - deve conter ao menos 1 letra (permite acento latin; bloqueia
 *     numeros/emoji puros).
 *   - aceita preposicoes (da, de, do) e conectores.
 *
 * @returns null se ok; string com msg de erro PT-BR caso contrario.
 */
export function validateFullName(name: string | null | undefined): string | null {
  if (name == null) return 'Nome obrigatorio.';
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'Nome obrigatorio.';
  }
  // Permite letras (incl. acentos latin), espacos, hifens e apostrofos.
  // Exige ao menos uma letra base.
  const hasLetter = /[A-Za-z\u00C0-\u017F]/.test(trimmed);
  if (!hasLetter) {
    return 'Nome deve conter letras.';
  }
  // Bloqueia emojis e simbolos nao-letter (exceto hifen/apostrofo).
  // Permite: letras latin, espacos, hifen, apostrofo.
  const clean = /^[A-Za-z\u00C0-\u017F\s'-]+$/u.test(trimmed);
  if (!clean) {
    return 'Nome contem caracteres invalidos.';
  }
  return null;
}

/**
 * Sanitiza/normaliza telefone para formato E.164 (+55XXXXXXXXXXX).
 *
 * Aceita:
 *   - +5511999999999 (E.164 completo)
 *   - 11999999999 (BR sem +55, adiciona prefixo)
 *   - mascara (11) 9 9999-9999 -> normaliza
 *
 * Regras:
 *   - null/vazio/soh espacos => null (invalido; UI opcional valida upstream).
 *   - remove espacos, parenteses, hifens, tracos.
 *   - se comeca com "+", exige +55 e >= 12 digitos total.
 *   - se nao tem "+", e assume BR: adiciona +55.
 *   - letras ou simbolos => null.
 *   - menos de 10 digitos => null.
 *
 * @returns string normalizada (E.164) ou null se invalido.
 */
export function sanitizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Rejeita letras imediatamente.
  if (/[A-Za-z]/.test(trimmed)) return null;

  // Remove tudo que nao for digito ou "+".
  const stripped = trimmed.replace(/[^\d+]/g, '');
  if (stripped.length === 0) return null;

  const hasPlus = stripped.startsWith('+');

  if (hasPlus) {
    // So aceitamos prefixo +55 com codigo do pais.
    if (!stripped.startsWith('+55')) return null;
    const rest = stripped.slice(3);
    if (rest.length < 10) return null;
    return `+55${rest}`;
  }

  // Sem "+": assume BR (DD + numero). Adiciona +55.
  if (stripped.length < 10) return null;
  return `+55${stripped}`;
}

/**
 * Traduz erro Supabase/Postgres em mensagem PT-BR amigavel para goleiros.
 * Fallback: mensagem original ou texto generico.
 */
export function friendlyGoleiroError(err: DbLikeError | null | undefined): string {
  if (!err || (!err.code && !err.message)) {
    return 'Erro ao cadastrar goleiro. Tente novamente.';
  }
  switch (err.code) {
    case '23505':
      return 'Goleiro ja existe.';
    case '23503':
      return 'Referencia invalida (grupo ou tipo de usuario).';
    case '42501':
      return 'Voce nao tem permissao de admin para cadastrar goleiros.';
    case 'P0002':
      return 'Goleiro nao encontrado.';
    default:
      return err.message || 'Erro ao cadastrar goleiro. Tente novamente.';
  }
}

// ----- IO actions (Supabase) ----------------------------------------------

/** Helper interno: carrega cliente supabase via import dinamico. */
async function getSupabase() {
  const { supabase } = await import('@/lib/supabase');
  return supabase;
}

/**
 * Cria goleiro_pago (sem auth entry) via INSERT direto em PROFILES.
 *
 * - Gera UUID via crypto.randomUUID() (polyfill RN 0.76+).
 * - user_type='goleiro_pago', is_admin=false, group_id=FIXED_GROUP_ID.
 * - Depende de RLS admin bypass (policy profiles_insert_policy).
 *
 * @throws Error com mensagem PT-BR (friendlyGoleiroError) se Supabase falhar.
 */
export async function createGoalkeeper(input: GoleiroInsert): Promise<{
  id: string;
  full_name: string;
}> {
  const supabase = await getSupabase();
  const { FIXED_GROUP_ID } = await import('@/lib/matches');

  const fullName = input.full_name.trim();
  const phone = input.phone_whatsapp?.trim() ? input.phone_whatsapp.trim() : null;

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : ((): string => {
          throw new Error('crypto.randomUUID indisponivel neste ambiente.');
        })();

  const payload = {
    id,
    group_id: FIXED_GROUP_ID,
    full_name: fullName,
    phone_whatsapp: phone,
    user_type: 'goleiro_pago' as const,
    is_admin: false,
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(payload as never)
    .select('id, full_name')
    .single();
  if (error) throw new Error(friendlyGoleiroError(error));
  return data as { id: string; full_name: string };
}

/**
 * Lista goleiros pagos do grupo fixo (user_type = 'goleiro_pago').
 * Ordenado por created_at ASC (mais antigos primeiro; padrao UI admin).
 *
 * RLS: membros do grupo leem (SELECT is_group_member).
 */
export async function listGoalkeepers(): Promise<GoleiroRow[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone_whatsapp, created_at')
    .eq('user_type', 'goleiro_pago')
    .order('created_at', { ascending: true });
  if (error) throw new Error(friendlyGoleiroError(error));
  return (data ?? []) as GoleiroRow[];
}
