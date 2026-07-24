/**
 * components/ui/Button.tsx
 * Task: T1.5 - Botao reutilizavel PT-BR friendly.
 *
 * Regras:
 *   - Touch target >=44pt (padding generoso `px-5 py-3`).
 *   - 4 variantes: primary, secondary, ghost, danger.
 *   - Estados: loading (ActivityIndicator), disabled (opacidade).
 *   - Visual: rounded-xl (borda arredondada PT-BR friendly).
 *   - Acessibilidade: role/Accessibility & feedback visual no disabled.
 */

import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { ComponentRef, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  onPress: PressableProps['onPress'];
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Mapa variante -> classes NativeWind (container + texto).
 * Centralizado para facil manutencao.
 */
const VARIANT_CLASSES: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-field active:bg-field-dark',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-pitch-200 active:bg-pitch-300',
    text: 'text-pitch-900',
  },
  ghost: {
    container: 'bg-transparent active:bg-pitch-100',
    text: 'text-field-dark',
  },
  danger: {
    container: 'bg-danger active:opacity-80',
    text: 'text-white',
  },
};

/**
 * Button reutilizavel.
 * Ha casos em que o `onPress` precisa ser omitido (ex: loading-only).
 * Mantemos como obrigatorio conforme contrato da task.
 */
export const Button = forwardRef<ComponentRef<typeof Pressable>, ButtonProps>(function Button(
  { title, onPress, variant = 'primary', loading = false, disabled = false, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  const classes = VARIANT_CLASSES[variant];

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={title}
      className={`px-5 py-3 rounded-xl items-center justify-center min-h-[44px] flex-row gap-2 ${classes.container} ${
        isDisabled ? 'opacity-50' : ''
      }`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#15803d' : '#ffffff'} />
      ) : null}
      <Text className={`text-base font-semibold ${classes.text} ${loading ? 'ml-2' : ''}`}>
        {title}
      </Text>
    </Pressable>
  );
});
