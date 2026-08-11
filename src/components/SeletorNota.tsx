import { useEffect, useId, useRef, useState } from "react";

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
  variant?: "full" | "compact";
}

const NOTAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Dropdown acessível (combobox + listbox) para escolher nota de 1 a 10.
 * Estilizado com Tailwind + `var(--cor-destaque)` para acompanhar o tema.
 * Sem dependências externas.
 *
 * Teclado:
 *  - Enter / Espaço / ↓: abrir
 *  - ↑ / ↓: navegar entre opções
 *  - Home / End: primeira / última opção
 *  - Enter: selecionar
 *  - Esc: fechar sem selecionar
 */
export function SeletorNota({
  value,
  onChange,
  disabled = false,
  className = "",
  variant = "full",
}: SeletorNotaProps) {
  const compact = variant === "compact";
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState<number>(value ?? 5);
  const idBase = useId();
  const listaId = `${idBase}-lista`;
  const containerRef = useRef<HTMLDivElement>(null);
  const opcaoRefs = useRef<Array<HTMLLIElement | null>>([]);

  const definido = value !== undefined;

  // Quando abre, posiciona o destaque na nota atual (ou meio da escala).
  useEffect(() => {
    if (aberto) setDestaque(value ?? 5);
  }, [aberto, value]);

  // Rola até a opção em destaque.
  useEffect(() => {
    if (!aberto) return;
    const el = opcaoRefs.current[destaque - 1];
    el?.scrollIntoView({ block: "nearest" });
  }, [aberto, destaque]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [aberto]);

  function abrirSeFechado() {
    if (disabled || aberto) return;
    setAberto(true);
  }

  function selecionar(n: number) {
    onChange(n);
    setAberto(false);
  }

  function onKeyDownTrigger(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Enter":
      case " ":
        e.preventDefault();
        abrirSeFechado();
        break;
    }
  }

  function onKeyDownLista(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setDestaque((d) => Math.min(10, d + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setDestaque((d) => Math.max(1, d - 1));
        break;
      case "Home":
        e.preventDefault();
        setDestaque(1);
        break;
      case "End":
        e.preventDefault();
        setDestaque(10);
        break;
      case "Enter":
        e.preventDefault();
        selecionar(destaque);
        break;
      case "Escape":
        e.preventDefault();
        setAberto(false);
        break;
      case "Tab":
        setAberto(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        aria-label="Selecionar nota"
        disabled={disabled}
        onClick={() => (aberto ? setAberto(false) : abrirSeFechado())}
        onKeyDown={onKeyDownTrigger}
        className={`flex items-center justify-between rounded-lg border border-neutral-300 bg-white text-left text-sm dark:border-neutral-700 dark:bg-neutral-900 disabled:opacity-40 ${
          compact
            ? "min-h-[2.5rem] w-24 px-2.5"
            : "min-h-[2.75rem] w-full px-3"
        }`}
      >
        <span
          className={
            definido
              ? "font-bold text-[var(--cor-destaque)]"
              : "text-neutral-400 dark:text-neutral-500"
          }
        >
          {definido ? value : "Selecionar nota"}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-neutral-400 transition-transform ${aberto ? "rotate-180" : ""}`}
        >
          <path
            fill="currentColor"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
          />
        </svg>
      </button>

      {aberto && (
        <ul
          id={listaId}
          role="listbox"
          tabIndex={-1}
          aria-label="Notas de 1 a 10"
          onKeyDown={onKeyDownLista}
          className={`absolute z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 ${
            compact
              ? "right-0 min-w-[11rem] sm:left-0 sm:right-auto"
              : "w-full"
          }`}
        >
          {NOTAS.map((n) => {
            const selecionado = n === value;
            const emDestaque = n === destaque;
            return (
              <li
                key={n}
                ref={(el) => {
                  opcaoRefs.current[n - 1] = el;
                }}
                role="option"
                aria-selected={selecionado}
                onMouseDown={(e) => {
                  e.preventDefault(); // mantém foco no botão/lista
                  selecionar(n);
                }}
                onMouseEnter={() => setDestaque(n)}
                className={`flex min-h-[2.75rem] cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm ${
                  emDestaque ? "bg-neutral-100 dark:bg-neutral-800" : ""
                } ${
                  selecionado
                    ? "font-bold text-[var(--cor-destaque)]"
                    : "text-neutral-700 dark:text-neutral-300"
                }`}
              >
                <span>{n}</span>
                {selecionado && (
                  <span aria-hidden="true" className="text-xs">
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
