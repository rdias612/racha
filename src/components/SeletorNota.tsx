import { ChevronDown } from 'lucide-react';
import { useListbox, type ListboxOpcao } from '../hooks/useListbox';

interface SeletorNotaProps {
  /** Nota atual (1-10). `undefined` = ainda não avaliado. */
  value: number | undefined;
  /** Chamado quando o usuário escolhe uma nota. */
  onChange: (nota: number) => void;
  disabled?: boolean;
  className?: string;
  /**
   * `full` (padrão): ocupa toda a largura disponível, ideal em coluna única.
   * `compact`: gatilho estreito (w-24) para caber ao lado do nome do jogador
   * numa linha; o popup do listbox recebe largura mínima e âncora à direita
   * para não ultrapassar a viewport no celular.
   */
  variant?: 'full' | 'compact';
}

const OPCOES_NOTAS: Array<ListboxOpcao<number>> = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
  value: n,
  label: String(n),
}));

/**
 * Dropdown acessível (combobox + listbox) para escolher nota de 1 a 10.
 * Estilizado com tokens da Súmula de Quinta e feedback tátil (haptics).
 */
export function SeletorNota({
  value,
  onChange,
  disabled = false,
  className = '',
  variant = 'full',
}: SeletorNotaProps) {
  const compact = variant === 'compact';
  const definido = value !== undefined;

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
  } = useListbox<number>({
    opcoes: OPCOES_NOTAS,
    value,
    onChange,
    disabled,
    indicePadrao: 4, // Nota 5 (índice 4) como destaque inicial quando value for undefined
  });

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        aria-activedescendant={
          aberto && OPCOES_NOTAS[destaque] ? `${listaId}-opcao-${destaque}` : undefined
        }
        aria-label="Selecionar nota"
        disabled={disabled}
        onClick={alternar}
        onKeyDown={onKeyDown}
        className={`flex items-center justify-between rounded-[4px] border border-borda bg-superficie text-left text-sm disabled:opacity-40 shadow-xs transition focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2 ${
          compact ? 'min-h-[44px] w-24 px-3' : 'min-h-[44px] w-full px-3'
        }`}
      >
        <span
          className={
            definido ? 'font-mono font-bold text-destaque text-base' : 'text-giz-fraco text-xs'
          }
        >
          {definido ? value : 'Nota'}
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
          aria-label="Notas de 1 a 10"
          className={`absolute z-30 mt-1 max-h-64 overflow-auto rounded-[4px] border border-borda bg-superficie p-1 shadow-carimbo-preto scrollbar-sumula ${
            compact ? 'right-0 min-w-[11rem] sm:left-0 sm:right-auto' : 'w-full'
          }`}
        >
          {OPCOES_NOTAS.map((opcao, i) => {
            const selecionado = opcao.value === value;
            const emDestaque = i === destaque;
            return (
              <li
                key={opcao.value}
                id={`${listaId}-opcao-${i}`}
                ref={(el) => {
                  opcaoRefs.current[i] = el;
                }}
                role="option"
                aria-selected={selecionado}
                onMouseDown={(e) => {
                  e.preventDefault(); // mantém foco no botão
                  selecionar(opcao);
                }}
                onMouseEnter={() => setDestaque(i)}
                className={`flex min-h-[44px] cursor-pointer items-center justify-between rounded-[3px] px-3 py-2 text-sm font-mono ${
                  emDestaque ? 'bg-superficie-2 text-giz' : ''
                } ${selecionado ? 'font-bold text-destaque bg-destaque/10' : 'text-giz-fraco'}`}
              >
                <span>{opcao.value}</span>
                {selecionado && (
                  <span aria-hidden="true" className="text-xs font-bold text-destaque">
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
