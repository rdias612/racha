// Fonte única das chaves do cache em memória SWR (`useCache`/`invalidarCache`,
// hooks/useCache.ts — AGENTS.md 5.5). Convenção: prefixo estável em português
// + parâmetros da query após ':'. Telas nunca montam essas strings à mão —
// importe daqui tanto no `useCache` quanto no `invalidarCache` para que
// leitura e invalidação batam sempre na mesma chave.

import type { PosicaoId } from './times';

/** Mural de jogos (view `partidas_com_placar`) — query sem parâmetros. */
export const CHAVE_JOGOS = 'jogos';

/**
 * Boletim Oficial da temporada (RPC `resumo_ano`). O ano entra na chave para
 * que a virada do ano numa sessão aberta não sirva o cache do ano anterior.
 */
export function chaveResumo(ano: number): string {
  return `resumo:${ano}`;
}

/** Ranking: inclui o filtro de posição aplicado na query. */
export function chaveRanking(filtro: PosicaoId | 'todas'): string {
  return `ranking:${filtro}`;
}

/** Comparador de atletas: inclui o par de ids ('-' quando o lado está vazio). */
export function chaveComparador(idA: number | null, idB: number | null): string {
  return `comparar:${idA ?? '-'}:${idB ?? '-'}`;
}
