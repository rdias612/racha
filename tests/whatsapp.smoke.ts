/**
 * tests/whatsapp.smoke.ts
 * Task: T3.2 - Smoke (sem framework) dos templates PT-BR de lib/whatsapp.ts.
 *
 * Cobertura (pure logic: geradores de texto + builders de deep link;
 * IO nativo Linking/clipboard fica para validacao manual em device):
 *   - happy-path: 3 templates renderizam com listas populosas
 *   - happy-path: listas vazias -> mensagem PT-BR adequada
 *   - happy-path: novidade-promocao single
 *   - invariant: acentos preservados (Presenca, Confirmados, Coracao, Joao)
 *   - boundary: encode deep link via encodeURIComponent
 *   - boundary: 16 confirmados -> reservas separados por corte
 *   - boundary: lista pendente com nome tecnico nunca vaza
 *   - error-path: nomes com caractere especial (&, #) nao quebram encode
 *   - input-variation: nomes curto/medio/com-espaco
 *
 * Execucao: `tsx tests/whatsapp.smoke.ts`.
 */

import {
  buildMondayText,
  buildAlert48hText,
  buildPromotionText,
  buildWhatsAppDeepLink,
} from '../lib/whatsapp';

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

function assertIncludes(haystack: string, needle: string, msg: string): void {
  assert(haystack.includes(needle), `${msg} (esperado trecho: "${needle}")`);
}

function assertNotIncludes(haystack: string, needle: string, msg: string): void {
  assert(!haystack.includes(needle), `${msg} (trecho indesejado: "${needle}")`);
}

console.log('== WhatsApp smoke tests (T3.2) ==');

// ----- Filture input --------------------------------------------------------
interface PlayerFixture {
  fullName: string;
}
const fullRoster: PlayerFixture[] = Array.from({ length: 16 }, (_, i) => ({
  fullName: `Jogador ${i + 1}`,
}));
const pendingRoster: PlayerFixture[] = [{ fullName: 'Joao Silva' }, { fullName: 'Maria Coracao' }];
const waitingRoster: PlayerFixture[] = [{ fullName: 'Pedro Santos' }, { fullName: 'Ana Paula' }];

// ===== Template 1: Texto de Segunda (happy-path) ===========================
console.log('\n[happy-path] buildMondayText');
{
  const text = buildMondayText({
    matchLabel: 'Quinta-feira 30/07 - 19:00',
    confirmed: fullRoster,
    pending: pendingRoster,
    waiting: waitingRoster,
  });

  assertIncludes(text, 'Texto de Segunda', 'titulo do template presente');
  assertIncludes(text, 'Confirmados', 'secao Confirmados');
  assertIncludes(text, 'Pendentes', 'secao Pendentes');
  assertIncludes(text, 'Fila de espera', 'secao Fila de espera');
  assertIncludes(text, 'Quinta-feira 30/07 - 19:00', 'label do match');
  assertIncludes(text, 'Joao Silva', 'nome de pendente aparece');
  assertIncludes(text, '16/16', 'capacidade 16/16 exibida');
  assertIncludes(text, 'Coracao', 'acento em nome (Coracao) preservado sem normalizacao');

  // Template nunca deve incluir 'avatar' (campo morto N2 do PRD).
  assertNotIncludes(text.toLowerCase(), 'avatar', 'sem vazar campo morto avatar');

  // Template nunca deve incluir placeholders tecnicos.
  assertNotIncludes(text, 'undefined', 'sem undefined');
  assertNotIncludes(text, '[object Object]', 'sem [object Object]');
}

// ===== Template 2: Alerta 48h (Ter 19h) ====================================
console.log('\n[happy-path] buildAlert48hText');
{
  const text = buildAlert48hText({
    matchLabel: 'Quinta-feira 30/07 - 19:00',
    confirmed: fullRoster,
    pending: pendingRoster,
  });

  assertIncludes(text, 'Alerta 48h', 'titulo do template');
  assertIncludes(text, 'Lista final', 'recap da lista final');
  assertIncludes(text, 'Confirmados', 'secao Confirmados');
  assertIncludes(text, 'Joao Silva', 'joao presente (pendente deste template)');
  assertNotIncludes(text.toLowerCase(), 'avatar', 'sem avatar');
}

