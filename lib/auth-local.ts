/**
 * Helpers para autenticação local via tabela `profiles` (username + senha).
 * Não há mais `auth.users` por jogador. A senha é validada pelo RPC public.login().
 */

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 32;
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{1,31}$/;

/**
 * Normaliza e valida um username (lowercase, sem espaços, formato da coluna).
 * Retorna o username normalizado ou lança erro PT-BR.
 */
export function normalizeUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!USERNAME_REGEX.test(username)) {
    throw new Error(
      'Use um username com 2 a 32 caracteres: letras, numeros, ponto, hifen ou underscore.',
    );
  }
  return username;
}

export const PASSWORD_MIN = 6;
