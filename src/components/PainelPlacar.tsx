export interface PainelPlacarProps {
  golsTimeA?: number | null;
  golsTimeB?: number | null;
  status?: 'draft' | 'published' | 'live' | 'closed';
  variante?: 'completo' | 'compacto' | 'edicao';
  jogadoresTimeA?: number;
  jogadoresTimeB?: number;
  className?: string;
}

/**
 * Painel de Placar LED com suporte às variantes 'completo' (súmula), 'compacto' (mural) e 'edicao'.
 * Utiliza tokens semânticos (`bg-led-fundo`, `bg-preto-time`, `bg-branco-time`, `text-destaque`).
 */
export function PainelPlacar({
  golsTimeA = 0,
  golsTimeB = 0,
  status = 'published',
  variante = 'completo',
  jogadoresTimeA,
  jogadoresTimeB,
  className = '',
}: PainelPlacarProps) {
  const isDraft = status === 'draft';
  const isLive = status === 'live';
  const isClosed = status === 'closed';

  const placarA = isDraft || golsTimeA === null || golsTimeA === undefined ? 0 : golsTimeA;
  const placarB = isDraft || golsTimeB === null || golsTimeB === undefined ? 0 : golsTimeB;

  if (variante === 'compacto') {
    return (
      <div className={`bg-led-fundo p-3 text-center ${className}`}>
        <div className="flex items-center justify-between gap-2 max-w-sm mx-auto">
          {/* Time Preto */}
          <div className="flex-1 flex items-center justify-end gap-2 text-right">
            <span className="font-display font-black text-sm uppercase tracking-wider text-branco-time">
              PRETO
            </span>
            <span className="size-2 rounded-full bg-preto-time border border-led-borda shrink-0" />
          </div>

          {/* Dígitos de LED */}
          <div className="px-3 py-1 min-w-[90px]">
            <span
              className={`font-display font-black text-3xl tabular-nums tracking-tight ${
                isLive
                  ? 'text-destaque [text-shadow:0_0_10px_rgba(255,179,0,0.5)]'
                  : isClosed
                    ? 'text-branco-time'
                    : 'text-destaque'
              }`}
            >
              {isDraft || golsTimeA === null || golsTimeA === undefined
                ? '— × —'
                : `${placarA} × ${placarB}`}
            </span>
          </div>

          {/* Time Branco */}
          <div className="flex-1 flex items-center justify-start gap-2 text-left">
            <span className="size-2 rounded-full bg-branco-time border border-led-borda shrink-0" />
            <span className="font-display font-black text-sm uppercase tracking-wider text-branco-time">
              BRANCO
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variante === 'edicao') {
    return (
      <div
        className={`flex items-center justify-between rounded-[4px] bg-led-fundo border border-borda p-3 ${className}`}
      >
        {/* Time Preto */}
        <div className="flex items-center gap-2 flex-1">
          <span className="w-3.5 h-3.5 rounded-[2px] bg-preto-time border border-led-borda shadow-xs shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-display font-bold uppercase tracking-wider text-branco-time truncate">
              Preto
            </p>
            {typeof jogadoresTimeA === 'number' && (
              <p className="text-[10px] font-mono text-giz-fraco">{jogadoresTimeA} jogadores</p>
            )}
          </div>
        </div>

        {/* Números do Placar */}
        <div className="px-4 py-1 flex items-center gap-2 text-2xl sm:text-3xl font-display font-black tabular-nums text-destaque">
          <span>{placarA}</span>
          <span className="text-sm font-normal text-giz-fraco">×</span>
          <span>{placarB}</span>
        </div>

        {/* Time Branco */}
        <div className="flex items-center justify-end gap-2 flex-1 text-right">
          <div className="min-w-0">
            <p className="text-xs font-display font-bold uppercase tracking-wider text-branco-time truncate">
              Branco
            </p>
            {typeof jogadoresTimeB === 'number' && (
              <p className="text-[10px] font-mono text-giz-fraco">{jogadoresTimeB} jogadores</p>
            )}
          </div>
          <span className="w-3.5 h-3.5 rounded-[2px] bg-branco-time border border-borda shadow-xs shrink-0" />
        </div>
      </div>
    );
  }

  // variante === 'completo' (PartidaDetalhe)
  return (
    <div
      className={`rounded-[4px] overflow-hidden border-2 border-borda bg-led-fundo shadow-carimbo-preto ${className}`}
    >
      <div className="flex items-stretch">
        {/* Bloco Lateral: Time Preto */}
        <div className="flex-1 py-3 px-2.5 text-center border-r border-led-borda flex flex-col items-center justify-center bg-preto-time text-branco-time">
          <span className="font-display font-bold text-[10px] uppercase tracking-wider text-giz-fraco">
            TIME
          </span>
          <span className="font-display font-black text-sm sm:text-base uppercase tracking-widest text-branco-time">
            PRETO
          </span>
        </div>

        {/* Centro: LED Placar */}
        <div className="px-4 sm:px-8 py-3 flex flex-col items-center justify-center bg-led-fundo min-w-[130px]">
          <span
            className={`text-5xl sm:text-6xl font-display font-black tabular-nums tracking-tight leading-none ${
              isLive
                ? 'text-destaque [text-shadow:0_0_14px_rgba(255,179,0,0.55)]'
                : isClosed
                  ? 'text-branco-time'
                  : 'text-destaque'
            }`}
          >
            {placarA} <span className="text-giz-fraco/50 font-normal">×</span> {placarB}
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 text-[9px] font-display font-bold uppercase tracking-widest text-destaque animate-pulse mt-1">
              <span className="size-1.5 rounded-full bg-destaque" /> AO VIVO
            </span>
          )}
        </div>

        {/* Bloco Lateral: Time Branco */}
        <div className="flex-1 py-3 px-2.5 text-center border-l border-led-borda flex flex-col items-center justify-center bg-branco-time text-preto-time">
          <span className="font-display font-bold text-[10px] uppercase tracking-wider text-neutral-600">
            TIME
          </span>
          <span className="font-display font-black text-sm sm:text-base uppercase tracking-widest text-preto-time">
            BRANCO
          </span>
        </div>
      </div>
    </div>
  );
}
