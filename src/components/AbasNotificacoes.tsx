import { NavLink } from 'react-router-dom';
import { preCarregarRota } from '../lib/rotas';

const ABAS = [
  { to: '/notificacoes/confirmacao', label: '1. Confirmação' },
  { to: '/notificacoes/votacao', label: '2. Votação' },
  { to: '/notificacoes/testes', label: '3. Testes' },
  { to: '/notificacoes/saude', label: '4. Saúde' },
] as const;

export interface AbasNotificacoesProps {
  className?: string;
}

export function AbasNotificacoes({ className = '' }: AbasNotificacoesProps) {
  return (
    <nav
      aria-label="Abas de notificações"
      className={`flex gap-1 overflow-x-auto rounded-[4px] border border-borda bg-superficie p-1 shadow-xs no-scrollbar ${className}`}
    >
      {ABAS.map((aba) => (
        <NavLink
          key={aba.to}
          to={aba.to}
          onTouchStart={() => preCarregarRota(aba.to)}
          onMouseEnter={() => preCarregarRota(aba.to)}
          onFocus={() => preCarregarRota(aba.to)}
          className={({ isActive }) =>
            `flex-1 min-w-max rounded-[3px] px-3 py-1.5 text-center font-display font-bold uppercase tracking-wider text-xs whitespace-nowrap transition min-h-[44px] flex items-center justify-center cursor-pointer ${
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
