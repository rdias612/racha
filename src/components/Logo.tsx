interface LogoProps {
  size?: "sm" | "md" | "lg";
  mostrarTexto?: boolean;
  className?: string;
}

const ICON_SIZES = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

const TEXT_SIZES = {
  sm: "text-sm font-bold",
  md: "text-base font-extrabold",
  lg: "text-xl sm:text-2xl font-black",
};

export function Logo({
  size = "md",
  mostrarTexto = true,
  className = "",
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Escudo / Marca Vetorial */}
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${ICON_SIZES[size]} shrink-0`}
      >
        {/* Escudo de fundo */}
        <path
          d="M18 2L4 7V17C4 25.5 10 32.5 18 34C26 32.5 32 25.5 32 17V7L18 2Z"
          className="fill-green-600 dark:fill-green-500 stroke-green-700 dark:stroke-green-400"
          strokeWidth="1.5"
        />
        {/* Detalhe de campo / linhas diagonais */}
        <path
          d="M18 6V30M9 13.5H27"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Círculo central (bola) */}
        <circle
          cx="18"
          cy="18"
          r="4.5"
          className="fill-amber-400 stroke-amber-500"
          strokeWidth="1"
        />
      </svg>

      {mostrarTexto && (
        <span
          className={`tracking-tight text-neutral-900 dark:text-neutral-100 ${TEXT_SIZES[size]}`}
        >
          Racha <span className="text-green-600 dark:text-green-400">Gragoatá</span>
        </span>
      )}
    </div>
  );
}
