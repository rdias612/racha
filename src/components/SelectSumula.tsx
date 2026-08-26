import { ChevronDown } from 'lucide-react';
import { useListbox, type ListboxOpcao } from '../hooks/useListbox';

export type SelectSumulaOpcao = ListboxOpcao<string> & {
  value: string;
  label: string;
  disabled?: boolean;
};

interface SelectSumulaProps {
  value: string;
  onChange: (value: string) => void;
  opcoes: SelectSumulaOpcao[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  /** Classes extras no botão gatilho (ex.: font-mono). */
  triggerClassName?: string;
  'aria-label'?: string;
}

/**
 * Dropdown da súmula: listbox customizado com scrollbar e hover nos tokens do tema.
 * Substitui `<select>` nativo (que força azul de sistema e scrollbar do SO).
 */
export function SelectSumula({
  value,
  onChange,
  opcoes,
  placeholder = 'Selecione…',
  disabled = false,
  required,
  id,
  className = '',
  triggerClassName = '',
  'aria-label': ariaLabel,
}: SelectSumulaProps) {
  const {
    aberto,
    destaque,
    containerRef,
    opcaoRefs,
    listaId,
    alternar,
    selecionar,
    setDestaque,
    onKeyDown,
  } = useListbox<string>({
    opcoes,
    value,
    onChange,
    disabled,
    id,
  });

  const selecionada = opcoes.find((o) => o.value === value);
  const rotulo = selecionada?.label ?? placeholder;
  const vazio = !selecionada || selecionada.value === '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        aria-activedescendant={
          aberto && opcoes[destaque] ? `${listaId}-opcao-${destaque}` : undefined
        }
        aria-label={ariaLabel}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={alternar}
        onKeyDown={onKeyDown}
        className={`select-sumula flex w-full min-h-[44px] items-center justify-between gap-2 rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-left text-base shadow-xs transition focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2 disabled:opacity-40 ${triggerClassName}`}
      >
        <span className={`min-w-0 truncate ${vazio ? 'text-giz-fraco' : 'text-giz'}`}>
          {rotulo}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-giz-fraco transition-transform ${aberto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {aberto && (
        <ul
          id={listaId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel ?? 'Opções'}
          className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-[4px] border border-borda bg-superficie p-1 shadow-carimbo scrollbar-sumula"
        >
          {opcoes.map((opcao, i) => {
            const selecionado = opcao.value === value;
            const emDestaque = i === destaque;
            return (
              <li
                key={`${opcao.value}-${i}`}
                id={`${listaId}-opcao-${i}`}
                ref={(el) => {
                  opcaoRefs.current[i] = el;
                }}
                role="option"
                aria-selected={selecionado}
                aria-disabled={opcao.disabled || undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selecionar(opcao);
                }}
                onMouseEnter={() => {
                  if (!opcao.disabled) setDestaque(i);
                }}
                className={`flex min-h-[44px] cursor-pointer items-center rounded-[3px] px-3 py-2 text-sm transition-colors ${
                  opcao.disabled
                    ? 'cursor-not-allowed text-giz-fraco/50'
                    : emDestaque
                      ? 'bg-superficie-2 text-giz'
                      : 'text-giz'
                } ${selecionado ? 'font-bold text-destaque bg-destaque/10' : ''}`}
              >
                <span className="truncate">{opcao.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
