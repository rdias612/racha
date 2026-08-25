import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { vibrateLight } from '../lib/haptics';

export interface SelectSumulaOpcao {
  value: string;
  label: string;
  disabled?: boolean;
}

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
  id,
  className = '',
  triggerClassName = '',
  'aria-label': ariaLabel,
}: SelectSumulaProps) {
  const [aberto, setAberto] = useState(false);
  const idBase = useId();
  const listaId = `${idBase}-lista`;
  const containerRef = useRef<HTMLDivElement>(null);
  const opcaoRefs = useRef<Array<HTMLLIElement | null>>([]);

  const indiceAtual = Math.max(
    0,
    opcoes.findIndex((o) => o.value === value)
  );
  const [destaque, setDestaque] = useState(indiceAtual);

  const selecionada = opcoes.find((o) => o.value === value);
  const rotulo = selecionada?.label ?? placeholder;
  const vazio = !selecionada || selecionada.value === '';

  useEffect(() => {
    if (!aberto) return;
    setDestaque(indiceAtual);
  }, [aberto, indiceAtual]);

  useEffect(() => {
    if (!aberto) return;
    opcaoRefs.current[destaque]?.scrollIntoView({ block: 'nearest' });
  }, [aberto, destaque]);

  useEffect(() => {
    if (!aberto) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [aberto]);

  function abrir() {
    if (disabled || aberto) return;
    vibrateLight();
    setAberto(true);
  }

  function selecionar(opcao: SelectSumulaOpcao) {
    if (opcao.disabled) return;
    vibrateLight();
    onChange(opcao.value);
    setAberto(false);
  }

  function onKeyDownTrigger(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        e.preventDefault();
        abrir();
        break;
    }
  }

  function onKeyDownLista(e: KeyboardEvent) {
    const habilitadas = opcoes
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !o.disabled);

    function mover(delta: number) {
      const pos = habilitadas.findIndex(({ i }) => i === destaque);
      const base = pos < 0 ? 0 : pos;
      const next = habilitadas[(base + delta + habilitadas.length) % habilitadas.length];
      if (next) setDestaque(next.i);
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        mover(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        mover(-1);
        break;
      case 'Home':
        e.preventDefault();
        if (habilitadas[0]) setDestaque(habilitadas[0].i);
        break;
      case 'End':
        e.preventDefault();
        if (habilitadas.length > 0) setDestaque(habilitadas[habilitadas.length - 1].i);
        break;
      case 'Enter':
        e.preventDefault();
        if (opcoes[destaque]) selecionar(opcoes[destaque]);
        break;
      case 'Escape':
        e.preventDefault();
        setAberto(false);
        break;
      case 'Tab':
        setAberto(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={onKeyDownTrigger}
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
          onKeyDown={onKeyDownLista}
          className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-[4px] border border-borda bg-superficie p-1 shadow-carimbo scrollbar-sumula"
        >
          {opcoes.map((opcao, i) => {
            const selecionado = opcao.value === value;
            const emDestaque = i === destaque;
            return (
              <li
                key={`${opcao.value}-${i}`}
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
