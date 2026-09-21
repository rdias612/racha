import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { useSnackbar } from '../hooks/useSnackbar';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { AbasNotificacoes } from '../components/AbasNotificacoes';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Snackbar } from '../components/Snackbar';
import { SecaoNotificacaoTestes } from '../components/SecaoNotificacaoTestes';
import { statusPush, type StatusPush } from '../lib/pwa';
import {
  dispararPushTeste,
  dispararConfirmacaoManual,
  obterPartidaDraftAtual,
  type PartidaDraftAtual,
} from '../lib/notificacoes';
import { formatarMensagemErro } from '../lib/erros';
import { vibrateLight } from '../lib/haptics';

const TABS_NOTIFICACOES = [
  '/notificacoes/confirmacao',
  '/notificacoes/votacao',
  '/notificacoes/testes',
  '/notificacoes/saude',
];

export function NotificacoesTestes() {
  const isAdmin = useAdmin();
  const jogador = useJogadorLogado();

  const [pushStatus, setPushStatus] = useState<StatusPush>('indisponivel');
  const [partidaDraft, setPartidaDraft] = useState<PartidaDraftAtual | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [disparandoTeste, setDisparandoTeste] = useState(false);
  const [disparandoReenvio, setDisparandoReenvio] = useState(false);
  const [confirmReenvioAberto, setConfirmReenvioAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  const { handlers: swipeHandlers } = useSwipeTabs({
    tabs: TABS_NOTIFICACOES,
    activeTab: '/notificacoes/testes',
  });

  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!jogador || !isAdmin) return;
      setCarregando(true);
      setErro(null);

      try {
        const [draft, status] = await Promise.all([
          obterPartidaDraftAtual(),
          statusPush(jogador.id),
        ]);

        if (isAtivo && !isAtivo()) return;

        setPartidaDraft(draft);
        setPushStatus(status);
      } catch (err) {
        if (isAtivo && !isAtivo()) return;
        setErro(formatarMensagemErro(err, 'Erro ao carregar dados de testes.'));
      } finally {
        if (!isAtivo || isAtivo()) setCarregando(false);
      }
    },
    [jogador, isAdmin]
  );

  useEffect(() => {
    let ativo = true;
    carregar(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregar]);

  if (!isAdmin) return <Navigate to="/" replace />;

  async function handleTestarPush() {
    if (!jogador) return;
    setDisparandoTeste(true);
    vibrateLight();

    try {
      await dispararPushTeste(jogador.id);
      mostrarSnackbar('sucesso', 'Push de teste enfileirado no servidor!');
    } catch (err) {
      mostrarSnackbar('erro', formatarMensagemErro(err, 'Falha ao enviar teste.'));
    } finally {
      setDisparandoTeste(false);
    }
  }

  async function handleConfirmarReenvio() {
    if (!jogador || !partidaDraft) return;
    setConfirmReenvioAberto(false);
    setDisparandoReenvio(true);
    vibrateLight();

    try {
      await dispararConfirmacaoManual(jogador.id, partidaDraft.id);
      mostrarSnackbar('sucesso', 'Convite de presença reenviado aos mensalistas pendentes!');
    } catch (err) {
      mostrarSnackbar('erro', formatarMensagemErro(err, 'Falha ao reenviar convites.'));
    } finally {
      setDisparandoReenvio(false);
    }
  }

  return (
    <div
      className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz touch-pan-y"
      {...swipeHandlers}
    >
      <BotaoVoltar fallback="/" />

      <div className="flex items-center justify-between sumula-header pb-2">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-destaque-texto" />
          <h2 className="font-display font-bold text-xl uppercase tracking-wider text-giz">
            Gestão de Notificações
          </h2>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-giz-fraco">
          Painel Push
        </span>
      </div>

      <AbasNotificacoes />

      {erro && <MensagemEstado tipo="erro">{erro}</MensagemEstado>}

      {carregando ? (
        <Carregando>Carregando ferramentas de teste…</Carregando>
      ) : (
        <SecaoNotificacaoTestes
          pushStatus={pushStatus}
          partidaDraft={partidaDraft}
          disparandoTeste={disparandoTeste}
          disparandoReenvio={disparandoReenvio}
          onTestarPush={handleTestarPush}
          onSolicitarReenvio={() => setConfirmReenvioAberto(true)}
        />
      )}

      {/* Confirmação de Reenvio */}
      {confirmReenvioAberto && partidaDraft && (
        <ConfirmDialog
          open={confirmReenvioAberto}
          titulo="Reenviar convite semanal?"
          mensagem={`Disparar a notificação push de confirmação para todos os mensalistas ainda PENDENTES da Partida #${partidaDraft.id}?`}
          onConfirm={handleConfirmarReenvio}
          onClose={() => setConfirmReenvioAberto(false)}
        />
      )}

      {/* Feedback Toast */}
      <Snackbar {...snackbarProps} />
    </div>
  );
}
