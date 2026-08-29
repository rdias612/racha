import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Bell, Save } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ModalSelecionarAgendamento } from '../components/ModalSelecionarAgendamento';
import { ModalSelecionarOpcao } from '../components/ModalSelecionarOpcao';
import {
  DIAS_DISPARO,
  OPCOES_REFORCO,
  SecaoNotificacaoConfirmacao,
} from '../components/SecaoNotificacaoConfirmacao';
import { SecaoNotificacaoTestes } from '../components/SecaoNotificacaoTestes';
import { SecaoNotificacaoSaude } from '../components/SecaoNotificacaoSaude';
import { SecaoNotificacaoVotacao } from '../components/SecaoNotificacaoVotacao';
import { Snackbar } from '../components/Snackbar';
import { useSnackbar } from '../hooks/useSnackbar';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { vibrateLight, vibrateError } from '../lib/haptics';
import { statusPush, type StatusPush } from '../lib/pwa';
import {
  obterConfiguracoesNotificacoes,
  salvarConfiguracoesNotificacoes,
  dispararPushTeste,
  dispararConfirmacaoManual,
  obterPartidaDraftAtual,
  obterPainelEntregasPush,
  type NotificacoesConfig,
  type PartidaDraftAtual,
  type PainelEntregaJogador,
} from '../lib/notificacoes';
import { formatarMensagemErro } from '../lib/erros';

