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
  posicao_b: PosicaoId | null;
  media_nota?: number;
}

export const SUPERADMINS = ["dico", "tadeu", "natal"];

export function isSuperAdmin(username?: string | null): boolean {
  if (!username) return false;
  return SUPERADMINS.includes(username.trim().toLowerCase());
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
    .select("id, username, nome, posicao, is_admin, is_ativo, is_mensalista, posicao_b")
    .eq("is_ativo", true)
    .order("nome");

  if (error) throw error;
  return (data ?? []).map((j) => ({
    ...j,
    is_admin: j.is_admin || isSuperAdmin(j.username),
  }));
}

export async function listarTodosJogadores(): Promise<JogadorLista[]> {
  const { data, error } = await supabase
    .from("jogadores")
    .select("id, username, nome, posicao, is_admin, is_ativo, is_mensalista, posicao_b")
    .order("nome");

  if (error) throw error;
  return (data ?? [])
    .filter((j) => !/^random[1-6]$/.test(j.username))
    .map((j) => ({
      ...j,
      is_admin: j.is_admin || isSuperAdmin(j.username),
    }));
}

export async function atualizarCaracteristicasJogador(
  id: number,
  username: string,
  dados: { is_mensalista?: boolean; is_admin?: boolean }
): Promise<void> {
  const payload: { is_mensalista?: boolean; is_admin?: boolean } = { ...dados };

  if (isSuperAdmin(username)) {
    // Superadmins nunca podem perder o status de admin
    payload.is_admin = true;
  }

  const { error } = await supabase
    .from("jogadores")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}

export async function obterMediasNotasJogadores(): Promise<Record<number, number>> {
  const { data, error } = await supabase
    .from("votes")
    .select("target_id, rating");

  if (error || !data) return {};

  const acumulado: Record<number, { soma: number; qtd: number }> = {};
  for (const v of data) {
    const tid = Number(v.target_id);
    const rat = Number(v.rating);
    if (!isNaN(tid) && !isNaN(rat)) {
      if (!acumulado[tid]) {
        acumulado[tid] = { soma: 0, qtd: 0 };
      }
      acumulado[tid].soma += rat;
      acumulado[tid].qtd += 1;
    }
  }

  const medias: Record<number, number> = {};
  for (const id in acumulado) {
    medias[id] = Number((acumulado[id].soma / acumulado[id].qtd).toFixed(2));
  }
  return medias;
}

