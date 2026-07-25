/**
 * lib/whatsapp.ts
 * Task: T3.2 - Gerador de mensagens PT-BR formatadas para WhatsApp.
 *
 * Gera 3 templates:
 *   (a) Texto de Segunda: lista completa confirmados/pendentes/fila.
 *   (b) Alerta 48h (Ter 19h): recap lista final confirmados+pendentes.
 *   (c) Novidade de confirmacao: avulso promovido.
 *
 * Cadeia de envio (3 niveis):
 *   L1: Deep Link `whatsapp://send?text=<URL-ENCODED>` -> WhatsApp nativo.
 *   L2: Web Share (`expo-sharing`) -> se WhatsApp nao instalado mas share nativo OK.
 *   L3: Clipboard (`expo-clipboard`) + toast PT-BR 'Texto copiado! Cole no WhatsApp.'.
 *
 * Constraints:
 *   - UI 100% PT-BR hardcoded.
 *   - Encode UTF-8 preservando acentos (Presenca/Confirmados/Joao/Coracao).
 *   - Proibido usar campo morto 'avatar' (N2 do PRD).
 *   - Sem API Business/bot - so Deep Link + Web Share + Clipboard manuais.
 */

// ----- Types ----------------------------------------------------------------

/**
 * Jogador no minimo para templates - apenas nome visivel ao publico.
 * Nao importa `avatar` (campo morto N2 do PRD): templates nunca devem menciona-lo.
 */
export interface ShareablePlayer {
  fullName: string;
}

/** Contexto de chamada para os templates (gerado do PresenceStore + GroupStore). */
export interface MondayTextContext {
  matchLabel: string;
  confirmed: ShareablePlayer[];
  pending: ShareablePlayer[];
  waiting: ShareablePlayer[];
}

export interface Alert48hContext {
  matchLabel: string;
  confirmed: ShareablePlayer[];
  pending: ShareablePlayer[];
}

export interface PromotionContext {
  matchLabel: string;
  promotedPlayer: string;
}

/** Capacidade maxima de confirmados (PRD: 2 goleiros + 14 jogadores). */
export const CONFIRMED_CAPACITY = 16;

// ----- Pure helpers ---------------------------------------------------------

/** Bullets numerados PT-BR: troca virgula/sobrenome nada, mantem nome bruto. */
function numbered(players: ShareablePlayer[], startAt = 1): string[] {
  return players.map((p, i) => `${i + startAt}. ${p.fullName}`);
}

// ----- Template 1: Texto de Segunda ----------------------------------------
//
// Mensagem completa que o admin envia na segunda-feira para o grupo do racha,
// montando o panorama da semana. Estrutura canonica com 3 secoes.

export function buildMondayText(ctx: MondayTextContext): string {
  const { matchLabel, confirmed, pending, waiting } = ctx;

  const confirmedLines = numbered(confirmed);
  const pendingLines = numbered(pending);
  const waitingLines = numbered(waiting);

  // Ate 16 = titulares; alem = reservas (corte visual).
  const titulares = confirmedLines.slice(0, CONFIRMED_CAPACITY);
  const reservas = confirmedLines.slice(CONFIRMED_CAPACITY);
  const titularCount = `${confirmed.length}/${CONFIRMED_CAPACITY}`;

  const secaoConfirmados =
    reservas.length > 0
      ? [...titulares, '', 'Reservas:', ...reservas].join('\n')
      : titulares.join('\n');

  const lines: string[] = [
    'Texto de Segunda',
    matchLabel,
    '',
    `Confirmados (${titularCount}):`,
    secaoConfirmados || 'Ninguem confirmado ainda.',
    '',
    'Pendentes:',
    pendingLines.join('\n') || 'Sem pendentes.',
    '',
    'Fila de espera:',
    waitingLines.join('\n') || 'Fila vazia.',
  ];

  return lines.join('\n');
}

// ----- Template 2: Alerta 48h (Ter 19h) ------------------------------------
//
// Recap da lista final as 48h do cutoff (terca 19h BRT).

