/**
 * tests/teams.smoke.ts
 * Task: T6.1 - Smoke (sem framework) dos helpers puros de lib/teams.ts.
 *
 * Cobertura (pure logic; RPC + IO ficam para validacao manual em device):
 *   - friendlyError: codigos Postgres 23503/42501/P0002/42883 + fallback generico
 *   - splitTeams7x7:
 *      * happy-path: 14 jogadores -> 2 times de 7 (boundary contingency)
 *      * boundary: 0 jogadores -> times vazios
 *      * boundary: 1 jogador -> team1=1, team2=0 (nao explode)
 *      * boundary: 13 jogadores (impar) -> 7/6 (nao perde nenhum)
 *      * invariant: nenhum jogador perdido (uniao == input)
 *      * invariant: nenhum jogador duplicado entre os 2 times
 *      * state-transition: re-executar split preserva membership (idempotente
 *        ws ao set total, embora ordenacao randomica em SQL varie).
 *   - countGkPairForOpposingTeams:
 *      * happy-path: 2 goleiros -> atribui 1 em team 1 e 1 em team 2.
 *      * boundary: 0 goleiros -> sem GK em nenhum time.
 *      * boundary: 1 goleiro -> 1 GK em team 1 e 0 em team 2 (nao explode).
 *      * error-path: 3+ goleiros -> apenas os 2 primeiros alocados (resto 0 GK).
 *   - annotateTeamGroup:
 *      * happy-path: distribuicao 7/7 respeitada apos merge de jogadores + gk.
 *      * invariant: total assignado == total input.
 *
 * Execucao: `tsx tests/teams.smoke.ts` (mesmo formato de T2.3).
 */

import {
  friendlyError,
  splitTeams7x7,
  countGkPairForOpposingTeams,
  annotateTeamGroup,
} from '../lib/teams';

let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) {
    pass += 1;
    console.log(`  [PASS] ${msg}`);
  } else {
    fail += 1;
    console.error(`  [FAIL] ${msg}`);
  }
}

function assertEq<T>(actual: T, expected: T, msg: string): void {
  const eq = JSON.stringify(actual) === JSON.stringify(expected);
  if (eq) {
    pass += 1;
    console.log(`  [PASS] ${msg}`);
  } else {
    fail += 1;
    console.error(
      `  [FAIL] ${msg}  (esperado=${JSON.stringify(expected)}, atual=${JSON.stringify(actual)})`,
    );
  }
}

function makeIds(n: number, prefix = 'u'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}

// ----- friendlyError --------------------------------------------------------
console.log('\n[error-path] friendlyError (codigos Postgres)');
assertEq(
  friendlyError({ code: '23503' }),
  'Partida ou jogador invalido.',
  '23503 -> FK violada PT-BR',
);
assertEq(
  friendlyError({ code: '42501' }),
  'Voce nao tem permissao para sortear os times.',
  '42501 -> permissao negada',
);
assertEq(
  friendlyError({ code: 'P0002' }),
  'Partida ou lista de confirmados nao encontrada.',
  'P0002 -> nao encontrado',
);
assertEq(
  friendlyError({ code: '42883' }),
  'Versao da function incompativel (atualize o app).',
  '42883 -> function signature mismatch',
);
assertEq(
  friendlyError({ code: 'P0001' }),
  'Erro ao sortear times. Tente novamente.',
  'P0001 -> generico PT-BR',
);
assertEq(
  friendlyError({ code: 'XXXXX', message: 'boom' }),
  'Erro ao sortear times. Tente novamente.',
  'codigo desconhecido -> fallback',
);
assertEq(friendlyError(null), 'Erro ao sortear times. Tente novamente.', 'null -> fallback');
assertEq(
  friendlyError(undefined),
  'Erro ao sortear times. Tente novamente.',
  'undefined -> fallback',
);
assertEq(friendlyError({}), 'Erro ao sortear times. Tente novamente.', 'objeto vazio -> fallback');

// ----- splitTeams7x7 --------------------------------------------------------
console.log('\n[happy-path] splitTeams7x7 (14 -> 7/7)');
{
  const ids = makeIds(14);
  const split = splitTeams7x7(ids, 1337);
  assertEq(split.team1.length, 7, 'team1 tem 7 jogadores');
  assertEq(split.team2.length, 7, 'team2 tem 7 jogadores');
}

console.log('\n[boundary] splitTeams7x7 (0, 1, 13)');
{
  const empty = splitTeams7x7([], 1);
  assertEq(empty.team1.length, 0, '0 jogadores -> team1 vazio');
  assertEq(empty.team2.length, 0, '0 jogadores -> team2 vazio');

  const one = splitTeams7x7(makeIds(1), 1);
  assertEq(one.team1.length, 1, '1 jogador -> team1 tem 1');
  assertEq(one.team2.length, 0, '1 jogador -> team2 vazio');

  const odd = splitTeams7x7(makeIds(13), 1);
  assertEq(odd.team1.length, 7, '13 jogadores -> team1 ceiling (7)');
  assertEq(odd.team2.length, 6, '13 jogadores -> team2 floor (6)');
}

