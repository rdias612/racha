import { AlertTriangle, RefreshCw, Send, Smartphone } from 'lucide-react';
import type { StatusPush } from '../lib/pwa';
import type { PartidaDraftAtual } from '../lib/notificacoes';
import { formatarDataLista } from '../lib/formatacao';

export interface SecaoNotificacaoTestesProps {
  pushStatus: StatusPush;
  partidaDraft: PartidaDraftAtual | null;
  disparandoTeste: boolean;
  disparandoReenvio: boolean;
  onTestarPush: () => void;
  onSolicitarReenvio: () => void;
}

export function SecaoNotificacaoTestes({
  pushStatus,
  partidaDraft,
  disparandoTeste,
  disparandoReenvio,
  onTestarPush,
  onSolicitarReenvio,
}: SecaoNotificacaoTestesProps) {
  return (
    <div className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-4">
      <div>
        <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
          3. Testes & Disparos Manuais
        </h3>
        <p className="text-xs text-giz-fraco mt-0.5">
          Valide o recebimento no seu aparelho ou reenvie convites a qualquer momento.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card 1: Testar no meu dispositivo */}
        <div className="rounded-[4px] border border-borda bg-superficie-2 p-3 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-display uppercase tracking-wider font-bold text-giz">
              <Smartphone className="size-4 text-destaque-texto shrink-0" />
              <span>Testar Notificação</span>
            </div>
            <p className="text-xs text-giz-fraco">
              Dispara um push de teste imediato para o seu perfil.
            </p>
          </div>

          {pushStatus !== 'ativado' ? (
            <div className="rounded-[3px] border border-perigo/40 bg-perigo/10 p-2 text-xs text-perigo flex items-start gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <span>Ative as notificações no seu Perfil para poder testar.</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onTestarPush}
              disabled={disparandoTeste}
              className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-[4px] border border-borda bg-superficie px-3 py-2 font-display font-bold uppercase tracking-wider text-xs text-giz hover:bg-superficie-2 hover:border-destaque/50 shadow-xs transition active:translate-y-px disabled:opacity-50"
            >
              <Send className="size-3.5 text-destaque-texto" />
              {disparandoTeste ? 'Enfileirando…' : 'Testar no meu celular'}
            </button>
          )}
        </div>

        {/* Card 2: Reenviar convite agora */}
        <div className="rounded-[4px] border border-borda bg-superficie-2 p-3 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-display uppercase tracking-wider font-bold text-giz">
              <RefreshCw className="size-4 text-destaque-texto shrink-0" />
              <span>Reenviar Convite</span>
            </div>
            <p className="text-xs text-giz-fraco">
              {partidaDraft
                ? `Partida #${partidaDraft.id} agendada para ${formatarDataLista(partidaDraft.data_jogo)}.`
                : 'Nenhuma partida em agendamento (draft) no momento.'}
            </p>
          </div>

          <button
            type="button"
            disabled={!partidaDraft || disparandoReenvio}
            onClick={onSolicitarReenvio}
            className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-[4px] border border-destaque/40 bg-destaque/10 px-3 py-2 font-display font-bold uppercase tracking-wider text-xs text-destaque-texto hover:bg-destaque/20 shadow-xs transition active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`size-3.5 ${disparandoReenvio ? 'animate-spin' : ''}`} />
            {disparandoReenvio ? 'Reenviando…' : 'Reenviar convite agora'}
          </button>
        </div>
      </div>
    </div>
  );
}
