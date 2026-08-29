import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, RefreshCw } from 'lucide-react';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Carregando, MensagemEstado } from './Estado';
import { formatarDataMobile, formatarNome } from '../lib/formatacao';
import type { PainelEntregaJogador } from '../lib/notificacoes';

export interface SecaoNotificacaoSaudeProps {
  dados: PainelEntregaJogador[];
  carregando: boolean;
  erro: string | null;
  onAtualizar: () => void;
}

// Regra de saúde do aparelho (plano P6 §3.2): "entrega real" ≠ "inscrição".
// Cruza a última entrega do ledger com a última (re)inscrição — o P1 bumpa
// updated_at a cada boot bem-sucedido. 14 dias ≈ 2 rodadas do racha, período
// em que o jogador naturalmente abriria o app (e o P1 re-inscreveria).
const DIAS_OBSERVAR = 3; // sem evidência há 3+ dias
const DIAS_VERIFICAR = 14; // sem evidência há 2 rodadas completas

const MS_POR_DIA = 86_400_000;

function calcularDiasSemEvidencia(r: PainelEntregaJogador): number {
  const evidencias = [r.ultima_entrega_em, r.ultima_inscricao_em].filter(
    (d): d is string => d !== null
  );
  if (evidencias.length === 0) return Number.POSITIVE_INFINITY;
  const maisRecente = Math.max(...evidencias.map((d) => new Date(d).getTime()));
  return (Date.now() - maisRecente) / MS_POR_DIA;
}

interface SaudeInfo {
  variante: 'ok' | 'perigo' | 'neutro';
  Icone: typeof CheckCircle2;
  rotulo: string;
}

function saude(r: PainelEntregaJogador): SaudeInfo {
  if (r.qtd_aparelhos === 0) {
    return { variante: 'perigo', Icone: AlertTriangle, rotulo: 'Sem aparelho' };
  }
  const dias = calcularDiasSemEvidencia(r);
  if (dias < DIAS_OBSERVAR) {
    return { variante: 'ok', Icone: CheckCircle2, rotulo: 'Em dia' };
  }
  if (dias < DIAS_VERIFICAR) {
    return { variante: 'neutro', Icone: Clock, rotulo: 'Observar' };
  }
  return { variante: 'perigo', Icone: AlertTriangle, rotulo: 'Verificar aparelho' };
}

export function SecaoNotificacaoSaude({
  dados,
  carregando,
  erro,
  onAtualizar,
}: SecaoNotificacaoSaudeProps) {
  const [aberto, setAberto] = useState<number | null>(null);

  const total = dados.length;
  const comAparelho = dados.filter((r) => r.qtd_aparelhos > 0).length;

  return (
    <div className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-4">
      {/* Cabeçalho: título + resumo mono + botão atualizar */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
            4. Saúde das Entregas por Atleta
          </h3>
          <p className="text-xs text-giz-fraco mt-0.5">
            Última entrega real por jogador e aparelhos inscritos. Sem entrega recente = candidato a
            aparelho com problema.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-giz-fraco tabular-nums mt-1">
            {comAparelho} de {total} atletas com inscrição ativa
          </p>
        </div>
        <button
          type="button"
          onClick={onAtualizar}
          aria-label="Atualizar quadro de entregas"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[4px] border border-borda bg-superficie px-3 text-giz shadow-xs transition hover:bg-superficie-2 active:translate-y-px disabled:opacity-50"
        >
          <RefreshCw className={`size-4 text-destaque-texto ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Legenda do contexto pós-P5 */}
      <MensagemEstado tipo="info">
        Entregas registradas desde o conserto da cron (29/08/2026). “Nunca recebeu” logo após a
        ativação é normal — os lembretes saem em janelas agendadas.
      </MensagemEstado>

      {carregando && dados.length === 0 ? (
        <Carregando compacto>Carregando quadro de entregas…</Carregando>
      ) : erro ? (
        <MensagemEstado tipo="erro">{erro}</MensagemEstado>
      ) : dados.length === 0 ? (
        <MensagemEstado tipo="info">
          Nenhum atleta ativo encontrado no elenco para exibir.
        </MensagemEstado>
      ) : (
        <div className="divide-y divide-borda/40 border-y border-borda">
          {dados.map((r) => {
            const estaAberto = aberto === r.jogador_id;
            const status = saude(r);
            return (
              <div key={r.jogador_id}>
                {/* Linha-sumário: botão de drill-down, 44px, aria-expanded */}
                <button
                  type="button"
                  aria-expanded={estaAberto}
                  onClick={() => setAberto((prev) => (prev === r.jogador_id ? null : r.jogador_id))}
                  className="w-full min-h-[44px] flex items-center justify-between gap-3 py-2.5 px-1 text-left transition hover:bg-superficie-2/50 focus-visible:outline-2 focus-visible:outline-destaque-texto focus-visible:outline-offset-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Avatar username={r.username} posicao={r.posicao} size="sm" />
                    <span className="font-display font-bold text-sm uppercase tracking-wide text-giz truncate">
                      {formatarNome(r.username)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {r.total_entregas === 0 && (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-giz-fraco">
                        nunca recebeu
                      </span>
                    )}
                    <span className="font-mono text-xs text-giz-fraco tabular-nums">
                      {r.ultima_entrega_em ? formatarDataMobile(r.ultima_entrega_em) : '—'}
                    </span>
                    <Badge variante={status.variante} icone={<status.Icone className="size-3" />}>
                      {status.rotulo}
                    </Badge>
                    <ChevronDown
                      className={`size-4 text-giz-fraco transition ${estaAberto ? 'rotate-180' : ''}`}
                    />
                  </span>
                </button>

                {/* Detalhe (drill-down itemizado por pessoa) */}
                {estaAberto && (
                  <div className="pb-3 px-1 space-y-2 text-xs text-giz-fraco">
                    <p className="font-mono tabular-nums">
                      {r.qtd_aparelhos} aparelho(s) · última inscrição{' '}
                      {r.ultima_inscricao_em ? formatarDataMobile(r.ultima_inscricao_em) : '—'}
                    </p>
                    <ul className="space-y-1">
                      {r.aparelhos.map((ap) => (
                        <li
                          key={`${ap.endpoint}-${ap.criado_em}`}
                          className="font-mono tabular-nums flex justify-between gap-2"
                        >
                          <span className="truncate">…{ap.endpoint}</span>
                          <span>
                            {formatarDataMobile(ap.criado_em)} →{' '}
                            {formatarDataMobile(ap.atualizado_em)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="font-mono tabular-nums">
                      {r.total_entregas} entrega(s) · última:{' '}
                      {r.ultima_entrega_em
                        ? `${formatarDataMobile(r.ultima_entrega_em)} (${r.ultima_entrega_key ?? '?'}, partida #${r.ultima_entrega_partida ?? '?'})`
                        : 'nunca recebeu'}
                    </p>
                    {r.ultimo_erro && (
                      <p className="text-perigo break-words">
                        Último erro ({r.ultimo_erro_em ? formatarDataMobile(r.ultimo_erro_em) : '—'}
                        ): {r.ultimo_erro}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
