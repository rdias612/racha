/**
 * lib/matches.ts
 * Task: T2.0 - Helpers de admin para MATCHES (criar/editar/cancelar).
 *
 * Princípios:
 *   - Timestamps em UTC no DB; conversão BRT só aqui (UI).
 *   - group_id fixo do seed T1.3b (0000...-0001).
 *   - Sem novas deps: parser PT-BR manual (admin-only, low traffic).
 *   - Sem UI: funções puras + queries tipadas Supabase.
 */

import { supabase } from '@/lib/supabase';
import type { Database, MatchRow, MatchStatus } from '@/types/database.types';

/** UUID fixo do seed GROUPS (T1.3b). */
export const FIXED_GROUP_ID = '00000000-0000-0000-0000-000000000001';

export type { MatchRow, MatchStatus };

type MatchesTable = Database['public']['Tables']['matches'];
type MatchInsert = MatchesTable['Insert'];
type MatchUpdate = MatchesTable['Update'];

/**
 * Formata timestamptz UTC -> "dd/MM/yyyy HH:mm" em America/Sao_Paulo.
 * PT-BR friendly, só UI. Fallback p/ ambientes sem Intl completo (Hermes).
 */
export function formatDateTimeBRT(isoUtc: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return isoUtc;
  try {
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 16);
  }
}

/**
 * Faz parse de "dd/MM/yyyy HH:mm" (BRT wall-clock) -> ISO UTC.
 * Retorna null se o input for inválido.
 *
 * Ex: "31/07/2026 19:00" -> "2026-07-31T22:00:00.000Z"
 */
export function parsePtBRDateTime(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;

  const dd = m[1];
  const mm = m[2];
  const yyyy = m[3];
  const hh = m[4];
  const mi = m[5];
  if (!dd || !mm || !yyyy || !hh || !mi) return null;

  const isoLocal = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00-03:00`;
  const d = new Date(isoLocal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Lista MATCHES do group fixo, ordenados por data desc. */
export async function listMatches(): Promise<MatchRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('group_id', FIXED_GROUP_ID)
    .order('date_time', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

export interface CreateMatchInput {
  /** ISO UTC string do date_time da partida. */
  date_time_iso: string;
  /** Snapshot do custo de goleiros (default 40.00 do PRD). */
  goalkeeper_expense?: number;
}

/** Cria MATCH (status=scheduled). Falha se violar UNIQUE (group_id,date_time). */
export async function createMatch(input: CreateMatchInput): Promise<MatchRow> {
  const gk = input.goalkeeper_expense ?? 40.0;
  const payload: MatchInsert = {
    group_id: FIXED_GROUP_ID,
    date_time: input.date_time_iso,
    day_of_week: 4,
    team_scores: {},
    goalkeeper_expense: gk,
    status: 'scheduled',
  };
  const { data, error } = await supabase
    .from('matches')
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as MatchRow;
}

/** Atualiza date_time de um MATCH. */
export async function updateMatchDateTime(matchId: string, isoUtc: string): Promise<MatchRow> {
  const payload: MatchUpdate = {
    date_time: isoUtc,
    day_of_week: 4,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('matches')
    .update(payload as never)
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data as MatchRow;
}

/** Seta status=cancelled (cancelamento operacional do admin). */
export async function cancelMatch(matchId: string): Promise<MatchRow> {
  const payload: MatchUpdate = {
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('matches')
    .update(payload as never)
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data as MatchRow;
}

/** Reabre match cancelado -> status=scheduled. */
export async function reopenMatch(matchId: string): Promise<MatchRow> {
  const payload: MatchUpdate = {
    status: 'scheduled',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('matches')
    .update(payload as never)
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data as MatchRow;
}
