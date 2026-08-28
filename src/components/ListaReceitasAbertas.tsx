import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, MessageSquare } from 'lucide-react';
import { Badge } from './Badge';
import { Carregando, MensagemEstado } from './Estado';
import {
  labelTipoDivida,
  montarLembreteWhatsApp,
  type DividaPorJogador,
  type TipoDivida,
} from '../lib/dividas';
import { formatarReais, formatarDataLista } from '../lib/formatacao';

// Mapa de cores por tipo de lançamento (compartilhado com ListaDespesasAbertas)
export const COR_TIPO: Record<TipoDivida, string> = {
  mensalidade: 'bg-destaque/15 text-destaque-texto border-destaque/40',
  avulso: 'bg-ok/15 text-ok border-ok/40',
  goleiro: 'bg-campo/20 text-giz border-borda',
  campo: 'bg-superficie-2 text-giz border-borda',
  eventos: 'bg-destaque/10 text-destaque-texto border-destaque/30',
  outro: 'bg-superficie-2 text-giz-fraco border-borda',
};

export interface ListaReceitasAbertasProps {
  grupos: DividaPorJogador[];
  carregando: boolean;
  onNotificar: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
  onSolicitarQuitar: (dividaId: number, username: string) => void;
  onSolicitarQuitarTodas: (jogadorId: number, username: string) => void;
}

export function ListaReceitasAbertas({
  grupos,
  carregando,
  onNotificar,
  onSolicitarQuitar,
  onSolicitarQuitarTodas,
}: ListaReceitasAbertasProps) {
  // Estado de UI pura (expansão de grupos): interno para não re-renderizar a rota.
  const [expandido, setExpandido] = useState<number | null>(null);

  const totalReceitas = grupos.reduce((acc, g) => acc + g.total_devido, 0);

  function copiarLembreteWhatsApp(e: React.MouseEvent, g: DividaPorJogador) {
    e.stopPropagation();
    const texto = montarLembreteWhatsApp(g, formatarReais, formatarDataLista);

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(texto)
        .then(() => {
          onNotificar('sucesso', `Lembrete para @${g.username} copiado com sucesso!`);
        })
        .catch(() => {
          onNotificar('erro', 'Não foi possível copiar a mensagem.');
        });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between sumula-header pb-1.5">
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
          Receitas em aberto
        </h3>
        <span className="font-mono text-base font-bold text-ok tabular-nums">
          {formatarReais(totalReceitas)}
        </span>
      </div>

      {carregando && grupos.length === 0 ? (
        <Carregando>Carregando lançamentos…</Carregando>
      ) : grupos.length === 0 ? (
        <MensagemEstado tipo="info">
          Nenhuma receita em aberto. Todo mundo em dia com a quinta.
        </MensagemEstado>
      ) : (
        <ul className="space-y-2">
          {grupos.map((g) => {
            const aberto = expandido === g.jogador_id;
            return (
              <li
                key={g.jogador_id}
                className="rounded-[4px] border border-borda bg-superficie overflow-hidden shadow-carimbo"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandido(aberto ? null : g.jogador_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandido(aberto ? null : g.jogador_id);
                    }
                  }}
                  className="flex min-h-[44px] items-center gap-2 px-3 py-2 cursor-pointer hover:bg-superficie-2 transition"
                >
                  <ChevronDown
                    className={`size-4 shrink-0 text-destaque-texto transition-transform ${
                      aberto ? 'rotate-180' : ''
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-giz">@{g.username}</span>
                      {g.is_mensalista && (
                        <span className="shrink-0 rounded-[2px] border border-destaque/40 bg-destaque/15 px-1.5 py-0.5 text-[9px] font-display uppercase tracking-wider font-bold text-destaque-texto">
                          mensalista
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-giz-fraco">
                      {g.dividas.length} {g.dividas.length === 1 ? 'lançamento' : 'lançamentos'}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-bold text-perigo tabular-nums">
                    {formatarReais(g.total_devido)}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => copiarLembreteWhatsApp(e, g)}
                      title="Copiar lembrete WhatsApp"
                      aria-label={`Copiar cobrança de @${g.username} para WhatsApp`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[3px] border border-borda bg-superficie-2 p-2 text-giz-fraco hover:text-destaque-texto hover:border-destaque/50 transition"
                    >
                      <MessageSquare className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSolicitarQuitarTodas(g.jogador_id, g.username);
                      }}
                      title="Quitar todas"
                      className="min-h-[44px] rounded-[3px] border border-borda bg-superficie-2 px-2.5 py-1 text-xs font-display uppercase tracking-wider font-semibold text-giz hover:border-destaque transition"
                    >
                      Quitar todas
                    </button>
                  </div>
                </div>

                {aberto && (
                  <ul className="divide-y divide-borda border-t border-borda bg-fundo/40">
                    {g.dividas.map((d) => (
                      <li key={d.id} className="flex items-start gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variante="ok">Receita</Badge>
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
                          {d.descricao && <p className="text-xs text-giz">{d.descricao}</p>}
                          {d.partida_id && (
                            <Link
                              to={`/partida/${d.partida_id}`}
                              className="inline-block text-[11px] font-mono text-destaque-texto hover:underline"
                            >
                              ver partida →
                            </Link>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="font-mono text-sm font-bold text-ok tabular-nums">
                            +{formatarReais(Number(d.valor))}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSolicitarQuitar(d.id, g.username);
                            }}
                            className="min-h-[44px] flex items-center gap-1 rounded-[3px] border border-ok bg-ok px-3 py-1.5 text-xs font-display uppercase tracking-wider font-bold text-branco-time shadow-xs hover:brightness-110"
                          >
                            <Check className="size-3.5" />
                            Pagar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
