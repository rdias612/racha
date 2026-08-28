import { Check, Copy } from 'lucide-react';
import { Badge } from './Badge';
import { MensagemEstado } from './Estado';
import { COR_TIPO } from './ListaReceitasAbertas';
import { labelTipoDivida, type Divida } from '../lib/dividas';
import { formatarReais, formatarDataLista } from '../lib/formatacao';

export interface ListaDespesasAbertasProps {
  despesas: Divida[];
  carregando: boolean;
  onNotificar: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
  onSolicitarQuitar: (dividaId: number, rotulo: string) => void;
}

export function ListaDespesasAbertas({
  despesas,
  carregando,
  onNotificar,
  onSolicitarQuitar,
}: ListaDespesasAbertasProps) {
  const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between sumula-header pb-1.5">
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
          Despesas em aberto
        </h3>
        <span className="font-mono text-base font-bold text-perigo tabular-nums">
          {formatarReais(totalDespesas)}
        </span>
      </div>

      {!carregando && despesas.length === 0 ? (
        <MensagemEstado tipo="info">Nenhuma despesa pendente no caixa.</MensagemEstado>
      ) : despesas.length > 0 ? (
        <ul className="divide-y divide-borda/40 border-y border-borda bg-superficie">
          {despesas.map((d) => {
            const rotulo =
              d.jogadores?.username != null
                ? `@${d.jogadores.username}`
                : d.jogador_id != null
                  ? `#${d.jogador_id}`
                  : 'Caixa do racha';
            return (
              <li key={d.id} className="flex items-start gap-2 px-3 py-2.5 min-h-[44px]">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variante="perigo">Despesa</Badge>
                    <span
                      className={`rounded-[2px] border px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider font-bold ${COR_TIPO[d.tipo]}`}
                    >
                      {labelTipoDivida(d.tipo)}
                    </span>
                    {d.referencia && (
                      <span className="text-[11px] font-mono text-giz-fraco">
                        ref. {d.referencia}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-giz-fraco">
                      {formatarDataLista(d.data_divida)}
                    </span>
                  </div>
                  <p className="text-sm font-display font-bold uppercase tracking-wide text-giz">
                    {rotulo}
                  </p>
                  {d.descricao && <p className="text-xs text-giz-fraco">{d.descricao}</p>}

                  {d.jogadores?.chave_pix ? (
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      <span className="text-[11px] font-mono text-giz bg-superficie-2 border border-borda px-2 py-1 rounded-[2px] truncate max-w-[180px] sm:max-w-xs">
                        PIX: {d.jogadores.chave_pix}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const chave = d.jogadores?.chave_pix;
                          if (!chave) return;
                          navigator.clipboard
                            .writeText(chave)
                            .then(() => {
                              onNotificar('sucesso', 'Chave PIX copiada!');
                            })
                            .catch(() => {
                              onNotificar('erro', 'Não foi possível copiar a chave PIX.');
                            });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-mono text-destaque-texto hover:underline min-h-[44px] px-2 py-1 active:translate-y-px transition focus-visible:outline-2 focus-visible:outline-destaque-texto"
                      >
                        <Copy className="size-3.5" />
                        <span>Copiar PIX</span>
                      </button>
                    </div>
                  ) : d.tipo === 'goleiro' ? (
                    <p className="text-[11px] font-mono text-giz-fraco italic pt-0.5">
                      Chave PIX não cadastrada
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-mono text-sm font-bold text-perigo tabular-nums">
                    −{formatarReais(Number(d.valor))}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSolicitarQuitar(d.id, d.jogadores?.username ?? 'caixa');
                    }}
                    className="min-h-[44px] flex items-center gap-1 rounded-[3px] border border-borda bg-superficie-2 px-3 py-1.5 text-xs font-display uppercase tracking-wider font-bold text-giz hover:border-perigo hover:text-perigo transition"
                  >
                    <Check className="size-3.5" />
                    Pagar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
