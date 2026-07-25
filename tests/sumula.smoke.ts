/**
 * tests/sumula.smoke.ts
 * Task: T6.2 - Smoke dos helpers puros da sumula.
 *
 * Execucao: `npx tsx tests/sumula.smoke.ts`.
 * A integracao da RPC add_walk_in_participant depende de banco Supabase
 * remoto e fica como handoff de aplicacao/migracao.
 */

import {
  applyStatDelta,
  buildTeamScoresJson,
  canFinishMatch,
  clampStat,
  friendlyError,
  makeEmptyStats,
  parseTeamScores,
  setTeamScore,
  summarizeParticipants,
  type SumulaParticipant,
} from '../lib/sumula';

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
  assert(JSON.stringify(actual) === JSON.stringify(expected), msg);
}

console.log('== SUMULA smoke tests (T6.2) ==');

console.log('\n[boundary + input-variation] stats');
assertEq(clampStat(-1), 0, 'stat negativa -> zero');
assertEq(clampStat(12.9), 12, 'stat fracionaria -> truncada');
assertEq(clampStat(1000), 99, 'stat acima do limite -> 99');
assertEq(applyStatDelta(0, -1), 0, 'decremento no zero permanece zero');
assertEq(applyStatDelta(98, 1), 99, 'incremento respeita limite');
assertEq(makeEmptyStats(), { goals_scored: 0, goals_assisted: 0, own_goals: 0 }, 'stats vazias');

console.log('\n[happy-path + invariant] team_scores');
assertEq(parseTeamScores({ '1': 3, '2': 2 }), { '1': 3, '2': 2 }, 'JSONB valido preservado');
assertEq(parseTeamScores(null), {}, 'JSONB nulo -> mapa vazio');
assertEq(parseTeamScores({ '1': -2, bad: 'x' }), {}, 'valores invalidos filtrados');
const scores = setTeamScore({ '1': 3 }, 2, 7);
assertEq(scores, { '1': 3, '2': 7 }, 'setTeamScore adiciona time sem mutar mapa');
assertEq(buildTeamScoresJson(scores), { '1': 3, '2': 7 }, 'mapa volta para JSONB');

console.log('\n[invariant] participant totals');
const participants = [
  { team_group: 1, goals_scored: 2, goals_assisted: 1, own_goals: 0 },
  { team_group: 2, goals_scored: 1, goals_assisted: 0, own_goals: 1 },
] as SumulaParticipant[];
assertEq(
  summarizeParticipants(participants),
  {
    totalGoals: { '1': 2, '2': 1 },
    totalAssists: { '1': 1, '2': 0 },
    totalOwnGoals: { '1': 0, '2': 1 },
  },
  'totais persistem por time',
);

console.log('\n[state-transition + error-path] finish/error');
assert(canFinishMatch('active'), 'active pode finalizar');
assert(!canFinishMatch('scheduled') && !canFinishMatch('finished'), 'estados ilegais bloqueados');
assert(friendlyError({ code: '42501' }).includes('permissao'), 'erro de permissao traduzido');
assert(friendlyError({ code: 'P0002' }).includes('Partida'), 'partida ausente traduzida');
assert(friendlyError(null).length > 0, 'erro vazio tem fallback');

console.log(`\n== SUMULA smoke: ${pass} pass, ${fail} fail ==`);
if (fail > 0) process.exit(1);