export function Notificacoes() {
  const isAdmin = useAdmin();
  const jogador = useJogadorLogado();

  // Estados principais
  const [config, setConfig] = useState<NotificacoesConfig | null>(null);
  const [partidaDraft, setPartidaDraft] = useState<PartidaDraftAtual | null>(null);
  const [pushStatus, setPushStatus] = useState<StatusPush>('indisponivel');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [disparandoTeste, setDisparandoTeste] = useState(false);
  const [disparandoReenvio, setDisparandoReenvio] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quadro de saúde das entregas push (seção 4, somente-leitura)
  const [painel, setPainel] = useState<PainelEntregaJogador[]>([]);
  const [carregandoPainel, setCarregandoPainel] = useState(true);
  const [erroPainel, setErroPainel] = useState<string | null>(null);

  // Modais e Toasts
  const [confirmReenvioAberto, setConfirmReenvioAberto] = useState(false);
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [modalReforcoAberto, setModalReforcoAberto] = useState(false);
  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  // Aplica patches de campo vindos das seções (contrato unidirecional)
  const alterar = useCallback((patch: Partial<NotificacoesConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Carregamento de dados
  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!jogador || !isAdmin) return;
      setCarregando(true);
      setErro(null);

      try {
        const [dadosConfig, draft, status] = await Promise.all([
          obterConfiguracoesNotificacoes(jogador.id),
          obterPartidaDraftAtual(),
          statusPush(jogador.id),
        ]);

        if (isAtivo && !isAtivo()) return;

        setConfig(dadosConfig);
        setPartidaDraft(draft);
        setPushStatus(status);
      } catch (err) {
        if (isAtivo && !isAtivo()) return;
        setErro(formatarMensagemErro(err, 'Erro ao carregar configurações.'));
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

  // Efeito próprio: falha ou ausência da RPC do painel não derruba o
  // formulário de configuração (deploy do front pode preceder o db push).
  const carregarPainel = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!jogador || !isAdmin) return;
      setCarregandoPainel(true);
      setErroPainel(null);

      try {
        const dados = await obterPainelEntregasPush(jogador.id);
        if (isAtivo && !isAtivo()) return;
        setPainel(dados);
      } catch (err) {
        if (isAtivo && !isAtivo()) return;
        setErroPainel(formatarMensagemErro(err, 'Erro ao carregar o quadro de entregas.'));
      } finally {
        if (!isAtivo || isAtivo()) setCarregandoPainel(false);
      }
    },
    [jogador, isAdmin]
  );

  useEffect(() => {
    let ativo = true;
    carregarPainel(() => ativo);
    return () => {
      ativo = false;
    };
  }, [carregarPainel]);

  // Hook guard: após todos os hooks
  if (!isAdmin) return <Navigate to="/" replace />;

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    if (!config || !jogador) return;

    // Validação de horário no client
    if (config.confirmacao_dia_semana === 3 && config.confirmacao_horario >= '16:00') {
      setErro('Para disparos na quarta-feira, o horário deve ser anterior às 16:00 (prazo final).');
      vibrateError();
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      await salvarConfiguracoesNotificacoes(jogador.id, config);
      mostrarSnackbar('sucesso', 'Configurações de notificações salvas!');
    } catch (err) {
      const msg = formatarMensagemErro(err, 'Erro ao salvar configurações.');
      setErro(msg);
      mostrarSnackbar('erro', msg);
    } finally {
      setSalvando(false);
    }
  }

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

  if (carregando && !config) {
    return (
      <div className="px-3 py-6 max-w-2xl mx-auto">
        <Carregando>Carregando painel de notificações…</Carregando>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="px-3 py-6 max-w-2xl mx-auto space-y-4">
        {erro && <MensagemEstado tipo="erro">{erro}</MensagemEstado>}
      </div>
    );
  }

  return (
    <div className="px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz">
      {/* Botão voltar */}
      <BotaoVoltar fallback="/" />

      {/* Cabeçalho da Súmula */}
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

      {erro && <MensagemEstado tipo="erro">{erro}</MensagemEstado>}

      <form onSubmit={handleSalvar} className="space-y-4">
        <SecaoNotificacaoConfirmacao
          config={config}
          onAlterar={alterar}
          onAbrirModalAgendamento={() => setModalAgendamentoAberto(true)}
          onAbrirModalReforco={() => setModalReforcoAberto(true)}
        />

        <SecaoNotificacaoVotacao config={config} onAlterar={alterar} />

        <SecaoNotificacaoTestes
          pushStatus={pushStatus}
          partidaDraft={partidaDraft}
          disparandoTeste={disparandoTeste}
          disparandoReenvio={disparandoReenvio}
          onTestarPush={handleTestarPush}
          onSolicitarReenvio={() => setConfirmReenvioAberto(true)}
        />

        {/* BOTÃO SALVAR (INLINE NO FINAL DO FORMULÁRIO) */}
        <button
          type="submit"
          disabled={salvando}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-[4px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo transition active:translate-y-px disabled:opacity-50"
        >
          <Save className="size-4" />
          {salvando ? 'Salvando Alterações…' : 'Salvar Alterações'}
        </button>
      </form>

      {/* 4. Saúde das Entregas por Atleta (somente-leitura, fora do form) */}
      <SecaoNotificacaoSaude
        dados={painel}
        carregando={carregandoPainel}
        erro={erroPainel}
        onAtualizar={() => carregarPainel()}
      />

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

      {/* Modal de Dia + Horário de Disparo */}
      <ModalSelecionarAgendamento
        open={modalAgendamentoAberto}
        titulo="Agendar Disparo"
        subtitulo="Dia e horário do envio automático do convite de presença"
        opcoesDia={DIAS_DISPARO}
        diaAtual={String(config.confirmacao_dia_semana)}
        horarioAtual={config.confirmacao_horario.slice(0, 5)}
        onConfirmar={(dia, horario) => {
          alterar({ confirmacao_dia_semana: Number(dia), confirmacao_horario: horario });
        }}
        onClose={() => setModalAgendamentoAberto(false)}
      />

      {/* Modal de Horas de Antecedência do Reforço */}
      <ModalSelecionarOpcao
        open={modalReforcoAberto}
        titulo="Antecedência do Reforço"
        subtitulo="Quanto tempo antes do prazo (quarta 16h) enviar o 2º aviso?"
        opcoes={OPCOES_REFORCO}
        valorAtual={String(config.reforco_horas_antes_prazo)}
        onSelecionar={(v) => {
          alterar({ reforco_horas_antes_prazo: Number(v) });
        }}
        onClose={() => setModalReforcoAberto(false)}
      />

      {/* Feedback Toast */}
      <Snackbar {...snackbarProps} />
    </div>
  );
}
