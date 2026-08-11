import { supabase } from "./supabase";

// Controle financeiro: dívidas por jogador.
// Cada linha da tabela `dividas` = UMA dívida individual (mensalidade, avulso, outro).
// O total devido por jogador = soma das dívidas em aberto (paga = false).

export type TipoDivida = "mensalidade" | "avulso" | "outro";

export const TIPOS_DIVIDA: { value: TipoDivida; label: string }[] = [
  { value: "mensalidade", label: "Mensalidade" },
  { value: "avulso", label: "Avulso" },
  { value: "outro", label: "Outro" },
];

export interface Divida {
  id: number;
  jogador_id: number;
  tipo: TipoDivida;
  valor: number;
  descricao: string | null;
  referencia: string | null;
  partida_id: number | null;
  data_divida: string;
  paga: boolean;
  data_pagamento: string | null;
  created_at: string;
  jogadores?: { nome: string; username: string; is_mensalista: boolean } | null;
}

// Agrupamento usado pela tela Administrador: total + itens por jogador.
export interface DividaPorJogador {
  jogador_id: number;
  nome: string;
  username: string;
  is_mensalista: boolean;
  total_devido: number;
  dividas: Divida[];
}

/** Lista todas as dívidas em aberto (paga = false), já com nome do jogador. */
export async function listarDividasEmAberto(): Promise<Divida[]> {
  const { data, error } = await supabase
    .from("dividas")
    .select(
      "id, jogador_id, tipo, valor, descricao, referencia, partida_id, data_divida, paga, data_pagamento, created_at, jogadores(nome, username, is_mensalista)",
    )
    .eq("paga", false)
    .order("data_divida", { ascending: false });
  if (error) throw error;
  // Cast via unknown: o cliente Supabase infere `jogadores` como array, mas em
  // runtime o join m:1 devolve um objeto (ou null). Vide migration 051 (FK única).
  return (data ?? []) as unknown as Divida[];
}

/** Agrupa as dívidas por jogador (total devido + itens), ordenando pelo maior total. */
export function agruparPorJogador(dividas: Divida[]): DividaPorJogador[] {
  const mapa = new Map<number, DividaPorJogador>();
  for (const d of dividas) {
    const j = d.jogadores;
    if (!j) continue;
    let grupo = mapa.get(d.jogador_id);
    if (!grupo) {
      grupo = {
        jogador_id: d.jogador_id,
        nome: j.nome,
        username: j.username,
        is_mensalista: j.is_mensalista,
        total_devido: 0,
        dividas: [],
      };
      mapa.set(d.jogador_id, grupo);
    }
    grupo.total_devido += Number(d.valor);
    grupo.dividas.push(d);
  }
  return [...mapa.values()].sort((a, b) => b.total_devido - a.total_devido);
}

/** Lana uma nova dívida (server-side via RPC). Retorna o id criado. */
export async function registrarDivida(input: {
  jogador_id: number;
  tipo: TipoDivida;
  valor: number;
  data_divida?: string;
  descricao?: string;
  referencia?: string;
  partida_id?: number;
}): Promise<number> {
  const { data, error } = await supabase.rpc("registrar_divida", {
    p_jogador_id: input.jogador_id,
    p_tipo: input.tipo,
    p_valor: input.valor,
    p_data_divida: input.data_divida ?? null,
    p_descricao: input.descricao ?? null,
    p_referencia: input.referencia ?? null,
    p_partida_id: input.partida_id ?? null,
  });
  if (error) throw error;
  return data;
}

/** Marca uma única dívida como paga. */
export async function quitarDivida(dividaId: number): Promise<void> {
  const { error } = await supabase.rpc("quitar_divida", { p_divida_id: dividaId });
  if (error) throw error;
}

/** Marca TODAS as dívidas em aberto de um jogador como pagas. */
export async function quitarDividasJogador(jogadorId: number): Promise<void> {
  const { error } = await supabase.rpc("quitar_dividas_jogador", {
    p_jogador_id: jogadorId,
  });
  if (error) throw error;
}
