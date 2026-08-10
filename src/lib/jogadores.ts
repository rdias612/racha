import { supabase } from "./supabase";
import type { PosicaoId } from "./times";

export interface JogadorLista {
  id: number;
  username: string;
  nome: string;
  posicao: PosicaoId;
  is_admin: boolean;
  is_ativo: boolean;
  is_mensalista: boolean;
}

export async function listarUsernames(): Promise<string[]> {
  const { data, error } = await supabase
    .from("jogadores")
    .select("username")
    .order("username");

  if (error) throw error;
  return (data ?? [])
    .map((jogador) => jogador.username)
    .filter((username) => !/^random[1-6]$/.test(username));
}

export async function listarJogadoresAtivos(): Promise<JogadorLista[]> {
  const { data, error } = await supabase
    .from("jogadores")
    .select("id, username, nome, posicao, is_admin, is_ativo, is_mensalista")
    .eq("is_ativo", true)
    .order("nome");

  if (error) throw error;
  return data ?? [];
}
