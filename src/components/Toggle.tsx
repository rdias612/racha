import type { ChangeEvent, ReactNode } from 'react';

export interface ToggleProps {
  /** Se o interruptor está ativo/ligado */
  checked: boolean;
  /** Callback disparado quando o estado do toggle é alterado */
  onChange: (checked: boolean) => void;
  /** Rótulo textual ou elemento descritivo principal */
  label?: ReactNode;
  /** Texto de apoio ou descrição detalhada exibida abaixo do rótulo */
  descricao?: ReactNode;
  /** Desabilita a interação com o switch */
  disabled?: boolean;
  /** Rótulo acessível quando não houver label textual visível */
  ariaLabel?: string;
  /** Identificador HTML para o input */
  id?: string;
  /** Nome do campo para formulários */
  name?: string;
  /** Classes CSS adicionais para o contêiner externo */
  className?: string;
  /** Classes CSS adicionais para o track do interruptor */
  switchClassName?: string;
}

/**
 * Interruptor tipo switch padronizado ("Toggle") com estética "Súmula de Quinta".
 * Garante alvo de toque acessível (min-h-[44px]), anel de foco visível pelo teclado,
 * transições suaves e integração com leitores de tela.
 */
export function Toggle({
  checked,
  onChange,
  label,
  descricao,
  disabled = false,
  ariaLabel,
  id,
  name,
  className = '',
  switchClassName = '',
}: ToggleProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(e.target.checked);
    }
  };

  const switchElement = (
    <label
      className={`relative inline-flex items-center min-h-[44px] select-none ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } shrink-0`}
    >
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        aria-label={typeof label === 'string' ? label : ariaLabel}
        className="sr-only peer"
      />
      <div
        className={`w-11 h-6 bg-superficie-2 border border-borda rounded-[4px] peer-focus-visible:outline-2 peer-focus-visible:outline-destaque peer-focus-visible:outline-offset-2 peer-checked:bg-destaque peer-checked:border-destaque transition-colors peer peer-checked:after:translate-x-5 peer-checked:after:bg-destaque-tinta peer-checked:after:border-transparent after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-giz-fraco after:border-borda after:border after:rounded-[2px] after:h-5 after:w-5 after:transition-all ${switchClassName}`}
        aria-hidden="true"
      />
    </label>
  );

  if (!label && !descricao) {
    return <div className={`inline-flex items-center ${className}`}>{switchElement}</div>;
  }

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex-1 min-w-0">
        {label && (
          <span className="font-display font-bold text-sm uppercase tracking-wider text-giz block">
            {label}
          </span>
        )}
        {descricao && <p className="text-xs text-giz-fraco mt-0.5">{descricao}</p>}
      </div>
      {switchElement}
    </div>
  );
}
