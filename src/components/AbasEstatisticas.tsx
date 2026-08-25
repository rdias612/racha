import { NavLink } from 'react-router-dom';
import { preCarregarRota } from '../lib/rotas';

const ABAS = [
  { to: '/estatisticas/jogador', label: 'Jogador' },
  { to: '/estatisticas/racha', label: 'Racha' },
  { to: '/estatisticas/comparar', label: 'Comparar' },
] as const;

export interface AbasEstatisticasProps {
  /** Classes CSS adicionais para o contêiner de navegação */
  className?: string;
}

/**
 * Barra de abas unificada do módulo de estatísticas (Jogador, Racha, Comparar).
 * Inclui prefetch antecipado de chunks JS, alvo de toque acessível (min-h-[44px])
 * e estilos semânticos do Design System.
 */
export function AbasEstatisticas({ className = '' }: AbasEstatisticasProps) {
  return (
    <nav
      aria-label="Abas de estatísticas"
      className={`flex gap-1 overflow-x-auto rounded-[4px] border border-borda bg-superficie p-1 shadow-xs ${className}`}
    >
      {ABAS.map((aba) => (
        <NavLink
          key={aba.to}
          to={aba.to}
          onTouchStart={() => preCarregarRota(aba.to)}
          onMouseEnter={() => preCarregarRota(aba.to)}
          onFocus={() => preCarregarRota(aba.to)}
          className={({ isActive }) =>
            `flex-1 min-w-max rounded-[3px] px-3 py-1.5 text-center font-display font-bold uppercase tracking-wider text-xs whitespace-nowrap transition min-h-[44px] flex items-center justify-center ${
              isActive
                ? 'bg-destaque text-destaque-tinta shadow-xs'
                : 'text-giz-fraco hover:text-giz hover:bg-superficie-2'
            }`
          }
        >
          {aba.label}
        </NavLink>
      ))}
    </nav>
  );
}
