export interface StepperBoxProps {
  icone: string;
  label: string;
  valor: number;
  corAtiva: 'destaque' | 'azul' | 'perigo';
  disabled?: boolean;
  onMenos: () => void;
  onMais: () => void;
}

// Contador tátil em formato de card com alvos de 44px (movido de PartidaEditar)
export function StepperBox({
  icone,
  label,
  valor,
  corAtiva,
  disabled,
  onMenos,
  onMais,
}: StepperBoxProps) {
  const ativo = valor > 0;

  const bgStyle = ativo
    ? corAtiva === 'destaque'
      ? 'bg-destaque/10 border-destaque/60 text-destaque-texto'
      : corAtiva === 'azul'
        ? 'bg-superficie-2 border-destaque text-giz'
        : 'bg-perigo/10 border-perigo/60 text-perigo'
    : 'bg-superficie-2 border-borda text-giz-fraco';

  const numColor = ativo
    ? corAtiva === 'destaque'
      ? 'text-destaque-texto font-bold'
      : corAtiva === 'azul'
        ? 'text-giz font-bold'
        : 'text-perigo font-bold'
    : 'text-giz';

  return (
    <div
      className={`rounded-[4px] border p-2 flex flex-col items-center justify-between transition ${bgStyle}`}
    >
      <div className="flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider text-giz-fraco mb-1">
        <span>{icone}</span>
        <span>{label}</span>
      </div>

      <div className="w-full flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onMenos}
          disabled={disabled || valor === 0}
          aria-label={`Diminuir ${label}`}
          className="min-h-[44px] min-w-[44px] rounded-[3px] border border-borda bg-superficie text-giz text-sm font-bold flex items-center justify-center disabled:opacity-20 active:translate-y-px transition shadow-carimbo cursor-pointer"
        >
          −
        </button>

        <span className={`text-base font-mono font-black tabular-nums ${numColor}`}>{valor}</span>

        <button
          type="button"
          onClick={onMais}
          disabled={disabled}
          aria-label={`Aumentar ${label}`}
          className={`min-h-[44px] min-w-[44px] rounded-[3px] text-sm font-bold flex items-center justify-center active:translate-y-px transition shadow-carimbo cursor-pointer ${
            corAtiva === 'destaque'
              ? 'bg-destaque text-destaque-tinta hover:brightness-105 border border-destaque'
              : corAtiva === 'azul'
                ? 'bg-superficie text-giz hover:bg-superficie-2 border border-borda'
                : 'bg-perigo text-branco-time hover:bg-perigo/90 border border-perigo'
          } disabled:opacity-30`}
        >
          +
        </button>
      </div>
    </div>
  );
}
