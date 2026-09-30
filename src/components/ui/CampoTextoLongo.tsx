import type { TextareaHTMLAttributes } from 'react';

export interface CampoTextoLongoProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'className'> {
  /** Rótulo visível acima do campo (receita label > span do design system). */
  rotulo: string;
  valor: string;
  aoMudar: (novoValor: string) => void;
  /** Altura em linhas. Padrão 2 (receita atual dos textareas de notificações). */
  linhas?: number;
  placeholder?: string;
  maxLength?: number;
  obrigatorio?: boolean;
  /** Escape no container <label> (ex.: 'col-span-2'). */
  className?: string;
}

const CLASSES_TEXTAREA =
  'w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2';

/**
 * Campo de texto longo padronizado (par label + textarea) dos formulários admin.
 * Garante prevenção de zoom no iOS (text-base sm:text-sm), foco acessível âmbar
 * e conformidade com o Design System "Súmula de Quinta".
 */
export function CampoTextoLongo({
  rotulo,
  valor,
  aoMudar,
  linhas = 2,
  placeholder,
  maxLength,
  obrigatorio,
  className,
  ...resto
}: CampoTextoLongoProps) {
  return (
    <label className={'block ' + (className ?? '')}>
      <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
        {rotulo}
      </span>
      <textarea
        {...resto}
        rows={linhas}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={obrigatorio}
        className={CLASSES_TEXTAREA}
      />
    </label>
  );
}
