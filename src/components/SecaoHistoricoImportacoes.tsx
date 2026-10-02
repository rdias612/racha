import { RefreshCw } from 'lucide-react';
import { Badge, type BadgeVariante } from './Badge';
import { Carregando, MensagemEstado } from './Estado';
import { formatarDataLista, formatarDataMobile, formatarTamanhoBytes } from '../lib/formatacao';
import type { ImportacaoClipes } from '../lib/clipes';

// Mapeamento local: os status do ledger (Fase 1) não existem no `status` prop do
// Badge (Badge.tsx:14-23) — usar `variante` direta.
const STATUS_BADGE: Record<ImportacaoClipes['status'], { rotulo: string; variante: BadgeVariante }> = {
  iniciado: { rotulo: 'Em andamento', variante: 'neutro' },
  concluido: { rotulo: 'Concluído', variante: 'ok' },
  sem_clipes: { rotulo: 'Sem clipes', variante: 'destaque' },
  falha: { rotulo: 'Falha', variante: 'perigo' },
  limpeza: { rotulo: 'Limpeza', variante: 'neutro' },
};

export interface SecaoHistoricoImportacoesProps {
  importacoes: ImportacaoClipes[];
  carregando: boolean;
  erro: string | null;
  onAtualizar: () => void;
}

export function SecaoHistoricoImportacoes({ importacoes, carregando, erro, onAtualizar }: SecaoHistoricoImportacoesProps) {
  return (
    <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-4">
      {/* Cabeçalho + botão atualizar: padrão SecaoNotificacaoSaude.tsx:66-88 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
            Histórico de importações
          </h3>
          <p className="text-xs text-giz-fraco mt-0.5">
            Execuções da Action e limpezas de retenção (mais recente primeiro).
          </p>
        </div>
        <button type="button" onClick={onAtualizar} aria-label="Atualizar histórico"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[4px] border border-borda bg-superficie px-3 text-giz shadow-xs transition hover:bg-superficie-2 active:translate-y-px disabled:opacity-50">
          <RefreshCw className={`size-4 text-destaque-texto ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {carregando && importacoes.length === 0 ? (
        <Carregando compacto>Carregando histórico…</Carregando>
      ) : erro ? (
        <MensagemEstado tipo="erro">{erro}</MensagemEstado>
      ) : importacoes.length === 0 ? (
        <MensagemEstado tipo="info">Nenhuma importação registrada ainda.</MensagemEstado>
      ) : (
        <div className="divide-y divide-borda/40 border-y border-borda">
          {importacoes.map((r) => {
            const badge = STATUS_BADGE[r.status] ?? { rotulo: r.status, variante: 'neutro' as BadgeVariante };
            const tamanho = formatarTamanhoBytes(r.bytes_total);
            return (
              <div key={r.id} className="py-2.5 px-1 space-y-1">
                <div className="flex items-center justify-between gap-2 min-h-[32px]">
                  <span className="font-display font-bold text-sm text-giz capitalize truncate">
                    {formatarDataLista(r.data_referencia)}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-giz-fraco">
                      {r.origem === 'manual' ? 'manual' : 'auto'}
                    </span>
                    <Badge variante={badge.variante}>{badge.rotulo}</Badge>
                  </span>
                </div>
                <p className="font-mono text-[11px] text-giz-fraco tabular-nums">
                  {r.status === 'limpeza'
                    ? 'partida removida por retenção'
                    : r.quantidade_clipes != null
                      ? `${r.quantidade_clipes} clipe(s)${tamanho ? ` · ${tamanho}` : ''}`
                      : '—'}
                  {r.partida_id != null && ` · partida #${r.partida_id}`}
                  {' · '}
                  {formatarDataMobile(r.criado_em)}
                </p>
                {r.erro && <p className="text-perigo break-words text-xs">{r.erro}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
