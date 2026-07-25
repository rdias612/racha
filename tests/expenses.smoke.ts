/**
 * tests/expenses.smoke.ts
 * Task: T4.3 - Smoke (sem framework) dos helpers puros de lib/expenses.ts
 *        + lib/expenseReminder.ts.
 *
 * Cobertura (pure logic; IO Supabase + Notif fica para teste manual em device):
 *   - happy-path: deriveExpenseStatus(pending|confirmed)
 *   - invariant:  confirmed_at != null  => 'confirmed'
 *   - boundary:   todos os timestamps null => 'pending'
 *   - state-transition: pending -> confirmed (setar confirmed_at); idempotente.
 *   - computeSaldo: SUM(approved payments) - SUM(confirmed expenses).
 *      * estouro para negativo quando despesas ultrapassam receitas.
 *      * zero quando ambos vazios.
 *      * valores decimais preservados.
 *   - shouldFireGoalkeeperReminder:
 *      * status anterior != finished e novo == finished  => true
 *      * status anterior == finished e novo == finished  => false (idempotente)
 *      * scheduled -> active => false (nao e finished)
 *      * finished -> cancelled => false
 *      * finished -> scheduled => false
 *   - formatReminderTitle/Body: conteudo PT-BR com valor formatado.
 *   - friendlyExpenseError: codigos Postgres 23505/23503/42501/P0002 + fallback.
 *
 * Schema findings (T1.3a verificado na migration):
 *   - EXPENSES: id, group_id, match_id?, type (goalkeeper|field|other),
 *               amount, description?, paid_at?, confirmed_at?, created_at, updated_at.
 *   - NAO ha coluna 'status'; confirmed_at != null e o snapshot final.
 *
 * Execucao: `npx tsx tests/expenses.smoke.ts` (mesmo formato das tasks T2.x/T4.2).
 */

import {
  deriveExpenseStatus,
  computeSaldo,
  friendlyExpenseError,
  shouldFireGoalkeeperReminder,
  formatReminderTitle,
  formatReminderBody,
  type ExpenseLike,
  type PaymentApprovedLike,
} from '../lib/expenses';

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

console.log('== EXPENSES smoke tests (T4.3) ==');

// ----- deriveExpenseStatus ------------------------------------------------
console.log('\n[happy-path + boundary] deriveExpenseStatus');

const expPending: ExpenseLike = { confirmed_at: null };
assertEq(deriveExpenseStatus(expPending), 'pending', 'sem confirmed_at => pending');

const expConfirmed: ExpenseLike = { confirmed_at: '2026-07-25T22:00:00.000Z' };
assertEq(deriveExpenseStatus(expConfirmed), 'confirmed', 'confirmed_at != null => confirmed');

console.log('\n[state-transition] pending -> confirmed');
const transitioned = deriveExpenseStatus({ confirmed_at: null });
assertEq(transitioned, 'pending', 'antes do toggle: pending');
// Simula UI setar confirmed_at = now(): estado derivado passa para confirmed.
assertEq(
  deriveExpenseStatus({ confirmed_at: '2026-07-25T23:00:00.000Z' }),
  'confirmed',
  'apos toggle: confirmed',
);
// Idempotente: re-setar confirmed_at mantem confirmed.
assertEq(
  deriveExpenseStatus({ confirmed_at: '2026-07-25T23:30:00.000Z' }),
  'confirmed',
  're-setar confirmed_at mantem confirmed',
);

// ----- computeSaldo: SUM(approved payments) - SUM(confirmed expenses) -----
console.log('\n[invariant + boundary + input-variation] computeSaldo');

assertEq(computeSaldo([], []), 0, 'listas vazias => 0');

const paymentsApproved: PaymentApprovedLike[] = [
  { amount: 100, approved_at: '2026-07-25T10:00:00.000Z' },
  { amount: 20, approved_at: '2026-07-25T11:00:00.000Z' },
  { amount: 50.5, approved_at: '2026-07-25T12:00:00.000Z' },
];
const expensesConfirmed: ExpenseLike[] = [
  { confirmed_at: '2026-07-25T22:00:00.000Z', amount: 40 },
  { confirmed_at: '2026-07-25T22:30:00.000Z', amount: 80.5 },
];
// receita 170.5 - despesa 120.5 = 50.0
assertEq(
  computeSaldo(paymentsApproved, expensesConfirmed),
  50,
  '170.5 receita - 120.5 despesa => 50.0',
);

