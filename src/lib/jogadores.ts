import { supabase } from "./supabase";
import type { PosicaoId } from "./times";

// Detecta jogadores "random" (placeholders): username com prefixo 'random'
// e sufixo opcional de dígitos (casa 'random', 'random1'...'random6', 'random99').
// Case-insensitive para equivaler ao .toLowerCase().startsWith("random").
export function isRandomUsername(username?: string | null): boolean {
  return !!username && /^random\d*$/i.test(username.trim());
}

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
    .filter((username) => !isRandomUsername(username));
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
    .filter((j) => !isRandomUsername(j.username))
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

export async function atualizarNomeJogador(id: number, nome: string): Promise<void> {
  const { error } = await supabase
    .from("jogadores")
    .update({ nome })
    .eq("id", id);

  if (error) throw error;
}

// Redefine a senha do jogador para o padrão "123" (RPC resetar_senha).
export async function resetarSenhaJogador(id: number): Promise<void> {
  const { data, error } = await supabase.rpc("resetar_senha", {
    p_jogador_id: id,
  });

  if (error) throw error;
  if (data !== true) throw new Error("Jogador não encontrado.");
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

