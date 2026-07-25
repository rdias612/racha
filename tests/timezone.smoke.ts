/**
 * tests/timezone.smoke.ts
 * Task: T2.1 - Smoke (sem framework) dos invariants de lib/timezone.ts.
 *
 * Aceita ser executado como `tsx tests/timezone.smoke.ts`. Sem framework:
 * cada assert dispara throw em falha. Cobertura:
 *   - happy-path: 19:00 BRT -> 22:00 UTC
 *   - invariant round-trip: toBRT(toUTC(x)) === x
 *   - boundary: null/undefined/'' -> null
 *   - boundary: data invalida -> ''
 *   - input-variation: 3 ISOs distintos (com/sem Z, com ms)
 *   - cutoff: terca 19:00 BRT fornecida em partida quinta
 */

import { toBRT, toUTC, formatBRT, cutoffForMatch, isCutoffPassed, BRT_TZ } from '../lib/timezone';

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
      `  [FAIL] ${msg} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`,
    );
  }
}

console.log('== Timezone smoke tests (T2.1) ==');

// ----- happy-path -----
console.log('\n[happy-path] 19:00 BRT -> 22:00 UTC');
const isoUtc = '2026-07-24T22:00:00.000Z';
const brt19 = toBRT(isoUtc);
assert(brt19 instanceof Date, 'toBRT retorna Date');
// 22:00 UTC sao 19:00 BRT (-3 offset fixo).
assertEq(brt19?.getHours(), 19, '19:00 BRT corresponde a 22:00 UTC');

// ----- invariants -----
console.log('\n[invariant] toUTC(toBRT(x)) preserva instante');
const roundTrip = toUTC(toBRT(isoUtc) as Date);
assertEq(roundTrip, isoUtc, 'round-trip BRT<->UTC estavel');

console.log('\n[invariant] offset canônico -3 (sem horário de verão)');
const utcFromBrt = toUTC(new Date('2026-07-24T19:00:00')); // interpretado como BRT
assertEq(utcFromBrt, '2026-07-24T22:00:00.000Z', 'BRT 19:00 vira UTC 22:00 mesmo dia');

// ----- boundary -----
console.log('\n[boundary] entradas invalidas');
assertEq(toBRT(null), null, 'toBRT(null) -> null');
assertEq(toBRT(undefined), null, 'toBRT(undefined) -> null');
assertEq(toBRT(''), null, 'toBRT("") -> null');
assertEq(toBRT('not-a-date'), null, 'toBRT(invalido) -> null');
assertEq(toUTC(null), null, 'toUTC(null) -> null');
assertEq(toUTC('garbage'), null, 'toUTC(invalido) -> null');
assertEq(formatBRT(''), '', 'formatBRT("") -> ""');
assertEq(formatBRT(null), '', 'formatBRT(null) -> ""');

// ----- input-variation -----
console.log('\n[input-variation] 3 ISOs distintos');
const cases = [
  { in: '2026-01-15T22:00:00Z', expect: '15/01/2026 19:00' },
  { in: '2026-06-30T10:30:00Z', expect: '30/06/2026 07:30' },
  { in: '2026-12-31T03:00:00.000Z', expect: '31/12/2026 00:00' },
];
for (const c of cases) {
  assertEq(formatBRT(c.in, 'dd/MM/yyyy HH:mm'), c.expect, `formatBRT ${c.in} -> ${c.expect}`);
}

// ----- cutoff -----
console.log('\n[state-transition] cutoff para quinta -> terca previa');
const match = { date_time: '2026-07-24T22:00:00.000Z' /* quinta 19:00 BRT */ };
const cutoffIso = cutoffForMatch(match);
assert(cutoffIso === '2026-07-21T22:00:00.000Z', `cutoff = terca 19:00 BRT (got ${cutoffIso})`);

console.log('\n[state-transition] isCutoffPassed retorna booleano');
const passed = isCutoffPassed(match);
assert(typeof passed === 'boolean', 'isCutoffPassed -> boolean');

console.log('\n[state-transition] cutoff com match null (illegal) -> false');
assert(isCutoffPassed(null) === false, 'isCutoffPassed(null) -> false');

// ----- token export -----
console.log('\n[constants] BRT_TZ');
assertEq(BRT_TZ, 'America/Sao_Paulo', 'BRT_TZ exportada');

// ----- resumo -----
console.log(`\n== Resumo: ${pass} pass, ${fail} fail ==`);
if (fail > 0) {
  process.exit(1);
}