// Despesa confirmada mas receita zero => saldo -despesa.
assertEq(computeSaldo([], [{ confirmed_at: 'x', amount: 40 }]), -40, 'sem receita => -40');

// Expense pendente (confirmed_at null) NAO conta - receita intocada.
assertEq(
  computeSaldo([{ amount: 100, approved_at: 'x' }], [{ confirmed_at: null, amount: 999 }]),
  100,
  'expense pendente nao abate saldo',
);

// Payment nao aprovado (approved_at null) NAO conta.
assertEq(
  computeSaldo([{ amount: 100, approved_at: null }], []),
  0,
  'payment nao aprovado nao soma no saldo',
);

// ----- shouldFireGoalkeeperReminder --------------------------------------
console.log('\n[state-transition] shouldFireGoalkeeperReminder');
assert(
  shouldFireGoalkeeperReminder('scheduled', 'finished') === true,
  'scheduled -> finished dispara reminder',
);
assert(
  shouldFireGoalkeeperReminder('active', 'finished') === true,
  'active -> finished dispara reminder',
);
assert(
  shouldFireGoalkeeperReminder('finished', 'finished') === false,
  'finished -> finished (idempotente) nao dispara',
);
assert(
  shouldFireGoalkeeperReminder('cancelled', 'finished') === false,
  'cancelled -> finished (nao e jogou) nao dispara',
);
assert(
  shouldFireGoalkeeperReminder('scheduled', 'active') === false,
  'scheduled -> active nao dispara (so valer finished)',
);
assert(
  shouldFireGoalkeeperReminder('finished', 'scheduled') === false,
  'finished -> scheduled nao dispara',
);
assert(
  shouldFireGoalkeeperReminder('finished', 'cancelled') === false,
  'finished -> cancelled nao dispara',
);

console.log('\n[input-variation] shouldFireGoalkeeperReminder ignora novo status');
// Robusto: status novo ausente => false.
assert(
  shouldFireGoalkeeperReminder('scheduled', undefined) === false,
  'novo status undefined => false (safe)',
);

// ----- formatReminderTitle/Body ------------------------------------------
console.log('\n[happy-path] formatReminderTitle/Body PT-BR');
assert(
  typeof formatReminderTitle() === 'string' && formatReminderTitle().length > 0,
  'title e string nao vazia',
);
// Intl BRL gera "R$ 40,00" (com NBSP entre simbolo e valor). Validamos substring.
const bodyInt = formatReminderBody(40);
assert(bodyInt.includes('40,00'), 'body com valor inteiro contém "40,00"');
assert(
  bodyInt.startsWith('Confirme o pagamento dos goleiros'),
  'body inteiro comeco PT-BR correto',
);
const bodyDec = formatReminderBody(40.5);
assert(bodyDec.includes('40,5'), 'body decimal contém "40,5"');
const bodyZero = formatReminderBody(0);
assert(bodyZero.includes('0,00'), 'body zero contém "0,00"');

// ----- friendlyExpenseError: codigos Postgres PT-BR -----------------------
console.log('\n[error-path] friendlyExpenseError PT-BR');
assertEq(
  friendlyExpenseError({ code: '23505', message: 'unique violation' }),
  'Despesa duplicada.',
  '23505 -> PT-BR amigavel',
);
assertEq(
  friendlyExpenseError({ code: '23503', message: 'fk violation' }),
  'Partida ou grupo invalido.',
  '23503 -> PT-BR amigavel',
);
assertEq(
  friendlyExpenseError({ code: '42501', message: 'insufficient_privilege' }),
  'Voce nao tem permissao de admin para esta acao.',
  '42501 -> PT-BR amigavel',
);
assertEq(
  friendlyExpenseError({ code: 'P0002', message: 'not found' }),
  'Despesa nao encontrada.',
  'P0002 -> PT-BR amigavel',
);
assertEq(
  friendlyExpenseError({ code: 'XX999', message: 'custom' }),
  'custom',
  'codigo desconhecido -> mensagem original',
);
assertEq(
  friendlyExpenseError(null),
  'Erro ao atualizar despesa. Tente novamente.',
  'erro null -> fallback generico',
);
assertEq(
  friendlyExpenseError({}),
  'Erro ao atualizar despesa. Tente novamente.',
  'erro sem code nem message -> fallback generico',
);

// ----- Resumo --------------------------------------------------------------
console.log(`\n== EXPENSES smoke: ${pass} pass, ${fail} fail ==`);
if (fail > 0) {
  process.exit(1);
}
