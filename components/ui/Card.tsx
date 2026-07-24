/**
 * components/ui/Card.tsx
 * Task: T1.5 - Container reutilizavel com sombra suave + padding.
 *
 * Uso tipico:
 *   <Card>
 *     <Text>Conteudo</Text>
 *   </Card>
 *
 * Props:
 *   - className: extensao ( Tailwind classes adicionais).
 *   - children: conteudo.
 */

import { View, type ViewProps } from 'react-native';
import { forwardRef, type ReactNode } from 'react';

export interface CardProps extends ViewProps {
  children: ReactNode;
  className?: string;
}

export const Card = forwardRef<View, CardProps>(function Card(
  { children, className = '', ...rest },
  ref,
) {
  return (
    <View
      ref={ref}
      className={`bg-white rounded-xl p-4 gap-3 border border-pitch-200 ${className}`}
      style={[{ elevation: 2 }, rest.style]}
      {...rest}
    >
      {children}
    </View>
  );
});
