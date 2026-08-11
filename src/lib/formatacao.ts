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