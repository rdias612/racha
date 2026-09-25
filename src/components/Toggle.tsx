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
        role="switch"
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        aria-label={typeof label === 'string' ? label : ariaLabel}
        aria-checked={checked}
        className="sr-only peer"
      />
      <div
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200 ease-in-out peer-focus-visible:outline-2 peer-focus-visible:outline-destaque-texto peer-focus-visible:outline-offset-2 ${
          checked ? 'border-destaque bg-destaque' : 'border-borda bg-superficie-2'
        } ${switchClassName}`}
        aria-hidden="true"
      >
        <span
          className={`pointer-events-none inline-block size-4.5 rounded-full shadow-xs transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5 bg-destaque-tinta' : 'translate-x-0 bg-giz-fraco'
          }`}
        />
      </div>
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
