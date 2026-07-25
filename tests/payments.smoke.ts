/**
 * tests/payments.smoke.ts
 * Task: T4.2 - Smoke (sem framework) dos helpers puros de lib/payments.ts.
 *
 * Cobertura (pure logic; IO Supabase fica para validacao manual com 2 contas):
 *   - happy-path: deriveStatus pending/marked/paid a partir de timestamps.
 *   - invariant:  approved_at => paid (independente de marked_paid_at).
 *   - boundary:   todos os timestamps null => pending.
 *   - input-variation: paid_at sozinho / approved_at sozinho / ambos / marked sozinho.
 *   - state-transition:  pending -> marked (setar marked_paid_at); marked -> paid (setar approved_at);
 *                         paid eh idempotente (mais sets mantem paid).
 *   - canUserMark:  null user => false; proprio user => true; outro user => false.
 *   - canUserApprove: admin true => true; admin false => false.
 *   - friendlyPaymentError: codigos Postgres 23503/42501/P0002 + fallback generico.
 *
 * Schema findings (T1.3a):
 *   - payment_status enum SO tem 'pending' | 'paid'.
 *   - 'marked' e estado DERIVADO de (marked_paid_at != null && approved_at == null).
 *   - approved_at OU paid_at preenchido => estado 'paid'.
 *
 * Execucao: `npx tsx tests/payments.smoke.ts`.
 */

import { deriveStatus, canUserMark, canUserApprove, friendlyPaymentError } from '../lib/payments';

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

console.log('== PAYMENTS smoke tests (T4.2) ==');

// interface auxiliar para fixture (subset de PaymentRow).
type Stamps = {
  marked_paid_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
};

// ----- happy-path: deriveStatus ---------------------------------------------
console.log('\n[happy-path] deriveStatus estados logicos do fluxo dupla-confirmacao');

assertEq(
  deriveStatus({ marked_paid_at: null, approved_at: null, paid_at: null } as Stamps),
  'pending',
  'sem timestamps => pending',
);

assertEq(
  deriveStatus({ marked_paid_at: '2026-07-25T10:00:00Z', approved_at: null, paid_at: null } as Stamps),
  'marked',
  'jogador marcou, admin nao aprovou => marked',
);

assertEq(
  deriveStatus({
    marked_paid_at: '2026-07-25T10:00:00Z',
    approved_at: '2026-07-25T12:00:00Z',
    paid_at: '2026-07-25T12:00:00Z',
  } as Stamps),
  'paid',
  'admin aprovou => paid',
);

// ----- invariant: approved_at => paid independente de marked_paid_at --------
console.log('\n[invariant] approved_at => paid (marcado ou nao marcado)');

assertEq(
  deriveStatus({ marked_paid_at: null, approved_at: '2026-07-25T12:00:00Z', paid_at: null } as Stamps),
  'paid',
  'approved_at sozinho => paid (marcacao pulada)',
);

assertEq(
  deriveStatus({ marked_paid_at: null, approved_at: null, paid_at: '2026-07-25T12:00:00Z' } as Stamps),
  'paid',
  'paid_at sozinho => paid (snapshot final)',
);

// ----- boundary: todos null --------------------------------------------------
console.log('\n[boundary] todos null => pending (safe default)');

assertEq(
  deriveStatus({ marked_paid_at: null, approved_at: null, paid_at: null } as Stamps),
  'pending',
  'snapshot fresh => pending',
);

// ----- input-variation: combinacoes de timestamps ---------------------------
console.log('\n[input-variation] 3 valores distintos + extremos');

assertEq(
  deriveStatus({ marked_paid_at: null, approved_at: null, paid_at: null } as Stamps),
  'pending',
  'variacao 1: tudo null -> pending',
);
assertEq(
  deriveStatus({ marked_paid_at: '2026-07-25T10:00:00Z', approved_at: null, paid_at: null } as Stamps),
  'marked',
  'variacao 2: soh marked_paid_at -> marked',
);
assertEq(
  deriveStatus({ marked_paid_at: '2026-07-25T10:00:00Z', approved_at: '2026-07-25T12:00:00Z', paid_at: null } as Stamps),
  'paid',
  'variacao 3: marked + approved (sem paid_at) -> paid (paid_at eh snapshot opcional)',
);