export function buildAlert48hText(ctx: Alert48hContext): string {
  const { matchLabel, confirmed, pending } = ctx;

  const confirmedLines = numbered(confirmed);
  const titulares = confirmedLines.slice(0, CONFIRMED_CAPACITY);
  const reservas = confirmedLines.slice(CONFIRMED_CAPACITY);
  const titularCount = `${confirmed.length}/${CONFIRMED_CAPACITY}`;

  const secaoConfirmados =
    reservas.length > 0
      ? [...titulares, '', 'Reservas:', ...reservas].join('\n')
      : titulares.join('\n');

  const lines: string[] = [
    'Alerta 48h',
    matchLabel,
    '',
    'Lista final de confirmados:',
    `Confirmados (${titularCount}):`,
    secaoConfirmados || 'Ninguem confirmado ainda.',
    '',
    'Pendentes (confirmar ate terca 19h):',
    pending.length > 0 ? numbered(pending).join('\n') : 'Sem pendentes.',
  ];

  return lines.join('\n');
}

// ----- Template 3: Novidade de confirmacao ----------------------------------
//
// Mensagem avulsa: avulso promovido da fila para confirmado.

export function buildPromotionText(ctx: PromotionContext): string {
  const { matchLabel, promotedPlayer } = ctx;

  return [
    'Novidade de confirmacao',
    matchLabel,
    '',
    `${promotedPlayer} foi confirmado para a pelada!`,
    'Bora, galera!',
  ].join('\n');
}

// ----- Deep Link builder ----------------------------------------------------
//
// Nota: encodeURIComponent preserva emojis/novas linhas e CORRIGE acentos.
// RN/Android envia o scheme 'whatsapp://' para o app nativo (se instalado).

export function buildWhatsAppDeepLink(text: string): string {
  return `whatsapp://send?text=${encodeURIComponent(text)}`;
}

// ----- Shared IO (executado no device, nao importado por smoke test) -------
//
// Importacao dinamica de expo-linking / expo-sharing / expo-clipboard para nao
// quebrar testes tsx (que rodam em Node sem native bridge).

export type ShareTemplateKind = 'monday' | 'alert48h' | 'promotion';

/** Resolve texto PT-BR pelo tipo de template. */
export function resolveTemplateText(
  kind: ShareTemplateKind,
  ctx: MondayTextContext | Alert48hContext | PromotionContext,
): string {
  switch (kind) {
    case 'monday':
      return buildMondayText(ctx as MondayTextContext);
    case 'alert48h':
      return buildAlert48hText(ctx as Alert48hContext);
    case 'promotion':
      return buildPromotionText(ctx as PromotionContext);
  }
}

/**
 * Tenta cadeia completa de envio:
 *   1. Deep Link WhatsApp nativo (se instalado).
 *   2. Web Share fallback (expo-sharing).
 *   3. Clipboard + toast PT-BR.
 *
 * Retorna o canal efetivamente usado para feedback na UI.
 *
 * Observacao: IO nativo - nao coberto por smoke test (validacao manual).
 */
export async function shareViaWhatsApp(text: string): Promise<'whatsapp' | 'share' | 'clipboard'> {
  // L1: Deep Link.
  try {
    const Linking = await import('expo-linking');
    const url = buildWhatsAppDeepLink(text);
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return 'whatsapp';
    }
  } catch {
    // ignora e cai para L2 / L3
  }

  // L2: Web Share (expo-sharing).
  try {
    const Sharing = await import('expo-sharing');
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      // expo-sharing exige arquivo fisico; Web Share puro fica para
      // Share.share do proprio RN (texto puro, sem arquivo). Preferimos
      // Share nativo aqui; se Sharing nao suportar texto puro cai L3.
      const Share = (await import('react-native')).Share;
      if (Share) {
        await Share.share({ message: text });
        return 'share';
      }
    }
  } catch {
    // ignora e cai L3
  }

  // L3: Clipboard.
  const Clipboard = await import('expo-clipboard');
  await Clipboard.setStringAsync(text);
  return 'clipboard';
}
