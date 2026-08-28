import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { vibrateLight } from '../lib/haptics';

export interface ListboxOpcao<T> {
  value: T;
  label?: string;
  disabled?: boolean;
}

export interface UseListboxOptions<T> {
  /** Lista de opções disponíveis */
  opcoes: Array<ListboxOpcao<T>>;
  /** Valor atualmente selecionado (ou undefined se nada selecionado) */
  value: T | undefined;
  /** Callback disparado ao selecionar uma opção válida */
  onChange: (value: T) => void;
  /** Se o listbox está desabilitado */
  disabled?: boolean;
  /** ID customizado para a lista (opcional, gera useId por padrão) */
  id?: string;
  /** Índice de fallback para destaque inicial quando value for indefinido ou não encontrado */
  indicePadrao?: number;
}

export interface UseListboxReturn<T> {
  aberto: boolean;
  destaque: number;
  containerRef: RefObject<HTMLDivElement | null>;
  opcaoRefs: React.MutableRefObject<Array<HTMLLIElement | null>>;
  listaId: string;
  abrir: () => void;
  fechar: () => void;
  alternar: () => void;
  selecionar: (opcao: ListboxOpcao<T>) => void;
  setDestaque: (indice: number) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * Hook de controle de listbox/combobox acessível:
 * - Gerenciamento de estado (aberto, destaque, listaId);
 * - Auto-scroll para a opção em destaque (`scrollIntoView`);
 * - Fechamento ao clicar fora (`mousedown`);
 * - Navegação completa por teclado (ArrowDown, ArrowUp com wrap e filtro de desabilitados, Home, End, Enter, Space, Escape, Tab);
 * - Feedback háptico tátil (`vibrateLight`) ao abrir e selecionar.
 */
export function useListbox<T>({
  opcoes,
  value,
  onChange,
  disabled = false,
  id,
  indicePadrao = 0,
}: UseListboxOptions<T>): UseListboxReturn<T> {
  const [aberto, setAberto] = useState(false);
  const idBase = useId();
  const listaId = id ? `${id}-lista` : `${idBase}-lista`;
  const containerRef = useRef<HTMLDivElement>(null);
  const opcaoRefs = useRef<Array<HTMLLIElement | null>>([]);

  const indiceAtual = opcoes.findIndex((o) => o.value === value);
  const [destaque, setDestaque] = useState<number>(indiceAtual >= 0 ? indiceAtual : indicePadrao);

  useEffect(() => {
    if (!aberto) return;
    const proximoDestaque = indiceAtual >= 0 ? indiceAtual : indicePadrao;
    setDestaque(proximoDestaque);
  }, [aberto, indiceAtual, indicePadrao]);

  useEffect(() => {
    if (!aberto) return;
    opcaoRefs.current[destaque]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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

  function fechar() {
    setAberto(false);
  }

  function alternar() {
    if (aberto) {
      fechar();
    } else {
      abrir();
    }
  }

  function selecionar(opcao: ListboxOpcao<T>) {
    if (disabled || opcao.disabled) return;
    vibrateLight();
    onChange(opcao.value);
    setAberto(false);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    const habilitadas = opcoes.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);

    function mover(delta: number) {
      if (habilitadas.length === 0) return;
      const pos = habilitadas.findIndex(({ i }) => i === destaque);
      const base = pos < 0 ? 0 : pos;
      const next = habilitadas[(base + delta + habilitadas.length) % habilitadas.length];
      if (next) setDestaque(next.i);
    }

    if (!aberto) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrir();
      }
      return;
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
      case ' ':
        e.preventDefault();
        if (opcoes[destaque] && !opcoes[destaque].disabled) {
          selecionar(opcoes[destaque]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        fechar();
        break;
      case 'Tab':
        fechar();
        break;
    }
  }

  return {
    aberto,
    destaque,
    containerRef,
    opcaoRefs,
    listaId,
    abrir,
    fechar,
    alternar,
    selecionar,
    setDestaque,
    onKeyDown,
  };
}
