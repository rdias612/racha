/**
 * tests/goleiros.smoke.ts
 * Task: T7.2 - Smoke (sem framework) dos helpers puros de lib/goleiros.ts.
 *
 * Cobertura (pure logic; IO Supabase fica para teste manual em device):
 *   - validateFullName:
 *      * happy-path: nome comum PT-BR com acento
 *      * boundary: null, "", soh espacos, 1 char
 *      * error-path: numeros soh, com emoji
 *      * input-variation: ternos nomes, nome longo, nome sem acento
 *   - sanitizePhone:
 *      * happy-path: E.164 +5511999999999
 *      * input-variation BR sem +55 (11999999999), com espacos/mascara
 *      * error-path: letras, < 10 digitos, null, "+"
 *   - friendlyGoleiroError: codigos Postgres 23505/23503/42501/P0002 + fallback.
 *
 * Schema findings (T7.2 verificado na migration 00000000000001_schema.sql):
 *   - PROFILES: id, group_id?, full_name, phone_whatsapp?, user_type, is_admin,
 *               avatar_url?, created_at, updated_at.
 *   - FK profiles.id -> auth.users(id) sera DROPADA em T7.2 (migration 14)
 *     p/ permitir goleiro_pago sem auth entry. RLS profiles_insert_policy
 *     ja permite admin INSERT qualquer UUID (00000000000007_rls.sql:62-66).
 *
 * Execucao: `npx tsx tests/goleiros.smoke.ts` (mesmo formato das tasks T4.3).
 */

import { validateFullName, sanitizePhone, friendlyGoleiroError } from '../lib/goleiros';

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

console.log('== GOLEIROS smoke tests (T7.2) ==');

// ----- validateFullName ---------------------------------------------------
console.log('\n[happy-path] validateFullName');
assertEq(validateFullName('Joao Silva'), null, 'nome simples => null (ok)');
assertEq(validateFullName('Ana Maria Souza'), null, 'nome com 3 termos => null (ok)');
assertEq(validateFullName('Jose da Silva Pereira'), null, 'nome com preposicao => null (ok)');

console.log('\n[input-variation + boundary] validateFullName');
assertEq(validateFullName('A'), null, '1 char (minimo valido) => null (ok)');
assertEq(validateFullName('Marina'), null, 'nome curto valido => null (ok)');
assertEq(validateFullName('Abcd Abcd Abcd Abcd Abcd Abcd'), null, 'nome longo valido => null (ok)');
assertEq(validateFullName('Caicara Azul'), null, 'nome com acento ausente (ASCII) => null (ok)');

// Trim leading/trailing spaces
assertEq(validateFullName('  Joao  '), null, 'nome com espacos nas bordas => null (ok)');

console.log('\n[error-path] validateFullName');
assert(typeof validateFullName('') === 'string', 'string vazia => mensagem erro (string)');
assert(validateFullName('')!.length > 0, 'erro de vazio tem texto PT-BR nao vazio');
assert(validateFullName('   ') !== null, 'soh espacos => erro (string)');
assert(validateFullName('123') !== null, 'nome soh numeros => erro (string)');
assert(validateFullName('123456 abc') !== null, 'nome com digitos mistos => erro');
assert(validateFullName('Teste 😎') !== null, 'nome com emoji => erro');

// ----- sanitizePhone ------------------------------------------------------
console.log('\n[happy-path] sanitizePhone E.164');
assertEq(sanitizePhone('+5511999999999'), '+5511999999999', 'E.164 completo passa normalizado');
assertEq(
  sanitizePhone('+5511944445555'),
  '+5511944445555',
  'celular Sao Paulo nono digito => E.164',
);

console.log('\n[input-variation] sanitizePhone formatos BR');
assertEq(sanitizePhone('11999999999'), '+5511999999999', 'BR sem +55 => adiciona prefixo +55');
assertEq(
  sanitizePhone('11 9 9999 9999'),
  '+5511999999999',
  'com espacos => remove espacos + prefixo',
);
assertEq(
  sanitizePhone('(11) 9 9999-9999'),
  '+5511999999999',
  'mascara BR (parenteses/traco) => normaliza',
);

console.log('\n[boundary] sanitizePhone edge cases');
// Telefones sem +55 mas >= 10 digitos sao tratados como BR.
assertEq(
  sanitizePhone('1199999999'),
  '+551199999999',
  '10 digitos sem +55 => +55 + 10 digitos (nao adiciona nono digito)',
);

console.log('\n[error-path] sanitizePhone');
assertEq(sanitizePhone(''), null, 'string vazia => null (invalido)');
assertEq(sanitizePhone('   '), null, 'soh espacos => null');
assertEq(sanitizePhone('ABCDEFG'), null, 'letras => null');
assertEq(sanitizePhone('+'), null, 'só sinal + => null');
// Pouquissimos digitos
assert(sanitizePhone('123') === null, 'digitos insuficientes => null');
// Letras mistas com digitos
assert(sanitizePhone('11A99999999') === null, 'com letras misturadas => null');

// ---- friendlyGoleiroError: codigos Postgres PT-BR -----------------------
console.log('\n[error-path] friendlyGoleiroError PT-BR');
assertEq(
  friendlyGoleiroError({ code: '23505', message: 'unique violation' }),
  'Goleiro ja existe.',
  '23505 -> PT-BR amigavel',
);
assertEq(
  friendlyGoleiroError({ code: '23503', message: 'fk violation' }),
  'Referencia invalida (grupo ou tipo de usuario).',
  '23503 -> PT-BR amigavel',
);
assertEq(
  friendlyGoleiroError({ code: '42501', message: 'insufficient_privilege' }),
  'Voce nao tem permissao de admin para cadastrar goleiros.',
  '42501 -> PT-BR amigavel',
);
assertEq(
  friendlyGoleiroError({ code: 'P0002', message: 'not found' }),
  'Goleiro nao encontrado.',
  'P0002 -> PT-BR amigavel',
);

// Fallbacks
assertEq(
  friendlyGoleiroError({ code: 'XX999', message: 'custom' }),
  'custom',
  'codigo desconhecido -> mensagem original',
);
assertEq(
  friendlyGoleiroError(null),
  'Erro ao cadastrar goleiro. Tente novamente.',
  'erro null -> fallback generico',
);
assertEq(
  friendlyGoleiroError({}),
  'Erro ao cadastrar goleiro. Tente novamente.',
  'erro sem code nem message -> fallback generico',
);

// ----- Resumo --------------------------------------------------------------
console.log(`\n== GOLEIROS smoke: ${pass} pass, ${fail} fail ==`);
if (fail > 0) {
  process.exit(1);
}
