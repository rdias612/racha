export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export function normalizeUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!USERNAME_REGEX.test(username)) {
    throw new Error(
      'Use um username com 2 a 32 caracteres: letras, numeros, ponto, hifen ou underscore.',
    );
  }
  return username;
}
