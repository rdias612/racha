import { labelTipoDivida, type TipoDivida } from '../../lib/dividas';

const COR_TIPO: Record<TipoDivida, string> = {
  mensalidade: 'bg-destaque/15 text-destaque-texto border-destaque/40',
  avulso: 'bg-ok/15 text-ok border-ok/40',
  goleiro: 'bg-campo/20 text-giz border-borda',
  campo: 'bg-superficie-2 text-giz border-borda',
  eventos: 'bg-destaque/10 text-destaque-texto border-destaque/30',
  outro: 'bg-superficie-2 text-giz-fraco border-borda',
};

export interface ChipTipoLancamentoProps {
  tipo: TipoDivida;
}

export function ChipTipoLancamento({ tipo }: ChipTipoLancamentoProps) {
  return (
    <span
      className={`rounded-[2px] border px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider font-bold ${COR_TIPO[tipo]}`}
    >
      {labelTipoDivida(tipo)}
    </span>
  );
}
