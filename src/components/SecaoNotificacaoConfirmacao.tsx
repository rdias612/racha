import { Calendar, Clock, Info } from 'lucide-react';
import { Toggle } from './Toggle';
import type { NotificacoesConfig } from '../lib/notificacoes';

// Constantes exportadas: os modais de agendamento da rota também as usam.
export const DIAS_DISPARO = [
  { value: '1', label: 'Segunda-feira', sublabel: 'Padrão recomendado' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira', sublabel: 'Atenção: antes das 16h' },
];

export const OPCOES_REFORCO = [
  { value: '2', label: '2 horas antes', sublabel: 'Quarta às 14h' },
  { value: '4', label: '4 horas antes', sublabel: 'Quarta às 12h — padrão' },
  { value: '6', label: '6 horas antes', sublabel: 'Quarta às 10h' },
  { value: '12', label: '12 horas antes', sublabel: 'Quarta às 04h' },
  { value: '24', label: '24 horas antes', sublabel: 'Terça às 16h' },
];

const VARIAVEIS_CONVITE = ['{dia_jogo}', '{hora_jogo}', '{prazo}'] as const;

function nomeDiaSemana(dia: number): string {
  return DIAS_DISPARO.find((d) => d.value === String(dia))?.label ?? `Dia ${dia}`;
}

function nomeReforcoHoras(horas: number): string {
  return OPCOES_REFORCO.find((o) => o.value === String(horas))?.label ?? `${horas}h antes`;
}

export interface SecaoNotificacaoConfirmacaoProps {
  config: NotificacoesConfig;
  onAlterar: (patch: Partial<NotificacoesConfig>) => void;
  onAbrirModalAgendamento: () => void;
  onAbrirModalReforco: () => void;
}

export function SecaoNotificacaoConfirmacao({
  config,
  onAlterar,
  onAbrirModalAgendamento,
  onAbrirModalReforco,
}: SecaoNotificacaoConfirmacaoProps) {
  return (
    <div className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
            1. Confirmação de Presença Semanal
          </h3>
          <p className="text-xs text-giz-fraco mt-0.5">
            Convite automático enviado aos mensalistas antes do jogo.
          </p>
        </div>
        <Toggle
          checked={config.confirmacao_ativo}
          onChange={(checked) => onAlterar({ confirmacao_ativo: checked })}
          ariaLabel="Ativar confirmação de presença semanal"
        />
      </div>

      {!config.confirmacao_ativo && (
        <div className="rounded-[4px] border border-borda/60 bg-superficie-2/70 p-2.5 flex items-center gap-2 text-xs text-giz-fraco">
          <Info className="size-4 text-destaque-texto shrink-0" />
          <span>
            Notificações desativadas. A partida continuará sendo criada normalmente na
            segunda-feira.
          </span>
        </div>
      )}

      {/* Dia e Horário do Disparo — Botão que abre modal dedicado */}
      <div className="pt-1">
        <span className="flex items-center gap-1 text-xs font-display uppercase tracking-wider text-giz-fraco mb-1.5">
          <Calendar className="size-3.5 text-destaque-texto" />
          Dia e Horário do Disparo
        </span>
        <button
          type="button"
          onClick={onAbrirModalAgendamento}
          className="w-full min-h-[48px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2.5 text-left font-mono transition flex items-center justify-between gap-2 shadow-xs active:translate-y-px hover:border-destaque"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className="size-4 text-destaque-texto shrink-0" />
            <span className="text-base sm:text-sm text-giz font-bold truncate">
              {nomeDiaSemana(config.confirmacao_dia_semana)} ·{' '}
              {config.confirmacao_horario.slice(0, 5)}
            </span>
          </div>
          <span className="text-[11px] font-display font-bold uppercase tracking-wider text-destaque-texto shrink-0">
            Alterar
          </span>
        </button>
      </div>

      <p className="text-[11px] font-mono text-giz-fraco">
        * Regra de domínio: o racha ocorre quinta 19h e o prazo final de confirmação encerra quarta
        16h.
      </p>

      {/* Textos Personalizados */}
      <div className="space-y-3 pt-2 border-t border-borda">
        <div className="flex items-center justify-between">
          <span className="text-xs font-display uppercase tracking-wider font-bold text-giz">
            Texto do Convite Principal
          </span>
          <span className="text-[10px] font-mono text-giz-fraco">Variáveis disponíveis:</span>
        </div>

        {/* Badges de Variáveis */}
        <div className="flex flex-wrap gap-1.5">
          {VARIAVEIS_CONVITE.map((variavel) => (
            <span
              key={variavel}
              className="rounded-[2px] border border-destaque/30 bg-destaque/10 px-1.5 py-0.5 text-[10px] font-mono text-destaque-texto"
            >
              {variavel}
            </span>
          ))}
        </div>

        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Título (máx. 120 caracteres)
          </span>
          <input
            type="text"
            maxLength={120}
            value={config.confirmacao_titulo ?? ''}
            onChange={(e) => onAlterar({ confirmacao_titulo: e.target.value })}
            placeholder="Confirme sua presença"
            className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
            Mensagem (máx. 500 caracteres)
          </span>
          <textarea
            rows={2}
            maxLength={500}
            value={config.confirmacao_mensagem ?? ''}
            onChange={(e) => onAlterar({ confirmacao_mensagem: e.target.value })}
            placeholder="Tem racha {dia_jogo} {hora_jogo}! Reserve sua vaga até {prazo}."
            className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto"
          />
        </label>
      </div>

      {/* BLOCO DE REFORÇO */}
      <div className="space-y-3 pt-3 border-t border-borda">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-destaque-texto">
              Reforço de Confirmação (2º Aviso)
            </h4>
            <p className="text-xs text-giz-fraco mt-0.5">
              Lembrete automático para quem ainda não respondeu antes do encerramento do prazo.
            </p>
          </div>
          <Toggle
            checked={config.reforco_ativo}
            onChange={(checked) => onAlterar({ reforco_ativo: checked })}
            ariaLabel="Ativar reforço de confirmação"
          />
        </div>

        {config.reforco_ativo && (
          <div className="space-y-3 pt-1">
            <div>
              <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
                Horas de Antecedência do Prazo (quarta 16h)
              </span>
              <button
                type="button"
                onClick={onAbrirModalReforco}
                className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-left font-mono transition flex items-center justify-between gap-2 shadow-xs active:translate-y-px hover:border-destaque"
              >
                <span className="text-base sm:text-sm text-giz font-bold truncate">
                  {nomeReforcoHoras(config.reforco_horas_antes_prazo)}
                </span>
                <span className="text-[11px] font-display font-bold uppercase tracking-wider text-destaque-texto shrink-0">
                  Alterar
                </span>
              </button>
            </div>

            <label className="block">
              <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
                Título do Reforço
              </span>
              <input
                type="text"
                maxLength={120}
                value={config.reforco_titulo ?? ''}
                onChange={(e) => onAlterar({ reforco_titulo: e.target.value })}
                placeholder="Últimas horas para confirmar presença"
                className="w-full min-h-[44px] rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
                Mensagem do Reforço
              </span>
              <textarea
                rows={2}
                maxLength={500}
                value={config.reforco_mensagem ?? ''}
                onChange={(e) => onAlterar({ reforco_mensagem: e.target.value })}
                placeholder="O prazo para confirmação encerra em {prazo}. Garanta sua vaga no racha!"
                className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
