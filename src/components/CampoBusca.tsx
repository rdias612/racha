import type { ChangeEvent } from 'react';
import { Search, X } from 'lucide-react';

export interface CampoBuscaProps {
  /** Valor textual atual do campo */
  valor?: string;
  /** Alias em inglês para compatibilidade */
  value?: string;
  /** Callback disparado quando o texto é alterado */
  aoMudar?: (novoValor: string) => void;
  /** Alias em inglês para compatibilidade */
  onChange?: (novoValor: string) => void;
  /** Texto exibido enquanto o campo estiver vazio (padrão: 'Buscar...') */
  placeholder?: string;
  /** Rótulo acessível para leitores de tela */
  ariaLabel?: string;
  /** Foco automático ao montar o componente */
  autoFocus?: boolean;
  /** Desabilita a interação com o campo */
  desabilitado?: boolean;
  /** Alias em inglês para desabilitado */
  disabled?: boolean;
  /** Variante visual de fundo ('superficie-2' é o padrão; 'superficie' para fundos destacados) */
  variante?: 'superficie' | 'superficie-2';
  /** Família tipográfica ('sans' para texto corrido, 'mono' para @usernames/códigos) */
  fonte?: 'sans' | 'mono';
  /** Callback opcional disparado quando a busca é limpa via botão */
  aoLimpar?: () => void;
  /** Classes CSS adicionais para o contêiner externo */
  className?: string;
  /** Classes CSS adicionais para o elemento <input> */
  inputClassName?: string;
  /** Identificador HTML para associação com labels externos */
  id?: string;
  /** Nome do campo para formulários */
  name?: string;
}

/**
 * Campo de busca padronizado com ícone de lupa e botão tátil de limpeza.
 * Garante alvo de toque acessível (min-h-[44px]), prevenção de zoom no iOS (text-base sm:text-sm),
 * foco acessível âmbar e conformidade com o Design System "Súmula de Quinta".
 */
export function CampoBusca({
  valor,
  value,
  aoMudar,
  onChange,
  placeholder = 'Buscar...',
  ariaLabel = 'Buscar',
  autoFocus = false,
  desabilitado,
  disabled,
  variante = 'superficie-2',
  fonte = 'sans',
  aoLimpar,
  className = '',
  inputClassName = '',
  id,
  name,
}: CampoBuscaProps) {
  const textoAtual = valor ?? value ?? '';
  const isDisabled = desabilitado ?? disabled ?? false;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const novoValor = e.target.value;
    aoMudar?.(novoValor);
    onChange?.(novoValor);
  };

  const handleLimpar = () => {
    aoMudar?.('');
    onChange?.('');
    aoLimpar?.();
  };

  const classeFundo =
    variante === 'superficie'
      ? 'bg-superficie shadow-carimbo'
      : 'bg-superficie-2 shadow-xs';

  const classeFonte = fonte === 'mono' ? 'font-mono' : 'font-sans';

  return (
    <div className={`relative ${className}`}>
      <Search
        className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-giz-fraco pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        id={id}
        name={name}
        value={textoAtual}
        onChange={handleChange}
        autoFocus={autoFocus}
        disabled={isDisabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`w-full rounded-[4px] border border-borda pl-9 pr-9 py-2 text-base sm:text-sm text-giz placeholder-giz-fraco min-h-[44px] focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${classeFundo} ${classeFonte} ${inputClassName}`}
      />
      {Boolean(textoAtual) && !isDisabled && (
        <button
          type="button"
          onClick={handleLimpar}
          aria-label="Limpar busca"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-giz-fraco hover:text-giz transition cursor-pointer focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2 rounded-[2px]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
