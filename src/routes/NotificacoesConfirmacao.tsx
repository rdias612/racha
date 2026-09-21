import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Bell, Save } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { useSnackbar } from '../hooks/useSnackbar';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { AbasNotificacoes } from '../components/AbasNotificacoes';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ModalSelecionarAgendamento } from '../components/ModalSelecionarAgendamento';
import { ModalSelecionarOpcao } from '../components/ModalSelecionarOpcao';
import { Snackbar } from '../components/Snackbar';
import {
  DIAS_DISPARO,
  OPCOES_REFORCO,
  SecaoNotificacaoConfirmacao,
  TEXTO_PADRAO_CONFIRMACAO_TITULO,
  TEXTO_PADRAO_CONFIRMACAO_MENSAGEM,
  TEXTO_PADRAO_REFORCO_TITULO,
  TEXTO_PADRAO_REFORCO_MENSAGEM,
} from '../components/SecaoNotificacaoConfirmacao';
import {
  obterConfiguracoesNotificacoes,
  salvarConfiguracoesNotificacoes,
  type NotificacoesConfig,
} from '../lib/notificacoes';
import { formatarMensagemErro } from '../lib/erros';
import { vibrateError } from '../lib/haptics';

const TABS_NOTIFICACOES = [
  '/notificacoes/confirmacao',
  '/notificacoes/votacao',
  '/notificacoes/testes',
  '/notificacoes/saude',
];

export function NotificacoesConfirmacao() {
  const isAdmin = useAdmin();
  const jogador = useJogadorLogado();

  const [config, setConfig] = useState<NotificacoesConfig | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [modalReforcoAberto, setModalReforcoAberto] = useState(false);
  const { snackbarProps, mostrarSnackbar } = useSnackbar();

  const { handlers: swipeHandlers } = useSwipeTabs({
    tabs: TABS_NOTIFICACOES,
    activeTab: '/notificacoes/confirmacao',
  });

  const alterar = useCallback((patch: Partial<NotificacoesConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const carregar = useCallback(
    async (isAtivo?: () => boolean) => {
      if (!jogador || !isAdmin) return;
      setCarregando(true);
      setErro(null);

      try {
        const dadosConfig = await obterConfiguracoesNotificacoes(jogador.id);
        if (isAtivo && !isAtivo()) return;
        setConfig({
          ...dadosConfig,
          confirmacao_titulo: dadosConfig.confirmacao_titulo?.trim()
            ? dadosConfig.confirmacao_titulo
            : TEXTO_PADRAO_CONFIRMACAO_TITULO,
          confirmacao_mensagem: dadosConfig.confirmacao_mensagem?.trim()
            ? dadosConfig.confirmacao_mensagem
            : TEXTO_PADRAO_CONFIRMACAO_MENSAGEM,
          reforco_titulo: dadosConfig.reforco_titulo?.trim()
            ? dadosConfig.reforco_titulo
            : TEXTO_PADRAO_REFORCO_TITULO,
          reforco_mensagem: dadosConfig.reforco_mensagem?.trim()
            ? dadosConfig.reforco_mensagem
            : TEXTO_PADRAO_REFORCO_MENSAGEM,
        });
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

  if (!isAdmin) return <Navigate to="/" replace />;

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    if (!config || !jogador) return;

    if (config.confirmacao_dia_semana === 3 && config.confirmacao_horario >= '16:00') {
      setErro('Para disparos na quarta-feira, o horário deve ser anterior às 16:00 (prazo final).');
      vibrateError();
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      await salvarConfiguracoesNotificacoes(jogador.id, config);
      mostrarSnackbar('sucesso', 'Configurações de confirmação salvas!');
    } catch (err) {
      const msg = formatarMensagemErro(err, 'Erro ao salvar configurações.');
      setErro(msg);
      mostrarSnackbar('erro', msg);
    } finally {
      setSalvando(false);
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

      {carregando && !config ? (
        <Carregando>Carregando configurações de confirmação…</Carregando>
      ) : !config ? (
        erro && <MensagemEstado tipo="erro">{erro}</MensagemEstado>
      ) : (
        <>
          {erro && <MensagemEstado tipo="erro">{erro}</MensagemEstado>}

          <form onSubmit={handleSalvar} className="space-y-4">
            <SecaoNotificacaoConfirmacao
              config={config}
              onAlterar={alterar}
              onAbrirModalAgendamento={() => setModalAgendamentoAberto(true)}
              onAbrirModalReforco={() => setModalReforcoAberto(true)}
            />

            <button
              type="submit"
              disabled={salvando}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-[4px] border border-destaque bg-destaque px-4 py-2.5 font-display font-bold uppercase tracking-wider text-xs text-destaque-tinta shadow-carimbo transition active:translate-y-px disabled:opacity-50"
            >
              <Save className="size-4" />
              {salvando ? 'Salvando Alterações…' : 'Salvar Alterações'}
            </button>
          </form>

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
        </>
      )}

      <Snackbar {...snackbarProps} />
    </div>
  );
}
