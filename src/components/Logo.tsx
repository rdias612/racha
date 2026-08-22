interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  mostrarTexto?: boolean;
  className?: string;
}

const ICON_SIZES = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

const TEXT_SIZES = {
  sm: 'text-sm font-black',
  md: 'text-base font-black',
  lg: 'text-2xl font-black',
};

export function Logo({ size = 'md', mostrarTexto = true, className = '' }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Escudo Partido Duotônico Preto vs Branco com Estrela Âmbar */}
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${ICON_SIZES[size]} shrink-0`}
      >
        {/* Base do Escudo */}
        <path
          d="M18 3L5 7.5V17.5C5 25.5 10.5 31.5 18 33.5C25.5 31.5 31 25.5 31 17.5V7.5L18 3Z"
          fill="#1b1814"
          stroke="#ffb300"
          strokeWidth="1.5"
        />
        {/* Metade Esquerda: Preto */}
        <path d="M18 3.5L5.5 7.8V17.5C5.5 25 10.7 30.7 18 32.7V3.5Z" fill="#0d0d0e" />
        {/* Metade Direita: Branco / Giz */}
        <path d="M18 3.5L30.5 7.8V17.5C30.5 25 25.3 30.7 18 32.7V3.5Z" fill="#f4f1e8" />
        {/* Divisória central */}
        <line x1="18" y1="3" x2="18" y2="33" stroke="#35302a" strokeWidth="1" />
        {/* Círculo central com estrela âmbar */}
        <circle cx="18" cy="18" r="5" fill="#12100d" stroke="#ffb300" strokeWidth="1" />
        <polygon
          points="18,14.8 19.1,17.2 21.6,17.5 19.8,19.3 20.3,21.8 18,20.6 15.7,21.8 16.2,19.3 14.4,17.5 16.9,17.2"
          fill="#ffb300"
        />
      </svg>

      {mostrarTexto && (
        <div className="flex flex-col leading-none">
          <span className={`font-display uppercase tracking-[0.08em] text-giz ${TEXT_SIZES[size]}`}>
            RACHA <span className="text-destaque">GRAGOATÁ</span>
          </span>
          <span className="text-[9px] font-mono uppercase tracking-widest text-giz-fraco">
            Súmula CBO
          </span>
        </div>
      )}
    </div>
  );
}
