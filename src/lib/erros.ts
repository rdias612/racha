/**
 * Utilitário central de tratamento e formatação de erros amigáveis para o usuário.
 * Evita exibir mensagens técnicas em inglês (ex: "Failed to fetch") na interface.
 */

export interface ErroComCodigo {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

export function isErroConexao(erro: unknown): boolean {
  if (!erro) return false;
  const msg =
    erro instanceof Error
      ? erro.message
      : typeof erro === 'object' && erro !== null && 'message' in erro
        ? String((erro as { message: unknown }).message)
        : String(erro);
  const padrao =
    /failed to fetch|network\s?error|load failed|offline|sem conex|conexão|timeout|abort|net::ERR/i;
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

  let code: string | undefined;
  let msg: string;

  if (typeof erro === 'object' && erro !== null) {
    const obj = erro as ErroComCodigo;
    if (typeof obj.code === 'string') {
      code = obj.code;
    }
    if (typeof obj.message === 'string') {
      msg = obj.message;
    } else if (erro instanceof Error) {
      msg = erro.message;
    } else {
      msg = String(erro);
    }
  } else {
    msg = String(erro);
  }

  // 1. Checagem por códigos de erro estáveis do PostgreSQL e PostgREST
  if (code) {
    switch (code) {
      case '23505': // unique_violation
        return 'Este registro já existe no sistema.';
      case '42501': // insufficient_privilege / RLS violation
        return 'Você não tem permissão para realizar esta ação.';
      case 'PGRST301': // JWT expired / unauthorized
        return 'Sessão expirada. Faça login novamente.';
      case '23503': // foreign_key_violation
        return 'Operação não permitida: o registro possui vínculos ativos.';
      case 'PGRST116': // Single row not found
        return 'Registro não encontrado.';
    }
  }

  // 2. Mapeamento por padrões de texto e mensagens conhecidas
  if (/invalid login credentials|usuário ou senha inválidos|credenciais inválidas/i.test(msg)) {
    return 'Não bateu. Confere o usuário e a senha e tenta de novo.';
  }

  if (/\bjwt\b|\btoken\b|jwt expired|invalid claim/i.test(msg)) {
    return 'Sessão expirada. Faça login novamente.';
  }

  if (/duplicate key|unique constraint/i.test(msg)) {
    return 'Este registro já existe no sistema.';
  }

  if (
    /permission denied|permissão|row-level security|violates row-level security policy|unauthorized/i.test(
      msg
    )
  ) {
    return 'Você não tem permissão para realizar esta ação.';
  }

  const limpo = msg.trim();
  if (!limpo || limpo === '[object Object]') {
    return fallback;
  }

  return limpo;
}
