/**
 * lib/timezone.ts
 * Task: T2.1 - Helpers de timezone BRT <-> UTC.
 *
 * Fonte unica de verdade para conversão de timestamps entre o backend
 * (que armazena tudo em UTC em colunas `timestamptz`) e a UI PT-BR
 * (que exibe horários no fuso America/Sao_Paulo = UTC-3, sem horário de
 * verão desde 2019).
 *
 * Biblioteca: `date-fns-tz` (v3.x).
 *   - toZonedTime(iso, 'America/Sao_Paulo'): converte um UTC Date para o
 *     "Date" cujos campos representam o relógio de SP.
 *   - fromZonedTime(date, 'America/Sao_Paulo'): inverso (campo SP -> UTC).
 *   - formatInTimeZone(iso, tz, fmt): formata diretamente em um tz.
 *
 * Restrições (constraints.hard do context_envelope):
 *   - DB sempre UTC; conversão BRT só na UI (helper centralizado aqui).
 *   - Não há horário de verão desde 2019: offset fixo -03:00 o ano todo.
 *
 * Cutoff BRT do PRD regra 4 (validação T2.3): terça-feira 19:00 America/Sao_Paulo
 * antes da partida de quinta. Os helpers `isCutoffPassed` e
 * `nextCutoffBRT` suportam a lógica de rebate FIFO.
 */

import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { isValid, parseISO } from 'date-fns';
import type { MatchRow } from '@/types/database.types';

export const BRT_TZ = 'America/Sao_Paulo';

/** Offset canônico BRT (sem horário de verão). Usado só em mensagens formatadas. */
export const BRT_OFFSET = '-03:00';

/** Dia da semana fixo do racha (PRD: quinta-feira). 0=Domingo ... 4=Quinta. */
export const MATCH_WEEKDAY = 4 as const;

/** Horário local do jogo (PRD). */
export const MATCH_HOUR_BRT = 19 as const;

/** Dia da semana do cutoff de re-confirmação (PRD regra 4: terça-feira). */
export const CUTOFF_WEEKDAY = 2 as const; // 0=Domingo ... 2=Terca.

/** Horário local do cutoff (PRD regra 4: 19:00 BRT). */
export const CUTOFF_HOUR_BRT = 19 as const;

/**
 * Converte um ISO UTC (ex.: '2026-07-24T22:00:00Z') para um `Date` cujos
 * campos (getHours, getDate, etc.) representam o relógio wall-clock de
 * America/Sao_Paulo. Útil para exibição PT-BR sem mudar o instante.
 *
 * Retorna `null` em entrada inválida (não lança; robusto contra payloads DB).
 */
export function toBRT(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parsed = parseISOStrict(iso);
  if (!parsed) return null;
  return toZonedTime(parsed, BRT_TZ);
}

/**
 * Converte um valor wall-clock BRT (campos representando horário SP) para
 * ISO UTC. Aceita entrada flexível:
 *   - Date (cujo campos são interpretados como BRT)
 *   - string ISO sem timezone (ex.: '2026-07-24T19:00:00' = 19h SP)
 *
 * Retorna ISO UTC `string` (ex.: '2026-07-24T22:00:00.000Z') ou `null`
 * em entrada inválida.
 */
export function toUTC(brt: Date | string | null | undefined): string | null {
  if (brt == null) return null;
  const brtDate = brt instanceof Date ? brt : parseISOStrict(brt);
  if (!brtDate || !isValid(brtDate)) return null;
  const utcDate = fromZonedTime(brtDate, BRT_TZ);
  return utcDate.toISOString();
}

/**
 * Formata um ISO UTC diretamente em PT-BR/BRT usando o pattern do date-fns.
 * Padrão comum: 'dd/MM/yyyy HH:mm' (ex.: '24/07/2026 19:00').
 *
 * Retorno vazio em entrada inválida (never throws).
 */
export function formatBRT(iso: string | null | undefined, pattern = 'dd/MM/yyyy HH:mm'): string {
  if (!iso) return '';
  const parsed = parseISOStrict(iso);
  if (!parsed) return '';
  try {
    return formatInTimeZone(parsed, BRT_TZ, pattern);
  } catch {
    return '';
  }
}

/** Formata um ISO UTC para a exibicao curta usada nas telas admin. */
export function formatBRTShort(iso: string | null | undefined): string {
  return formatBRT(iso) || iso || '-';
}

/**
 * Calcula o cutoff BRT para a partida dada: terça-feira 19:00 SP que
 * antecede a partida de quinta. Usado em T2.3 para validar re-confirmação
 * mensalista desistente (rebate FIFO).
 *
 * Retorna ISO UTC do cutoff, ou `null` se a partida ou `date_time` forem
 * inválidas.
 */
export function cutoffForMatch(match: Pick<MatchRow, 'date_time'> | null): string | null {
  if (!match?.date_time) return null;
  const brt = toBRT(match.date_time);
  if (!brt) return null;

  // Domingo=0 ... Terca=2, Quinta=4. Cut-off e' 2 dias antes (terca <=> quinta).
  // Caminha ate CUTOFF_WEEKDAY retroativamente.
  const result = new Date(brt.getTime());
  const dow = result.getDay();
  // Distancia (mod 7) do weekday atual ate o cutoff (sempre para tras).
  const diff = (dow - CUTOFF_WEEKDAY + 7) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(CUTOFF_HOUR_BRT, 0, 0, 0);

  return toUTC(result);
}

/**
 * Indica se o cutoff da partida já passou (no instante atual).
 * `true` => usu desistente não pode mais re-confirmar como mensalista
 * (deve entrar como novo avulso no final da fila FIFO).
 */
export function isCutoffPassed(match: Pick<MatchRow, 'date_time'> | null): boolean {
  const cutoffIso = cutoffForMatch(match);
  if (!cutoffIso) return false;
  const cutoffUtc = parseISOStrict(cutoffIso);
  if (!cutoffUtc) return false;
  return Date.now() >= cutoffUtc.getTime();
}

// ----- Internos ------------------------------------------------------------

/** parseISO tolerante: aceita ISO com ou sem 'Z'/fração/offset. */
function parseISOStrict(iso: string): Date | null {
  try {
    const parsed = parseISO(iso);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
