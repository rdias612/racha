/**
 * Utilitário central de tratamento e formatação de erros amigáveis para o usuário.
 * Evita exibir mensagens técnicas em inglês (ex: "Failed to fetch") na interface.
 */

export function isErroConexao(erro: unknown): boolean {
  if (!erro) return false;
  const msg = erro instanceof Error ? erro.message : String(erro);
  const padrao =
    /failed to fetch|network\s?error|load failed|offline|sem conex|conexão|timeout|abort/i;
  return padrao.test(msg);
}

export function formatarMensagemErro(
  erro: unknown,
  fallback: string = 'Ocorreu um erro inesperado. Tente novamente.'
): string {
  if (!erro) return fallback;

  if (isErroConexao(erro)) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }

  const msg = erro instanceof Error ? erro.message : String(erro);

  // Mapeamento de erros comuns de autenticação e banco
  if (msg.includes('Invalid login credentials') || msg.includes('Usuário ou senha inválidos')) {
    return 'Não bateu. Confere o usuário e a senha e tenta de novo.';
  }
  if (msg.includes('JWT') || msg.includes('token')) {
    return 'Sessão expirada. Faça login novamente.';
  }
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
    return 'Este registro já existe no sistema.';
  }
  if (msg.includes('permission denied') || msg.includes('permissão')) {
    return 'Você não tem permissão para realizar esta ação.';
  }

  return msg.trim() || fallback;
}
