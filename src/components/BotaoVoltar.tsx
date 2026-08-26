import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { voltar } from '../lib/navegacao';

export interface BotaoVoltarProps {
  /** Rota de fallback caso não haja histórico de navegação (padrão: '/') */
  fallback?: string;
  /** Rótulo textual do botão (padrão: 'voltar') */
  label?: string;
  /** Conteúdo customizado (sobrepõe label se fornecido) */
  children?: ReactNode;
  /** Handler de clique customizado. Se omitido, executa `voltar(navigate, fallback)` */
  onClick?: () => void;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Botão de retorno padronizado para telas e fluxos.
 * Garante alvo de toque acessível (min-h-[44px]), ícone consistente,
 * navegação defensiva para deep-links e foco visível acessível.
 */
export function BotaoVoltar({
  fallback = '/',
  label = 'voltar',
  children,
  onClick,
  className = '',
}: BotaoVoltarProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      voltar(navigate, fallback);
    }
  };

  const conteudo = children ?? label;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-xs font-mono text-giz-fraco hover:text-giz transition min-h-[44px] -ml-1 px-1 rounded-[2px] cursor-pointer focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2 ${className}`}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      <span>{conteudo}</span>
    </button>
  );
}
