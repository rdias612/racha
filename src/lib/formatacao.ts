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
 * Retorna a data no formato YYYY-MM-DD da próxima quinta-feira no calendário.
 * Se a data informada já for uma quinta-feira, retorna ela mesma.
 */
export function obterProximaQuintaFeira(dataBase: Date = new Date()): string {
  const data = new Date(dataBase);
  const diaSemana = data.getDay(); // 0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua, 4 = Qui, 5 = Sex, 6 = Sáb
  const diasAteQuinta = (4 - diaSemana + 7) % 7;
  data.setDate(data.getDate() + diasAteQuinta);

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}