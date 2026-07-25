/**
 * tests/fifo.smoke.ts
 * Task: T3.1 - Smoke (sem framework) do helper puro friendlyFifoError.
 *
 * Cobertura (pure logic; RPCs SECURITY DEFINER ficam para validacao manual):
 *   - happy-path: codigo 23505 -> msg ja possui registro
 *   - happy-path: codigo 23503 -> msg partida/jogador invalido
 *   - happy-path: codigo 42501 -> msg sem permissao admin
 *   - happy-path: codigo P0002 -> msg registro nao encontrado
 *   - error-path: codigo desconhecido -> fallback generico
 *   - boundary: erro null/undefined -> fallback generico
 *   - boundary: erro sem code nem message -> fallback generico
 *   - input-variation: mensagem original preservada em codigo unknown
 *
 * Execucao: `tsx tests/fifo.smoke.ts` (mesmo formato de T2.1/T2.3).
 */

import { friendlyFifoError } from '../lib/fifo';

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

console.log('== FIFO smoke tests (T3.1) ==');

// ----- happy-path: codigos canonicos Postgres -----------------------------
console.log('\n[happy-path] friendlyFifoError codigos canonicos');
assertEq(
  friendlyFifoError({ code: '23505' }),
  'Jogador ja possui registro nesta partida.',
  '23505 -> msgPT-BR unica',
);
assertEq(
  friendlyFifoError({ code: '23503' }),
  'Partida ou jogador invalido.',
  '23503 -> msgPT-BR FK',
);
assertEq(
  friendlyFifoError({ code: '42501' }),
  'Voce nao tem permissao para esta acao (apenas admin).',
  '42501 -> msg admin',
);
assertEq(
  friendlyFifoError({ code: 'P0002' }),
  'Registro de presenca nao encontrado.',
  'P0002 -> msg nao encontrado',
);

// ----- error-path: codigo desconhecido ------------------------------------
console.log('\n[error-path] codigo desconhecido usa fallback generico');
assertEq(
  friendlyFifoError({ code: 'XX999', message: 'boom' }),
  'boom',
  'XX999 + msg -> usa mensagem original',
);
assertEq(
  friendlyFifoError({ code: 'XX999' }),
  'Erro ao processar promocao. Tente novamente.',
  'XX999 sem msg -> fallback generico',
);

// ----- boundary: null/undefined/vazio -------------------------------------
console.log('\n[boundary] ausencia total');
assertEq(
  friendlyFifoError(null),
  'Erro ao processar promocao. Tente novamente.',
  'null -> fallback generico',
);
assertEq(
  friendlyFifoError(undefined),
  'Erro ao processar promocao. Tente novamente.',
  'undefined -> fallback generico',
);
assertEq(
  friendlyFifoError({}),
  'Erro ao processar promocao. Tente novamente.',
  '{} sem code/msg -> fallback generico',
);

// ----- input-variation: mensagens variadas --------------------------------
console.log('\n[input-variation] mensagens distintas preservadas');
assertEq(
  friendlyFifoError({ code: 'X', message: 'conexao perdida' }),
  'conexao perdida',
  'codigo X preserva mensagem custom',
);
assertEq(
  friendlyFifoError({ code: 'X', message: 'timeout RPC' }),
  'timeout RPC',
  'codigo X preserva timeout RPC',
);
assertEq(
  friendlyFifoError({ code: 'X', message: 'JWT expirado' }),
  'JWT expirado',
  'codigo X preserva JWT msg',
);

// ----- invariant: 4 codigos canonicos verschiedem de fallback ------------
console.log('\n[invariant] codigos canonicos distintos e estaveis');
assert(
  friendlyFifoError({ code: '23505' }) !== friendlyFifoError({ code: '23503' }),
  '23505 != 23503',
);
assert(
  friendlyFifoError({ code: '42501' }) !== friendlyFifoError({ code: 'P0002' }),
  '42501 != P0002',
);

console.log(`\n== Resumo FIFO: ${pass} pass, ${fail} fail ==`);
if (fail > 0) {
  process.exit(1);
}
