import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

export type ListRowProps<T extends ElementType = 'div'> = {
  as?: T;
  children: ReactNode;
  className?: string;
  interativo?: boolean;
  destacado?: boolean;
  compacto?: boolean;
  disabled?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

export function ListRow<T extends ElementType = 'div'>({
  as,
  children,
  className = '',
  interativo,
  destacado = false,
  compacto = false,
  disabled = false,
  onClick,
  ...restProps
}: ListRowProps<T>) {
  const Component = (as ?? (onClick ? 'button' : 'div')) as ElementType;
  const isInteractive = interativo ?? Boolean(onClick);

  const baseClasses =
    'flex items-center justify-between gap-3 w-full text-left transition-fast text-giz';
  const paddingClasses = compacto
    ? 'py-2 px-2 sm:px-2.5 min-h-[36px]'
    : 'py-3 px-2 sm:px-3 min-h-[44px]';
  const interactiveClasses =
    isInteractive && !disabled
      ? 'cursor-pointer hover:bg-superficie-2/60 active:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-[-2px]'
      : '';
  const destacadoClasses = destacado
    ? 'bg-superficie-2/40 border-l-2 border-l-destaque pl-2 sm:pl-2.5'
    : '';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '';

  const buttonSpecificProps =
    Component === 'button'
      ? { type: (restProps as { type?: string }).type ?? 'button', disabled }
      : {};

  return (
    <Component
      className={`${baseClasses} ${paddingClasses} ${interactiveClasses} ${destacadoClasses} ${disabledClasses} ${className}`}
      onClick={disabled ? undefined : onClick}
      {...buttonSpecificProps}
      {...restProps}
    >
      {children}
    </Component>
  );
}
