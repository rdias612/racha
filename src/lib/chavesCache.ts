// Fonte única das chaves do cache em memória SWR (`useCache`/`invalidarCache`,
// hooks/useCache.ts — AGENTS.md 5.5). Convenção: prefixo estável em português
// + parâmetros da query após ':'. Telas nunca montam essas strings à mão —
// importe daqui tanto no `useCache` quanto no `invalidarCache` para que
// leitura e invalidação batam sempre na mesma chave.

import type { PosicaoId } from './times';
import { invalidarCache } from '../hooks/useCache';

/** Mural de jogos (view `partidas_com_placar`) — query sem parâmetros. */
export const CHAVE_JOGOS = 'jogos';

/** Última partida publicada/encerrada com clipes (P7) — card/link da home (RF05). */
export const CHAVE_ULTIMA_PARTIDA_COM_CLIPES = 'clipes:ultima-partida';

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

/**
 * Invalida todas as chaves de telas que exibem dados derivados de partidas.
 * Chamar após QUALQUER mutação de partida (criar, editar, iniciar, publicar,
 * escalar, excluir). Ponto único de manutenção: chave nova dependente de
 * partida entra aqui, sem tocar os call sites. O ano é calculado na chamada
 * (a chave do resumo precisa refletir a virada do ano em sessão aberta).
 */
export function invalidarCachesDependentesDePartida(): void {
  invalidarCache(CHAVE_JOGOS);
  invalidarCache(chaveResumo(new Date().getFullYear()));
  invalidarCache(CHAVE_MEDIAS_NOTAS);
  invalidarCache(chavePartidasRecentesJogadores(2));
}

/** Elenco ativo (inclui randoms) para escalação/confirmação/edição de partidas. */
export const CHAVE_ELENCO_ATIVO = 'elenco:ativos';

/** Elenco completo (exclui randoms) para gestão e comparador. */
export const CHAVE_ELENCO_TODOS = 'elenco:todos';

/** Atletas reais ativos (id+username) para seletores de estatísticas. */
export const CHAVE_ELENCO_SEM_RANDOM = 'elenco:ativos-reais';

/** Goleiros ativos e inativos. */
export const CHAVE_GOLEIROS = 'elenco:goleiros';

/** Usernames reais (exclui randoms) para o autocomplete do login. */
export const CHAVE_USERNAMES = 'jogadores:usernames';

/** Médias de notas aparadas por atleta (RPC `obter_medias_notas_jogadores`). */
export const CHAVE_MEDIAS_NOTAS = 'jogadores:medias-notas';

/** Presenças recentes por atleta; os meses entram na chave (hoje só se usa 2). */
export function chavePartidasRecentesJogadores(meses: number): string {
  return `jogadores:partidas-recentes:${meses}`;
}

/** Stats da temporada de um atleta (view `stats_jogador`). */
export function chaveStatsJogador(jogadorId: number): string {
  return `stats-jogador:${jogadorId}`;
}

/** Estatísticas do racha (RPC `pares_racha`): o mínimo de partidas em dupla entra na chave. */
export function chaveParesRacha(minPartidas: number): string {
  return `pares-racha:${minPartidas}`;
}

/** Estatísticas da aba "Por jogador" (stats + parcerias + destaques) de um atleta. */
export function chaveEstatisticasJogador(jogadorId: number): string {
  return `estatisticas-jogador:${jogadorId}`;
}
