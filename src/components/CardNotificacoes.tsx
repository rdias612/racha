import { useEffect, useState } from 'react';
import { Bell, BellRing, BellOff, Loader2 } from 'lucide-react';
import { useSessao } from '../context/SessaoContext';
import { ativarPush, desativarPush, statusPush, type StatusPush } from '../lib/pwa';
import { formatarMensagemErro } from '../lib/erros';
import { MensagemEstado } from './Estado';

/**
 * Cartão para ativação e controle de notificações Push na tela inicial (Resumo).
 * Melhora a retenção e adesão dos jogadores a instalar o PWA e receber lembretes de jogos/votação.
 */
export function CardNotificacoes() {
  const { jogador } = useSessao();
  const [pushStatus, setPushStatus] = useState<StatusPush>('desativado');
  const [carregandoPush, setCarregandoPush] = useState(true);
  const [alterandoPush, setAlterandoPush] = useState(false);
  const [erroPush, setErroPush] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregarPush() {
      if (!jogador) return;
      try {
        const status = await statusPush(jogador.id);
        if (ativo) setPushStatus(status);
      } catch {
        if (ativo) setPushStatus('desativado');
      } finally {
        if (ativo) setCarregandoPush(false);
      }
    }
    carregarPush();
    return () => {
      ativo = false;
    };
  }, [jogador]);

  if (!jogador) return null;

  async function alternarPush() {
    if (!jogador) return;
    setAlterandoPush(true);
    setErroPush(null);
    try {
      if (pushStatus === 'ativado') {
        await desativarPush(jogador.id);
        setPushStatus('desativado');
      } else {
        await ativarPush(jogador.id);
        setPushStatus('ativado');
      }
    } catch (error) {
      setErroPush(formatarMensagemErro(error));
    } finally {
      setAlterandoPush(false);
    }
  }

  // Não renderiza nada durante a checagem inicial para evitar flicker
  if (carregandoPush) return null;

  return (
    <section className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-giz flex items-center gap-1.5">
          {pushStatus === 'ativado' ? (
            <>
              <BellRing className="size-4 text-destaque animate-pulse" />
              <span>Lembretes Ativos</span>
            </>
          ) : pushStatus === 'negado' ? (
            <>
              <BellOff className="size-4 text-giz-fraco" />
              <span>Lembretes Bloqueados</span>
            </>
          ) : (
            <>
              <Bell className="size-4 text-destaque" />
              <span>Lembretes da Quinta</span>
            </>
          )}
        </h3>

        {pushStatus === 'ativado' && (
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-destaque bg-destaque/15 px-1.5 py-0.5 rounded-[2px]">
            Ativo
          </span>
        )}
      </div>

      <p className="text-xs text-giz-fraco leading-relaxed">
        {pushStatus === 'ativado'
          ? 'Você receberá avisos de convocação de presença e abertura da votação neste aparelho.'
          : 'Receba convocação de presença e aviso de abertura da votação direto no seu celular.'}
      </p>

      {erroPush && <MensagemEstado>{erroPush}</MensagemEstado>}

      {pushStatus === 'indisponivel' && (
        <MensagemEstado tipo="info">
          Seu navegador não suporta notificações Push ou precisa que o app seja adicionado à tela inicial.
        </MensagemEstado>
      )}

      {pushStatus === 'negado' && (
        <MensagemEstado tipo="info">
          As notificações estão bloqueadas nas configurações do navegador. Permita o acesso para receber os lembretes.
        </MensagemEstado>
      )}

      {pushStatus !== 'indisponivel' && pushStatus !== 'negado' && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={alternarPush}
            disabled={alterandoPush}
            className={`w-full min-h-[44px] rounded-[3px] border font-display font-bold uppercase tracking-wider text-xs shadow-carimbo transition active:translate-y-px disabled:opacity-50 flex items-center justify-center gap-2 ${
              pushStatus === 'ativado'
                ? 'border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:bg-superficie'
                : 'border-destaque bg-destaque text-destaque-tinta hover:brightness-105'
            }`}
          >
            {alterandoPush && <Loader2 className="size-4 animate-spin" />}
            {alterandoPush
              ? 'Atualizando…'
              : pushStatus === 'ativado'
                ? 'Desativar notificações'
                : 'Ativar lembretes do racha'}
          </button>
        </div>
      )}
    </section>
  );
}
