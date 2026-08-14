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
export const MAX_MENSALISTAS = 16;

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
    // Superadmins sempre mantêm is_admin e is_mensalista como true
    payload.is_admin = true;
    payload.is_mensalista = true;
  } else {
    // Regra: se o status de mensalista for removido, remove também o status de admin
    if (payload.is_mensalista === false) {
      payload.is_admin = false;
    }
    // Regra: não permite ativar is_admin se for não-mensalista
    if (payload.is_admin === true && payload.is_mensalista === false) {
      throw new Error("Apenas jogadores mensalistas podem ser administradores.");
    }
  }

  // Validação do limite de mensalistas se estiver ativando mensalista
  if (payload.is_mensalista === true) {
    const { data: jogadorAtual } = await supabase
      .from("jogadores")
      .select("is_mensalista")
      .eq("id", id)
      .maybeSingle();

    if (jogadorAtual && !jogadorAtual.is_mensalista) {
      const { count, error: countErr } = await supabase
        .from("jogadores")
        .select("id", { count: "exact", head: true })
        .eq("is_mensalista", true);

      if (countErr) throw countErr;
      if ((count ?? 0) >= MAX_MENSALISTAS) {
        throw new Error(
          `Limite máximo de ${MAX_MENSALISTAS} mensalistas atingido. Remova o status de mensalista de outro jogador antes de adicionar.`
        );
      }
    }
  }

  const { error } = await supabase
    .from("jogadores")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}



export async function obterMediasNotasJogadores(): Promise<Record<number, number>> {
  const { data, error } = await supabase
    .from("partida_notas")
    .select("target_id, avg_rating, vote_count");

  if (error || !data) return {};

  const acumulado: Record<number, { soma: number; qtd: number }> = {};
  for (const row of data) {
    const tid = Number(row.target_id);
    const avg = Number(row.avg_rating);
    const count = Number(row.vote_count);
    if (!isNaN(tid) && !isNaN(avg) && !isNaN(count) && count > 0) {
      if (!acumulado[tid]) {
        acumulado[tid] = { soma: 0, qtd: 0 };
      }
      acumulado[tid].soma += avg * count;
      acumulado[tid].qtd += count;
    }
  }

  const medias: Record<number, number> = {};
  for (const id in acumulado) {
    if (acumulado[id].qtd > 0) {
      medias[id] = Number((acumulado[id].soma / acumulado[id].qtd).toFixed(2));
    }
  }
  return medias;
}

