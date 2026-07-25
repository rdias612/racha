/**
 * components/PaymentRow.tsx
 * Task: T4.1 - Linha de um pagamento para a tela Caixa.
 *
 * Renderiza UMA cobranca (mensalidade / avulsa / goleiro). Desacoplado de
 * store: recebe `onMark?` / `onApprove?` opcionais para T4.2 plugar handlers
 * (jogador marca -> admin aprova). Em T4.1 UI estatica, ambos undefined.
 *
 * Regras de design (DESIGN.md / AC T4.1):
 *   - Borda esquerda colorida por status (verde=paid, amarelo=marked,
 *     cinza=pending) - reusa tokens semanticos do PlayerCard.
 *   - Badge PT-BR por `type` (Mensal/Avulso/Goleiro) secundario.
 *   - Valor R$ formatado via Intl.NumberFormat('pt-BR', {currency:'BRL'}).
 *   - Touch target >=44pt para os botoes onMark/onApprove.
 *   - Acessibilidade: accessibilityLabel junta status + tipo + nome + valor.
 *
 * Status domain (3 estados logicos do fluxo dupla-confirmacao):
 *   - pending: jogador ainda nao marcou como pago.
 *   - marked:  jogador marcou (marked_paid_at preenchido), aguarda admin.
 *   - paid:    admin aprovou (approved_at / paid_at preenchido).
 */

import { Pressable, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { ComponentRef, forwardRef } from 'react';

// ---- Types (locais, sem mexer em types/database.types.ts) -----------------

/** Tipo de cobranca exibido na UI Caixa. */
export type PaymentRowType = 'monthly' | 'casual' | 'goalkeeper';

/**
 * Status de pagamento UI (3 niveis do fluxo dupla-confirmacao).
 * Atencao: o enum SQL so tem pending/paid; `marked` e um estado derivado
 * de marked_paid_at != null && approved_at == null (T4.2 fara essa reducao).
 */
export type PaymentRowStatus = 'pending' | 'marked' | 'paid';

export interface PaymentRowProps {
  /** Nome do jogador (denormalizado no momento do render pelo parent). */
  fullName: string;
  /** Tipo de cobranca. Define badge secundario. */
  type: PaymentRowType;
  /** Valor em R$ (numeric). Formatado via Intl pt-BR. */
  amount: number;
  /** Status UI (pending | marked | paid). Define cor da borda. */
  status: PaymentRowStatus;
  /** Handler opcional (T4.2). Jogador marca como pago. */
  onMark?: () => void;
  /** Handler opcional (T4.2). Admin aprova marcado -> paid. */
  onApprove?: () => void;
}

// ---- Mapas de estilo ------------------------------------------------------

const STATUS_BORDER: Record<PaymentRowStatus, string> = {
  pending: 'border-l-pitch-400',
  marked: 'border-l-warning',
  paid: 'border-l-success',
};

const STATUS_LABEL: Record<PaymentRowStatus, string> = {
  pending: 'Pendente',
  marked: 'Marcado',
  paid: 'Pago',
};

const TYPE_BADGE: Record<PaymentRowType, { label: string; classes: string }> = {
  monthly: {
    label: 'Mensal',
    classes: 'bg-field-light text-field-dark',
  },
  casual: {
    label: 'Avulso',
    classes: 'bg-pitch-200 text-pitch-700',
  },
  goalkeeper: {
    label: 'Goleiro',
    classes: 'bg-goalkeeper/10 text-goalkeeper',
  },
};

// ---- Helper: R$ pt-BR -----------------------------------------------------
//
// Intl.NumberFormat('pt-BR', currency BRL): "R$ 20,00", "R$ 1.234,56".
// Cacheado fora do componente (instancia imutavel + barata).
const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// ---- Componente ------------------------------------------------------------

export const PaymentRow = forwardRef<ComponentRef<typeof View>, PaymentRowProps>(
  function PaymentRow({ fullName, type, amount, status, onMark, onApprove }: PaymentRowProps, ref) {
    const typeBadge = TYPE_BADGE[type];
    const showMark = Boolean(onMark);
    const showApprove = Boolean(onApprove);
    const formattedAmount = brl.format(amount);

    return (
      <View
        ref={ref}
        className={`flex-row items-center gap-3 border-l-4 bg-white py-3 pl-3 pr-2 ${STATUS_BORDER[status]}`}
        style={{ elevation: 1 } as ViewStyle}
        accessibilityLabel={`${STATUS_LABEL[status]}: ${fullName}, ${typeBadge.label}, ${formattedAmount}`}
      >
        <View className="flex-1 gap-1">
          <Text className="text-pitch-900 text-base font-medium" numberOfLines={1}>
            {fullName}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View className={`rounded-md px-1.5 py-0.5 ${typeBadge.classes}`}>
              <Text className="text-[10px] font-semibold uppercase">{typeBadge.label}</Text>
            </View>
            <Text className="text-pitch-500 text-xs">{STATUS_LABEL[status]}</Text>
          </View>
        </View>

        <Text
          className={`text-base font-semibold ${
            status === 'paid' ? 'text-success' : 'text-pitch-900'
          }`}
        >
          {formattedAmount}
        </Text>

        {showMark ? (
          <Pressable
            onPress={onMark}
            accessibilityRole="button"
            accessibilityLabel={`Marcar ${fullName} como pago`}
            className="bg-field active:bg-field-dark min-h-[44px] items-center justify-center rounded-lg px-4 py-2"
          >
            <Text className="text-sm font-semibold text-white">Marquei</Text>
          </Pressable>
        ) : null}

        {showApprove ? (
          <Pressable
            onPress={onApprove}
            accessibilityRole="button"
            accessibilityLabel={`Aprovar pagamento de ${fullName}`}
            className="bg-pitch-200 active:bg-pitch-300 min-h-[44px] items-center justify-center rounded-lg px-4 py-2"
          >
            <Text className="text-pitch-900 text-sm font-semibold">Aprovar</Text>
          </Pressable>
        ) : null}
      </View>
    );
  },
);
