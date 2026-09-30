import { Badge } from '../Badge';
import { ChipTipoLancamento } from './ChipTipoLancamento';
import { formatarDataLista } from '../../lib/formatacao';
import { type NaturezaLancamento, type TipoDivida } from '../../lib/dividas';

export interface LinhaMetaLancamentoProps {
  natureza: NaturezaLancamento;
  tipo: TipoDivida;
  referencia: string | null;
  data: string;
}

export function LinhaMetaLancamento({
  natureza,
  tipo,
  referencia,
  data,
}: LinhaMetaLancamentoProps) {
  const isReceita = natureza === 'receita';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variante={isReceita ? 'ok' : 'perigo'}>
        {isReceita ? 'Receita' : 'Despesa'}
      </Badge>
      <ChipTipoLancamento tipo={tipo} />
      {referencia && (
        <span className="text-[11px] font-mono text-giz-fraco">
          ref. {referencia}
        </span>
      )}
      <span className="text-[11px] font-mono text-giz-fraco">
        {formatarDataLista(data)}
      </span>
    </div>
  );
}
