import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Bell,
  Send,
  RefreshCw,
  Smartphone,
  AlertTriangle,
  ChevronDown,
  Info,
  Save,
  Clock,
  Calendar,
} from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ModalSelecionarAgendamento } from '../components/ModalSelecionarAgendamento';
import { ModalSelecionarOpcao } from '../components/ModalSelecionarOpcao';
import { Snackbar } from '../components/Snackbar';
import { useSnackbar } from '../hooks/useSnackbar';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { Toggle } from '../components/Toggle';
import { vibrateLight, vibrateError } from '../lib/haptics';
import { statusPush, type StatusPush } from '../lib/pwa';
import {
  obterConfiguracoesNotificacoes,
  salvarConfiguracoesNotificacoes,
  dispararPushTeste,
  dispararConfirmacaoManual,
  obterPartidaDraftAtual,
  type NotificacoesConfig,
  type PartidaDraftAtual,
} from '../lib/notificacoes';
import { formatarMensagemErro } from '../lib/erros';
import { formatarDataLista } from '../lib/formatacao';

const DIAS_DISPARO = [
  { value: '1', label: 'Segunda-feira', sublabel: 'Padrão recomendado' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira', sublabel: 'Atenção: antes das 16h' },
];

const OPCOES_REFORCO = [
  { value: '2', label: '2 horas antes', sublabel: 'Quarta às 14h' },
  { value: '4', label: '4 horas antes', sublabel: 'Quarta às 12h — padrão' },
  { value: '6', label: '6 horas antes', sublabel: 'Quarta às 10h' },
  { value: '12', label: '12 horas antes', sublabel: 'Quarta às 04h' },
  { value: '24', label: '24 horas antes', sublabel: 'Terça às 16h' },
];

function nomeDiaSemana(dia: number): string {
  return DIAS_DISPARO.find((d) => d.value === String(dia))?.label ?? `Dia ${dia}`;
}

function nomeReforcoHoras(horas: number): string {
  return OPCOES_REFORCO.find((o) => o.value === String(horas))?.label ?? `${horas}h antes`;
}

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

  // Acordeão de templates de votação
  const [bucketAberto, setBucketAberto] = useState<string | null>(null);

  // Modais e Toasts
  const [confirmReenvioAberto, setConfirmReenvioAberto] = useState(false);
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [modalReforcoAberto, setModalReforcoAberto] = useState(false);
  const { snackbarProps, mostrarSnackbar } = useSnackbar();

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
        {/* SEÇÃO 1: CONFIRMAÇÃO DE PRESENÇA SEMANAL */}
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
              onChange={(checked) =>
                setConfig((prev) => (prev ? { ...prev, confirmacao_ativo: checked } : prev))
              }
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
              onClick={() => setModalAgendamentoAberto(true)}
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
            * Regra de domínio: o racha ocorre quinta 19h e o prazo final de confirmação encerra
            quarta 16h.
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
              <span className="rounded-[2px] border border-destaque/30 bg-destaque/10 px-1.5 py-0.5 text-[10px] font-mono text-destaque-texto">
                {'{dia_jogo}'}
              </span>
              <span className="rounded-[2px] border border-destaque/30 bg-destaque/10 px-1.5 py-0.5 text-[10px] font-mono text-destaque-texto">
                {'{hora_jogo}'}
              </span>
              <span className="rounded-[2px] border border-destaque/30 bg-destaque/10 px-1.5 py-0.5 text-[10px] font-mono text-destaque-texto">
                {'{prazo}'}
              </span>
            </div>

            <label className="block">
              <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco mb-1">
                Título (máx. 120 caracteres)
              </span>
              <input
                type="text"
                maxLength={120}
                value={config.confirmacao_titulo ?? ''}
                onChange={(e) =>
                  setConfig((prev) =>
                    prev ? { ...prev, confirmacao_titulo: e.target.value } : prev
                  )
                }
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
                onChange={(e) =>
                  setConfig((prev) =>
                    prev ? { ...prev, confirmacao_mensagem: e.target.value } : prev
                  )
                }
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
                onChange={(checked) =>
                  setConfig((prev) => (prev ? { ...prev, reforco_ativo: checked } : prev))
                }
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
                    onClick={() => setModalReforcoAberto(true)}
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
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev ? { ...prev, reforco_titulo: e.target.value } : prev
                      )
                    }
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
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev ? { ...prev, reforco_mensagem: e.target.value } : prev
                      )
                    }
                    placeholder="O prazo para confirmação encerra em {prazo}. Garanta sua vaga no racha!"
                    className="w-full rounded-[4px] border border-borda bg-superficie-2 px-3 py-2 text-base sm:text-sm text-giz shadow-xs focus-visible:outline-2 focus-visible:outline-destaque-texto"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO 2: LEMBRETES DE VOTAÇÃO PÓS-JOGO */}
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
              onChange={(checked) =>
                setConfig((prev) => (prev ? { ...prev, votacao_ativo: checked } : prev))
              }
              ariaLabel="Ativar lembretes de votação pós-jogo"
            />
          </div>

          {/* Buckets de Votação */}
          {config.votacao_ativo && (
            <div className="space-y-3 pt-1">
              <span className="block text-xs font-display uppercase tracking-wider text-giz-fraco">
                Horários dos Avisos (antes do fechamento):
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    key: '6h',
                    label: '6 Horas',
                    checked: config.votacao_bucket_6h,
                    field: 'votacao_bucket_6h',
                  },
                  {
                    key: '3h',
                    label: '3 Horas',
                    checked: config.votacao_bucket_3h,
                    field: 'votacao_bucket_3h',
                  },
                  {
                    key: '1h',
                    label: '1 Hora',
                    checked: config.votacao_bucket_1h,
                    field: 'votacao_bucket_1h',
                  },
                  {
                    key: '30m',
                    label: '30 Min',
                    checked: config.votacao_bucket_30m,
                    field: 'votacao_bucket_30m',
                  },
                ].map((bucket) => (
                  <label
                    key={bucket.key}
                    className={`min-h-[44px] flex items-center justify-between p-2.5 rounded-[4px] border cursor-pointer transition ${
                      bucket.checked
                        ? 'border-destaque/50 bg-destaque/10 text-giz'
                        : 'border-borda bg-superficie-2 text-giz-fraco opacity-60'
                    }`}
                  >
                    <span className="font-display font-bold uppercase tracking-wider text-xs">
                      {bucket.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={bucket.checked}
                      onChange={(e) =>
                        setConfig((prev) =>
                          prev ? { ...prev, [bucket.field]: e.target.checked } : prev
                        )
                      }
                      className="size-4 accent-destaque rounded-[2px]"
                    />
                  </label>
                ))}
              </div>

              {/* Acordeão de Textos de Votação */}
              <div className="space-y-2 pt-2 border-t border-borda">
                <span className="block text-xs font-display uppercase tracking-wider text-giz">
                  Personalizar Mensagens por Intervalo:
                </span>

                {[
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
                    placeholderMsg:
                      'Faltam apenas 3 horas para fechar a súmula da partida de ontem.',
                  },
                  {
                    key: '1h',
                    label: 'Bucket 1 Hora',
                    titField: 'votacao_template_1h_titulo',
                    msgField: 'votacao_template_1h_msg',
                    placeholderTit: 'Os analfabetos da bola já votaram, e você?',
                    placeholderMsg:
                      'Acesse a partida de ontem antes que o tempo de votação esgote.',
                  },
                  {
                    key: '30m',
                    label: 'Bucket 30 Minutos',
                    titField: 'votacao_template_30m_titulo',
                    msgField: 'votacao_template_30m_msg',
                    placeholderTit: 'Ainda não votou, vai deixar Tchuca avacalhar as notas!?',
                    placeholderMsg:
                      'Últimos 30 minutos para registrar seu voto na partida de ontem!',
                  },
                ].map((b) => {
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
                              value={
                                (config[b.titField as keyof NotificacoesConfig] as string) ?? ''
                              }
                              onChange={(e) =>
                                setConfig((prev) =>
                                  prev ? { ...prev, [b.titField]: e.target.value } : prev
                                )
                              }
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
                              value={
                                (config[b.msgField as keyof NotificacoesConfig] as string) ?? ''
                              }
                              onChange={(e) =>
                                setConfig((prev) =>
                                  prev ? { ...prev, [b.msgField]: e.target.value } : prev
                                )
                              }
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

        {/* SEÇÃO 3: TESTES E AÇÕES MANUAIS */}
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
                  onClick={handleTestarPush}
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
                onClick={() => setConfirmReenvioAberto(true)}
                className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-[4px] border border-destaque/40 bg-destaque/10 px-3 py-2 font-display font-bold uppercase tracking-wider text-xs text-destaque-texto hover:bg-destaque/20 shadow-xs transition active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`size-3.5 ${disparandoReenvio ? 'animate-spin' : ''}`} />
                {disparandoReenvio ? 'Reenviando…' : 'Reenviar convite agora'}
              </button>
            </div>
          </div>
        </div>

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
          setConfig((prev) =>
            prev
              ? { ...prev, confirmacao_dia_semana: Number(dia), confirmacao_horario: horario }
              : prev
          );
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
          setConfig((prev) => (prev ? { ...prev, reforco_horas_antes_prazo: Number(v) } : prev));
        }}
        onClose={() => setModalReforcoAberto(false)}
      />

      {/* Feedback Toast */}
      <Snackbar {...snackbarProps} />
    </div>
  );
}
