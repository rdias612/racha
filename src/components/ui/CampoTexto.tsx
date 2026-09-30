import type { InputHTMLAttributes } from 'react';

export interface CampoTextoProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className'> {
  /** Rótulo visível acima do campo (receita label > span do design system). */
  rotulo: string;
  valor: string;
  aoMudar: (novoValor: string) => void;
  /** 'text' (padrão), 'number', 'date'… */
  tipo?: InputHTMLAttributes<HTMLInputElement>['type'];
  placeholder?: string;
  maxLength?: number;
  /** font-mono para valores numéricos, datas e referências. */
  fonteMono?: boolean;
  obrigatorio?: boolean;
  /** Escape no container <label> (ex.: 'col-span-2'). */
  className?: string;
}

const CLASSES_INPUT =
  'w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2';

/**
 * Campo de texto padronizado (par label + input) dos formulários admin.
 * Garante alvo de toque acessível (min-h-[44px]), prevenção de zoom no iOS (text-base sm:text-sm),
 * foco acessível âmbar e conformidade com o Design System "Súmula de Quinta".
 */
export function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  tipo,
  placeholder,
  maxLength,
  fonteMono,
  obrigatorio,
  className,
  ...resto
}: CampoTextoProps) {
  return (
    <label className={'block ' + (className ?? '')}>
      <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
        {rotulo}
      </span>
      <input
        {...resto}
        type={tipo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={obrigatorio}
        className={fonteMono ? `${CLASSES_INPUT} font-mono` : CLASSES_INPUT}
      />
    </label>
  );
}
