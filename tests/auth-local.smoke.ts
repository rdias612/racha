import { normalizeUsername, PASSWORD_MIN, USERNAME_REGEX } from '../lib/auth-local';

let pass = 0;
let fail = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    pass += 1;
    console.log(`  [PASS] ${message}`);
  } else {
    fail += 1;
    console.error(`  [FAIL] ${message}`);
  }
}

console.log('== AUTH LOCAL smoke tests ==');

assert(normalizeUsername(' Dico ') === 'dico', 'username normaliza espacos e caixa');
assert(USERNAME_REGEX.test('dico'), 'username valido passa no regex');
assert(PASSWORD_MIN === 6, 'tamanho minimo de senha e 6');

for (const value of ['', 'a', 'nome com espaco', 'nome@outro']) {
  try {
    normalizeUsername(value);
    assert(false, `username invalido rejeitado: ${value || '<vazio>'}`);
  } catch {
    assert(true, `username invalido rejeitado: ${value || '<vazio>'}`);
  }
}

console.log(`== AUTH LOCAL smoke: ${pass} pass, ${fail} fail ==`);
if (fail > 0) process.exit(1);