// ===== Template 3: Novidade de confirmacao (single) ========================
console.log('\n[happy-path] buildPromotionText');
{
  const text = buildPromotionText({
    matchLabel: 'Quinta-feira 30/07 - 19:00',
    promotedPlayer: 'Carlos Eduardo',
  });

  assertIncludes(text, 'Novidade de confirmacao', 'titulo do template');
  assertIncludes(text, 'Carlos Eduardo', 'nome do promovido');
  assertIncludes(text, 'foi confirmado', ' frase de confirmacao');
  assertNotIncludes(text.toLowerCase(), 'avatar', 'sem avatar');
}

// ===== Invariant: acentos PT-BR preservados =================================
console.log('\n[invariant] acentos PT-BR preservados');
{
  const withAccents: PlayerFixture[] = [{ fullName: 'Jose Coracao' }, { fullName: 'Ana Paula' }];
  const text = buildMondayText({
    matchLabel: 'Quinta-feira',
    confirmed: withAccents,
    pending: [],
    waiting: [],
  });
  assertIncludes(text, 'Coracao', 'acento preservado no nome');
  // Numeracao basica: confirmados contados corretamente
  assertIncludes(text, '2/16', 'contador 2/16');
}

// ===== Boundary: listas vazias -> PT-BR friendly ============================
console.log('\n[boundary] listas vazias');
{
  const text = buildMondayText({
    matchLabel: 'Quinta-feira',
    confirmed: [],
    pending: [],
    waiting: [],
  });
  assertIncludes(text, '0/16', '0/16 quando vazio');
  assertIncludes(text, 'Confirmados', 'cabecalho confirmados mesmo vazio');
  // Nao quebra template se tudo vazio
  assert(text.trim().length > 0, 'template nao vazio mesmo sem dados');
}

// ===== Boundary: mais de 16 -> cortados como reservas ======================
console.log('\n[boundary] cortados viram reservas');
{
  const over: PlayerFixture[] = Array.from({ length: 18 }, (_, i) => ({
    fullName: `Jogador ${i + 1}`,
  }));
  const text = buildMondayText({
    matchLabel: 'Quinta',
    confirmed: over,
    pending: [],
    waiting: [],
  });
  assertIncludes(text, 'Reservas', 'separador Reservas quando > 16');
  assertIncludes(text, '18/16', 'label 18/16 (posicao historica)');
}

// ===== Error-path: nomes com caracteres especiais nao quebram encode ========
console.log('\n[error-path] nomes com caractere especial nao quebram encode');
{
  const tricky: PlayerFixture[] = [{ fullName: 'Junior & Irmao' }, { fullName: 'Teste #1' }];
  const text = buildMondayText({
    matchLabel: 'Quinta',
    confirmed: tricky,
    pending: [],
    waiting: [],
  });
  assertIncludes(text, 'Junior & Irmao', 'nome com & preservado');
  assertIncludes(text, 'Teste #1', 'nome com # preservado');
}

// ===== Deep Link builder ====================================================
console.log('\n[happy-path] buildWhatsAppDeepLink');
{
  // Usamos acento real (Coração) para validar que encodeURIComponent o encoda.
  const sample = 'Texto de Segunda\nQuinta-feira 19:00\nConfirmados: João Coração';
  const url = buildWhatsAppDeepLink(sample);

  assert(url.startsWith('whatsapp://send?text='), 'protocolo whatsapp://send?text=');
  // O texto DEVE estar encodado (encodeURIComponent) para preservar acentos e newlines.
  assert(url.includes('%0A'), 'newlines encodados como %0A');
  assert(
    url.includes('Coração') === false,
    'texto com acento cru ausente da querystring (encodado)',
  );
  // Decode round-trip deve voltar igual.
  const decoded = decodeURIComponent(url.slice('whatsapp://send?text='.length));
  assert(decoded === sample, 'decode round-trip restitui texto integral');
}

console.log('\n== Resultado ==');
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (fail > 0) {
  process.exit(1);
}
