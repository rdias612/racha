import type { ReactNode } from 'react';

export interface CabecalhoSumulaProps {
  titulo: string;
  /** Linha mono abaixo do título (maioria das rotas). Texto puro usa o estilo canônico; ReactNode é repassado intacto. */
  kicker?: ReactNode;
  /** Ícone à esquerda do título (ex.: <Bell className="size-5 text-destaque-texto" />). */
  icone?: ReactNode;
  /** Slot à direita: meta de texto, contador, CTA-Link, Badge, countdown. Texto puro usa o estilo canônico de meta. */
  acao?: ReactNode;
  /** sm = text-sm (seções) · md = text-xl (padrão) · lg = text-2xl (caso Resumo). */
  tamanho?: 'sm' | 'md' | 'lg';
  /** Tag do heading. Padrão 'h2'. Resumo usa 'h1'. */
  nivel?: 'h1' | 'h2' | 'h3';
  /** Escape para ajustes pontuais no container (alinhamento, margens, borda). */
  className?: string;
}

const CLASSES_MONO_PEQUENO = 'text-[10px] font-mono uppercase tracking-widest text-giz-fraco';

const TAMANHO_TITULO: Record<NonNullable<CabecalhoSumulaProps['tamanho']>, string> = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-2xl',
};

export function CabecalhoSumula({
  titulo,
  kicker,
  icone,
  acao,
  tamanho = 'md',
  nivel: Tag = 'h2',
  className,
}: CabecalhoSumulaProps) {
  return (
    <div className={`flex items-baseline justify-between sumula-header pb-2 ${className ?? ''}`}>
      <div className="flex-1">
        <Tag
          className={`font-display font-bold uppercase tracking-wider text-giz ${TAMANHO_TITULO[tamanho]} ${
            icone ? 'flex items-center gap-2' : ''
          }`}
        >
          {icone}
          {titulo}
        </Tag>
        {kicker &&
          (typeof kicker === 'string' ? <p className={CLASSES_MONO_PEQUENO}>{kicker}</p> : kicker)}
      </div>
      {acao &&
        (typeof acao === 'string' ? <span className={CLASSES_MONO_PEQUENO}>{acao}</span> : acao)}
    </div>
  );
}
