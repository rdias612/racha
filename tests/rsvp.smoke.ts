/**
 * tests/rsvp.smoke.ts
 * Task: T2.3 - Smoke (sem framework) dos helpers puros de lib/rsvp.ts.
 *
 * Cobertura (pure logic; IO Supabase fica para validacao manual em device):
 *   - happy-path: rsvpStatusForUserType(mensalista) -> confirmed
 *   - happy-path: rsvpStatusForUserType(avulso)     -> pending_approval
 *   - happy-path: rsvpStatusForUserType(goleiro_pago)-> confirmed (slot garantido)
 *   - rebate-FIFO M4:
 *      * mensalista desistente + cutoff passou       -> rebate true
 *      * mensalista desistente + cutoff NAO passou   -> rebate false
 *      * avulso desistente + cutoff passou           -> rebate false (nao rebate)
 *      * mensalista confirmed + cutoff passou        -> rebate false (nao desistente)
 *      * mensalista waiting_list + cutoff passou     -> rebate false
 *   - cutoff ausente (match null)                    -> rebate false (safe default)
 *   - friendlyError: codigos Postgres 23505/23503/42501 + fallback generico
 *
 * Execucao: `tsx tests/rsvp.smoke.ts` (mesmo formato de T2.1).
 */

import { rsvpStatusForUserType, shouldRebateFifo, friendlyError } from '../lib/rsvp';

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

console.log('== RSVP smoke tests (T2.3) ==');

// ----- happy-path: rsvpStatusForUserType (PRD regra 4 a/b) -----------------
console.log('\n[happy-path] rsvpStatusForUserType');
assertEq(rsvpStatusForUserType('mensalista'), 'confirmed', 'mensalista -> confirmed direto');
assertEq(rsvpStatusForUserType('avulso'), 'pending_approval', 'avulso -> pending_approval');
assertEq(
  rsvpStatusForUserType('goleiro_pago'),
  'confirmed',
  'goleiro_pago -> confirmed (slot garantido/pago)',
);

// ----- rebate FIFO M4: shouldRebateFifo ------------------------------------
//
// cutoff para quinta 24/07/2026 19:00 BRT = terca 21/07/2026 19:00 BRT
// (= 21/07/2026 22:00 UTC). Usamos esse fixture nos 3 cenarios abaixo:
//   - "antes": fixture date um dia antes do cutoff (rebate = false)
//   - "depois": fixture date um dia depois do cutoff (rebate = true)
//
// Observacao: usamos apenas o topico 'date_time' do match para isCutoffPassed.

const matchQuinta = { date_time: '2026-07-24T22:00:00.000Z' /* quinta 19:00 BRT */ };

console.log('\n[rebate-M4] mensalista desistente + cutoff passou -> rebate true');
assert(
  shouldRebateFifo('declined', 'mensalista', matchQuinta) === true,
  'mensalista declined + cutoff passou -> rebate FIFO true',
);

console.log('\n[rebate-M4] cutoff antes/depois (data robusta via helper)');
// Cenario hipotetico onde cutoff ainda nao passou: partida no futuro.
// quinta 31/12/2026 -> cutoff terca 29/12 19:00 BRT (ja no futuro).
const matchFuturo = { date_time: '2026-12-31T22:00:00.000Z' };
assert(
  shouldRebateFifo('declined', 'mensalista', matchFuturo) === false,
  'mensalista declined + cutoff futuro -> rebate false',
);

console.log('\n[rebate-M4] avulso nunca rebated');
assert(
  shouldRebateFifo('declined', 'avulso', matchQuinta) === false,
  'avulso declined + cutoff passou -> rebate false (avulso nao rebate)',
);

console.log('\n[rebate-M4] somente declined dispara rebate');
assert(
  shouldRebateFifo('confirmed', 'mensalista', matchQuinta) === false,
  'mensalista confirmed -> rebate false (ja confirmado)',
);
assert(
  shouldRebateFifo('waiting_list', 'mensalista', matchQuinta) === false,
  'mensalista waiting_list -> rebate false (nao eh desistente)',
);

console.log('\n[boundary] match null -> rebate false (safe default)');
assert(shouldRebateFifo('declined', 'mensalista', null) === false, 'match null -> rebate false');

// ----- friendlyError: codigos Postgres PT-BR -------------------------------
console.log('\n[error-path] friendlyError PT-BR');
assertEq(
  friendlyError({ code: '23505', message: 'unique violation' }),
  'Voce ja confirmou presenca nesta partida.',
  '23505 -> PT-BR amigavel',
);
assertEq(
  friendlyError({ code: '23503', message: 'fk violation' }),
  'Partida ou jogador invalido.',
  '23503 -> PT-BR amigavel',
);
assertEq(
  friendlyError({ code: '42501', message: 'insufficient_privilege' }),
  'Voce nao tem permissao para esta acao.',
  '42501 -> PT-BR amigavel',
);
assertEq(
  friendlyError({ code: 'XX000', message: 'snafu' }),
  'snafu',
  'codigo generico -> mensagem original',
);
assertEq(friendlyError({ message: 'sem codigo' }), 'sem codigo', 'sem code -> mensagem original');
assertEq(
  friendlyError({} as { code?: string; message?: string }),
  'Erro ao atualizar presenca. Tente novamente.',
  'objeto vazio -> fallback pt-br',
);

// ----- resumo --------------------------------------------------------------
console.log(`\n== Resumo: ${pass} pass, ${fail} fail ==`);
if (fail > 0) {
  process.exit(1);
}
