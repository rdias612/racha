/**
 * components/ShareButton.tsx
 * Task: T3.2 - Botao 'Compartilhar' que dispara WhatsApp via 3-nivel fallback.
 *
 * UX:
 *   - Botao primario reutilizando components/ui/Button.
 *   - On press: monta texto do template (uso tipico: Texto de Segunda) via
 *     lib/whatsapp#buildMondayText, depois chama shareViaWhatsApp.
 *   - Feedback PT-BR via Alert.alert:
 *     * clipboard -> 'Texto copiado! Cole no WhatsApp.'
 *     * share     -> 'Abrindo opcoes de compartilhamento...'
 *     * whatsapp  -> (silencioso; o proprio WhatsApp abre)
 *   - Loading injetado pelo proprio Button.
 *
 * Gate: visivel apenas para admin (caller decide renderizar ou nao).
 */

import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/ui';
import { buildMondayText, shareViaWhatsApp, type ShareablePlayer } from '@/lib/whatsapp';

export interface ShareButtonProps {
  /** Label PT-BR do match corrente (ex.: 'Quinta-feira 30/07 - 19:00'). */
  matchLabel: string;
  /** Confirmados do PresenceStore. */
  confirmed: ShareablePlayer[];
  /** Pendentes (avulsos ainda nao aprovados). */
  pending: ShareablePlayer[];
  /** Fila FIFO. */
  waiting: ShareablePlayer[];
}

/**
 * Botao Compartilhar - dispara fluxo WhatsApp (deep link -> web share -> clipboard).
 */
export function ShareButton({ matchLabel, confirmed, pending, waiting }: ShareButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePress = () => {
    void (async () => {
      setLoading(true);
      try {
        const text = buildMondayText({ matchLabel, confirmed, pending, waiting });
        const channel = await shareViaWhatsApp(text);
        if (channel === 'clipboard') {
          Alert.alert('Texto copiado! Cole no WhatsApp.');
        } else if (channel === 'share') {
          Alert.alert('Abrindo opcoes de compartilhamento...');
        }
        // channel === 'whatsapp' -> silencioso (o app abre).
      } catch {
        Alert.alert('Compartilhar', 'Nao foi possivel compartilhar. Tente novamente.');
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <Button
      title="Compartilhar"
      variant="secondary"
      onPress={handlePress}
      loading={loading}
      disabled={loading}
    />
  );
}
