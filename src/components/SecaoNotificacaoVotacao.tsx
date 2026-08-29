import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Toggle } from './Toggle';
import type { NotificacoesConfig } from '../lib/notificacoes';

interface BucketVotacaoItem {
  readonly key: string;
  readonly label: string;
  readonly field:
    | 'votacao_abertura_ativo'
    | 'votacao_bucket_6h'
    | 'votacao_bucket_3h'
    | 'votacao_bucket_1h'
    | 'votacao_bucket_30m';
}

const BUCKETS_VOTACAO: readonly BucketVotacaoItem[] = [
  { key: 'abertura', label: 'Abertura', field: 'votacao_abertura_ativo' },
  { key: '6h', label: '6 Horas', field: 'votacao_bucket_6h' },
  { key: '3h', label: '3 Horas', field: 'votacao_bucket_3h' },
  { key: '1h', label: '1 Hora', field: 'votacao_bucket_1h' },
  { key: '30m', label: '30 Min', field: 'votacao_bucket_30m' },
];

interface TemplateVotacaoItem {
  readonly key: string;
  readonly label: string;
  readonly titField:
    | 'votacao_template_abertura_titulo'
    | 'votacao_template_6h_titulo'
    | 'votacao_template_3h_titulo'
    | 'votacao_template_1h_titulo'
    | 'votacao_template_30m_titulo';
  readonly msgField:
    | 'votacao_template_abertura_msg'
    | 'votacao_template_6h_msg'
    | 'votacao_template_3h_msg'
    | 'votacao_template_1h_msg'
    | 'votacao_template_30m_msg';
  readonly placeholderTit: string;
  readonly placeholderMsg: string;
}

const TEMPLATES_VOTACAO: readonly TemplateVotacaoItem[] = [
  {
    key: 'abertura',
    label: 'Abertura da Votação',
    titField: 'votacao_template_abertura_titulo',
    msgField: 'votacao_template_abertura_msg',
    placeholderTit: 'A urna está aberta: vote na súmula de hoje!',
    placeholderMsg:
      'Apito final na partida de hoje. Dê suas notas, eleja o Craque e ajude o ranking — a urna fecha em 24 horas.',
  },
  {
    key: '6h',
    label: 'Bucket 6 Horas',
    titField: 'votacao_template_6h_titulo',
    msgField: 'votacao_template_6h_msg',
    placeholderTit: 'Faltam 6 horas para fechar a votação!',
    placeholderMsg: 'Avalie a partida de ontem e deixe suas notas para o ranking.',
  },
  {
    key: '3h',
    label: 'Bucket 3 Horas',
    titField: 'votacao_template_3h_titulo',
    msgField: 'votacao_template_3h_msg',
    placeholderTit: 'Vote, ou então não reclama depois que a divisão tá ruim!',
    placeholderMsg: 'Faltam apenas 3 horas para fechar a súmula da partida de ontem.',
  },
  {
    key: '1h',
    label: 'Bucket 1 Hora',
    titField: 'votacao_template_1h_titulo',
    msgField: 'votacao_template_1h_msg',
    placeholderTit: 'Os analfabetos da bola já votaram, e você?',
    placeholderMsg: 'Acesse a partida de ontem antes que o tempo de votação esgote.',
  },
  {
    key: '30m',
    label: 'Bucket 30 Minutos',
    titField: 'votacao_template_30m_titulo',
    msgField: 'votacao_template_30m_msg',
    placeholderTit: 'Ainda não votou, vai deixar Tchuca avacalhar as notas!?',
    placeholderMsg: 'Últimos 30 minutos para registrar seu voto na partida de ontem!',
  },
];

export interface SecaoNotificacaoVotacaoProps {
  config: NotificacoesConfig;
  onAlterar: (patch: Partial<NotificacoesConfig>) => void;
}

export function SecaoNotificacaoVotacao({ config, onAlterar }: SecaoNotificacaoVotacaoProps) {
  // Acordeão de templates: estado de UI pura, interno ao componente.
  const [bucketAberto, setBucketAberto] = useState<string | null>(null);

  function alterarCampo(campo: string, valor: string | boolean) {
    onAlterar({ [campo]: valor } as Partial<NotificacoesConfig>);
  }

  return (
    <div className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
            2. Lembretes de Votação Pós-Jogo
          </h3>
          <p className="text-xs text-giz-fraco mt-0.5">
            Avisos para registrar votos e notas da súmula antes de fechar a votação (24h).
          </p>
        </div>
        <Toggle
          checked={config.votacao_ativo}
          onChange={(checked) => onAlterar({ votacao_ativo: checked })}
          ariaLabel="Ativar lembretes de votação pós-jogo"
        />
      </div>

      {/* Buckets de Votação */}
      {config.votacao_ativo && (
        <div className="space-y-3 pt-1">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco">
            Avisos Ativos (abertura e antes do fechamento):
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BUCKETS_VOTACAO.map((bucket) => {
              const checked = config[bucket.field];
              return (
                <label
                  key={bucket.key}
                  className={`min-h-[44px] flex items-center justify-between p-2.5 rounded-[4px] border cursor-pointer transition ${
                    checked
                      ? 'border-destaque/50 bg-destaque/10 text-giz'
                      : 'border-borda bg-superficie-2 text-giz-fraco opacity-60'
                  }`}
                >
                  <span className="font-display font-bold uppercase tracking-wider text-xs">
                    {bucket.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => alterarCampo(bucket.field, e.target.checked)}
                    className="size-4 accent-destaque rounded-[2px]"
                  />
                </label>
              );
            })}
          </div>

          {/* Acordeão de Textos de Votação */}
          <div className="space-y-2 pt-2 border-t border-borda">
            <span className="block text-xs font-display uppercase tracking-wider text-giz">
              Personalizar Mensagens por Intervalo:
            </span>

            {TEMPLATES_VOTACAO.map((b) => {
              const aberto = bucketAberto === b.key;
              return (
                <div
                  key={b.key}
                  className="rounded-[4px] border border-borda bg-superficie-2 overflow-hidden shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setBucketAberto(aberto ? null : b.key)}
                    className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 text-left hover:bg-superficie transition"
                  >
                    <span className="font-display font-bold uppercase tracking-wider text-xs text-giz">
                      {b.label}
                    </span>
                    <ChevronDown
                      className={`size-4 text-destaque-texto transition-transform ${aberto ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {aberto && (
                    <div className="p-3 border-t border-borda bg-fundo/40 space-y-2">
                      <label className="block">
                        <span className="block text-[11px] font-display uppercase tracking-wider text-giz-fraco mb-1">
                          Título
                        </span>
                        <input
                          type="text"
                          maxLength={120}
                          value={config[b.titField] ?? ''}
                          onChange={(e) => alterarCampo(b.titField, e.target.value)}
                          placeholder={b.placeholderTit}
                          className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto"
                        />
                      </label>

                      <label className="block">
                        <span className="block text-[11px] font-display uppercase tracking-wider text-giz-fraco mb-1">
                          Mensagem
                        </span>
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={config[b.msgField] ?? ''}
                          onChange={(e) => alterarCampo(b.msgField, e.target.value)}
                          placeholder={b.placeholderMsg}
                          className="w-full rounded-[4px] border border-borda bg-superficie px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