console.log('\n[invariant] splitTeams7x7 preserva membership (sem perder ninguem)');
{
  const ids = makeIds(14);
  const split = splitTeams7x7(ids, 99);
  const merged = new Set([...split.team1, ...split.team2]);
  assertEq(merged.size, 14, 'uniao preserva 14 unicos');
  for (const id of ids) {
    assert(merged.has(id), `jogador ${id} continua presente`);
  }
}

console.log('\n[invariant] splitTeams7x7 sem duplicacao entre times');
{
  const ids = makeIds(14);
  const split = splitTeams7x7(ids, 7);
  const dup = split.team1.filter((id) => split.team2.includes(id));
  assertEq(dup.length, 0, 'intersecao team1 x team2 = vazia');
}

console.log(
  '\n[state-transition] splitTeams7x7 deterministica com seed fixa (idempotente ws ao set)',
);
{
  const ids = makeIds(8, 'pl');
  const a = splitTeams7x7(ids, 42);
  const b = splitTeams7x7(ids, 42);
  assertEq(a, b, 'mesma seed -> mesmo resultado');
  const c = splitTeams7x7(ids, 99);
  assert(
    JSON.stringify(a) !== JSON.stringify(c) || ids.length <= 1,
    'seed diferente ->编排 pode variar',
  );
}

// ----- countGkPairForOpposingTeams -----------------------------------------
console.log('\n[happy-path] countGkPairForOpposingTeams (2 GK -> 1/1)');
{
  const gks = makeIds(2, 'gk');
  const gkTeam = countGkPairForOpposingTeams(gks);
  assertEq(gkTeam.gkTeam1.length, 1, 'gk team1 = 1');
  assertEq(gkTeam.gkTeam2.length, 1, 'gk team2 = 1');
}

console.log('\n[boundary] countGkPairForOpposingTeams (0, 1, 3)');
{
  const zero = countGkPairForOpposingTeams([]);
  assertEq(zero.gkTeam1.length, 0, '0 GK -> team1 sem GK');
  assertEq(zero.gkTeam2.length, 0, '0 GK -> team2 sem GK');

  const one = countGkPairForOpposingTeams(makeIds(1, 'gk'));
  assertEq(one.gkTeam1.length, 1, '1 GK -> 1 em team1 (nao explode)');
  assertEq(one.gkTeam2.length, 0, '1 GK -> 0 em team2');

  const three = countGkPairForOpposingTeams(makeIds(3, 'gk'));
  assertEq(three.gkTeam1.length, 1, '3 GK -> apenas 1 em team1');
  assertEq(three.gkTeam2.length, 1, '3 GK -> apenas 1 em team2');
}

// ----- annotateTeamGroup ----------------------------------------------------
console.log('\n[happy-path] annotateTeamGroup (merge jogadores 7/7 + 2 GK opostos)');
{
  const players = makeIds(14);
  const split = splitTeams7x7(players, 2025);
  const gks = countGkPairForOpposingTeams(makeIds(2, 'gk'));
  const merged = annotateTeamGroup(split, gks);
  assertEq(merged.length, 14 + 2, 'total assignado == 16 (14 + 2 GK)');

  const team1Players = merged.filter((m) => m.team_group === 1);
  const team2Players = merged.filter((m) => m.team_group === 2);
  assertEq(team1Players.length, 8, 'team1 tem 7+1GK = 8');
  assertEq(team2Players.length, 8, 'team2 tem 7+1GK = 8');

  const goalkeepers = merged.filter((m) => m.is_goalkeeper);
  assertEq(goalkeepers.length, 2, 'exatamente 2 GK no total');
  assert(
    goalkeepers.some((g) => g.team_group === 1) && goalkeepers.some((g) => g.team_group === 2),
    'GK em times opostos',
  );
}

console.log('\n[invariant] annotateTeamGroup preserva total de entradas');
{
  const players = makeIds(10);
  const split = splitTeams7x7(players, 3);
  const gks = countGkPairForOpposingTeams(makeIds(2, 'gk'));
  const merged = annotateTeamGroup(split, gks);
  assertEq(merged.length, players.length + 2, 'total == soma de players + gk');
}

// ----- Resumo ---------------------------------------------------------------
console.log(`\n=== Resumo: ${pass} pass, ${fail} fail ===`);
if (fail > 0) {
  process.exit(1);
}