// ----- state-transition: legal, idempotente ---------------------------------
console.log('\n[state-transition] fluxo pendente -> marcado -> pago (idempotente)');

// Estado inicial
const initialState: Stamps = { marked_paid_at: null, approved_at: null, paid_at: null };
assertEq(deriveStatus(initialState), 'pending', 'estado inicial: pending');

// Jogador marca -> setar marked_paid_at
const afterMark: Stamps = { ...initialState, marked_paid_at: '2026-07-25T10:00:00Z' };
assertEq(deriveStatus(afterMark), 'marked', 'apos marcar: marked');

// Admin aprova -> setar approved_at (+ paid_at snapshot)
const afterApprove: Stamps = { ...afterMark, approved_at: '2026-07-25T12:00:00Z', paid_at: '2026-07-25T12:00:00Z' };
assertEq(deriveStatus(afterApprove), 'paid', 'apos aprovar: paid');

// Idempotencia: novo set de approved_at/paid_at mantem paid
const afterReApprove: Stamps = { ...afterApprove, approved_at: '2026-07-25T13:00:00Z' };
assertEq(deriveStatus(afterReApprove), 'paid', 're-aprovar: paid (idempotente)');

// Transicao ILEGAL: ja pago => desmarcar marked_paid_at nao volta a paid
// (defensivo: approved_at ainda setado => paid persiste)
const illegalReset: Stamps = { marked_paid_at: null, approved_at: afterApprove.approved_at, paid_at: afterApprove.paid_at };
assertEq(deriveStatus(illegalReset), 'paid', 'reset marcacao pos-aprovacao: paid persiste (approved_at prevalece)');

// ----- canUserMark: RBAC proprio jogador -----------------------------------
console.log('\n[canUserMark] jogador marca somente o proprio pagamento');

const ownId = '11111111-1111-1111-1111-111111111111';
const otherId = '22222222-2222-2222-2222-222222222222';

assert(canUserMark({ user_id: ownId }, ownId) === true, 'proprio user_id => true');
assert(canUserMark({ user_id: otherId }, ownId) === false, 'user_id de outro => false');

// boundary: usuario null/undefined
assert(canUserMark({ user_id: ownId }, null) === false, 'currentUserId null => false');
assert(canUserMark({ user_id: ownId }, undefined) === false, 'currentUserId undefined => false');

// ----- canUserApprove: RBAC admin -------------------------------------------
console.log('\n[canUserApprove] somente admin aprova');

assert(canUserApprove(true) === true, 'admin true => true');
assert(canUserApprove(false) === false, 'admin false => false');

// ----- friendlyPaymentError: codigos Postgres PT-BR -------------------------
console.log('\n[error-path] friendlyPaymentError PT-BR');

assertEq(
  friendlyPaymentError({ code: '42501', message: 'insufficient_privilege' }),
  'Voce nao tem permissao para esta acao.',
  '42501 (RLS bloqueou marcar/aprovar) -> PT-BR',
);
assertEq(
  friendlyPaymentError({ code: '23503', message: 'fk violation' }),
  'Pagamento invalido.',
  '23503 -> PT-BR amigavel',
);
assertEq(
  friendlyPaymentError({ code: 'P0002', message: 'not found' }),
  'Pagamento nao encontrado.',
  'P0002 (RAISE NOT_FOUND) -> PT-BR',
);
assertEq(
  friendlyPaymentError({ code: 'XX000', message: 'snafu' }),
  'snafu',
  'codigo generico -> mensagem original',
);
assertEq(
  friendlyPaymentError({ message: 'sem codigo' }),
  'sem codigo',
  'sem code -> mensagem original',
);
assertEq(
  friendlyPaymentError({} as { code?: string; message?: string }),
  'Erro ao atualizar pagamento. Tente novamente.',
  'objeto vazio -> fallback pt-br',
);

// ----- resumo ---------------------------------------------------------------
console.log(`\n== Resumo: ${pass} pass, ${fail} fail ==`);
if (fail > 0) {
  process.exit(1);
}
