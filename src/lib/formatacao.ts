const formatoDataLista: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
};

const formatoDataMobile: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

const formatoDataCompleta: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
};

const formatoFechamento: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

function formatar(data: string, opcoes: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", opcoes).format(new Date(data));
}

export function formatarDataLista(data: string) {
  return formatar(data, formatoDataLista);
}

export function formatarDataMobile(data: string) {
  return formatar(data, formatoDataMobile);
}

export function formatarDataCompleta(data: string) {
  return formatar(data, formatoDataCompleta);
}

export function formatarFechamento(data: string) {
  return formatar(data, formatoFechamento);
}

/** Valor monetário em reais (R$ 1.234,56). */
export function formatarReais(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

/** Primeira letra de cada palavra em maiúscula (nomes na UI). */
export function formatarNome(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (parte) =>
        parte.charAt(0).toLocaleUpperCase("pt-BR") + parte.slice(1),
    )
    .join(" ");
}

/**
 * Extrai com segurança uma mensagem de texto legível de um erro desconhecido.
 */
export function extrairMensagemErro(
  erro: unknown,
  fallback = "Ocorreu um erro inesperado."
): string {
  if (!erro) return fallback;
  if (typeof erro === "string") return erro;
  if (erro instanceof Error && erro.message) return erro.message;
  if (
    typeof erro === "object" &&
    "message" in erro &&
    typeof (erro as { message: unknown }).message === "string"
  ) {
    return (erro as { message: string }).message;
  }
  return fallback;
}