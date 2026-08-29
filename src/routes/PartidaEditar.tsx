import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useJogadorLogado } from '../hooks/useJogadorLogado';
import { invalidarCache } from '../hooks/useCache';
import { CHAVE_JOGOS, chaveResumo } from '../lib/chavesCache';
import { listarJogadoresAtivos, type JogadorLista } from '../lib/jogadores';
import { TIMES, type TimeId } from '../lib/times';
import {
  carregarPartida,
  carregarParticipantes,
  salvarEdicaoCompletaPartida,
  calcularPlacarDeParticipantes,
  type Partida,
  type ParticipanteEdicao,
} from '../lib/partidas';
import { Carregando, MensagemEstado } from '../components/Estado';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CartaoJogadorEdicao } from '../components/CartaoJogadorEdicao';
import { ModalEscalarJogador } from '../components/ModalEscalarJogador';
import { formatarDataCompleta } from '../lib/formatacao';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { BarraAcaoInferior } from '../components/BarraAcaoInferior';
import { PainelPlacar } from '../components/PainelPlacar';
import { CabecalhoTime } from '../components/CabecalhoTime';
import { formatarMensagemErro } from '../lib/erros';
import { dispararPushVotacaoAberta } from '../lib/notificacoes';

export function PartidaEditar() {
  const isAdmin = useAdmin();
  const jogadorLogado = useJogadorLogado();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const partidaId = Number(id);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteEdicao[]>([]);
  const [jogadoresAtivos, setJogadoresAtivos] = useState<JogadorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmandoSalvar, setConfirmandoSalvar] = useState(false);

  // Modal de adição (montagem condicional) e diálogo de remoção
  const [modalTime, setModalTime] = useState<TimeId | null>(null);
  const [jogadorParaRemover, setJogadorParaRemover] = useState<ParticipanteEdicao | null>(null);

  const timerNavegacaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerNavegacaoRef.current) {
        clearTimeout(timerNavegacaoRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!partidaId) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    Promise.all([
      carregarPartida(partidaId),
      carregarParticipantes(partidaId),
      listarJogadoresAtivos(),
    ])
      .then(([p, parts, ativos]) => {
        if (!ativo) return;
        setPartida(p);
        setJogadoresAtivos(ativos);
        setParticipantes(
          parts.map((pt) => ({
            partida_id: pt.partida_id,
            jogador_id: pt.jogador_id,
            time: pt.time,
            posicao: pt.posicao,
            gols: pt.gols,
            assistencias: pt.assistencias,
            gols_contra: pt.gols_contra,
            status_confirmacao: pt.status_confirmacao,
            username: pt.username,
          }))
        );
      })
      .catch((e) => {
        if (ativo) setErro(formatarMensagemErro(e, 'Erro ao carregar partida.'));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [partidaId]);

  const participantesPorTime = useMemo(() => {
    const map: Record<TimeId, ParticipanteEdicao[]> = { a: [], b: [] };
    for (const p of participantes) {
      if (p.time === 'a' || p.time === 'b') {
        map[p.time].push(p);
      }
    }
    for (const t of ['a', 'b'] as TimeId[]) {
      map[t].sort((a, b) => {
        // Goleiros primeiro, depois ordem alfabética
        const aGk = a.posicao === 'goleiro' ? 0 : 1;
        const bGk = b.posicao === 'goleiro' ? 0 : 1;
        if (aGk !== bGk) return aGk - bGk;
        return (a.username ?? '').localeCompare(b.username ?? '');
      });
    }
    return map;
  }, [participantes]);

  // Placar derivado em tempo real (canônico via calcularPlacarDeParticipantes)
  const placarAoVivo = useMemo(() => calcularPlacarDeParticipantes(participantes), [participantes]);

  if (!isAdmin) return <Navigate to="/" replace />;
  if (partida?.status === 'live') {
    return <Navigate to={`/partida/${partidaId}/ao-vivo`} replace />;
  }
  if (carregando) return <Carregando>Carregando partida</Carregando>;
  if (erro && !partida)
    return (
      <MensagemEstado className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">Erro: {erro}</MensagemEstado>
    );
  if (!partida)
    return (
      <MensagemEstado tipo="info" className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Partida não encontrada.
      </MensagemEstado>
    );

  const primeiraVez = partida.status === 'draft';

  function ajustar(
    jogadorId: number,
    campo: 'gols' | 'assistencias' | 'gols_contra',
    delta: number
  ) {
    setParticipantes((prev) =>
      prev.map((p) => {
        if (p.jogador_id !== jogadorId) return p;
        const valorAtual = p[campo] ?? 0;
        return {
          ...p,
          [campo]: Math.max(0, valorAtual + delta),
        };
      })
    );
  }

  function moverTime(jogadorId: number) {
    setParticipantes((prev) =>
      prev.map((p) => {
        if (p.jogador_id !== jogadorId) return p;
        const novoTime: TimeId = p.time === 'a' ? 'b' : 'a';
        return { ...p, time: novoTime };
      })
    );
  }

  function tentarRemover(p: ParticipanteEdicao) {
    if (p.gols > 0 || p.assistencias > 0 || p.gols_contra > 0) {
      setJogadorParaRemover(p);
    } else {
      removerJogador(p.jogador_id);
    }
  }

  function removerJogador(jogadorId: number) {
    setParticipantes((prev) => prev.filter((p) => p.jogador_id !== jogadorId));
    setJogadorParaRemover(null);
  }

  function adicionarJogador(jogador: JogadorLista, time: TimeId) {
    const novo: ParticipanteEdicao = {
      partida_id: partidaId,
      jogador_id: jogador.id,
      time,
      posicao: jogador.posicao,
      gols: 0,
      assistencias: 0,
      gols_contra: 0,
      status_confirmacao: 'confirmado',
      username: jogador.username,
    };
    setParticipantes((prev) => [...prev, novo]);
    setModalTime(null);
  }

  async function salvar() {
    setConfirmandoSalvar(false);
    setSalvando(true);
    setErro(null);
    setFeedback(null);

    try {
      await salvarEdicaoCompletaPartida(partidaId, participantes, primeiraVez);

      invalidarCache(CHAVE_JOGOS);
      invalidarCache(chaveResumo(new Date().getFullYear()));

      // Push de abertura da votação é best-effort: falha fica em cron_execucoes
      // e não suja o feedback da publicação (buckets 6h/3h/1h/30m são a rede).
      if (primeiraVez && jogadorLogado) {
        void dispararPushVotacaoAberta(jogadorLogado.id, partidaId).catch(() => {});
      }

      setFeedback(
        primeiraVez
          ? 'Resultado e escalação publicados com sucesso!'
          : 'Partida, escalação e placar salvos com sucesso.'
      );
      if (timerNavegacaoRef.current) {
        clearTimeout(timerNavegacaoRef.current);
      }
      timerNavegacaoRef.current = setTimeout(() => {
        navigate(`/partida/${partidaId}`);
      }, 700);
    } catch (e) {
      setErro(formatarMensagemErro(e, 'Erro ao salvar alterações.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="px-3 py-4 pb-48 sm:px-4 max-w-2xl mx-auto space-y-5">
      {/* Navegação de retorno */}
      <BotaoVoltar fallback={`/partida/${partidaId}`} label="Voltar para a partida" />

      {/* Placar & Cabeçalho Hero */}
      <div className="rounded-[4px] border border-borda bg-superficie p-4 shadow-carimbo space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-display font-bold uppercase tracking-wider text-giz-fraco">
            {primeiraVez ? 'Lançamento de Resultado' : 'Edição da Partida'} · #{partidaId}
          </span>
          <span className="text-xs font-mono text-giz-fraco capitalize">
            {formatarDataCompleta(partida.data_jogo)}
          </span>
        </div>

        {/* Display do Placar ao Vivo */}
        <PainelPlacar
          golsTimeA={placarAoVivo.gols_time_a}
          golsTimeB={placarAoVivo.gols_time_b}
          jogadoresTimeA={participantesPorTime.a.length}
          jogadoresTimeB={participantesPorTime.b.length}
          variante="edicao"
        />

        <p className="text-center text-[11px] font-mono text-giz-fraco">
          Adicione/remova jogadores e ajuste os gols abaixo. O placar atualiza automaticamente.
        </p>
      </div>

      {partida.status === 'closed' && (
        <MensagemEstado tipo="info">
          Partida encerrada — você está editando a escalação e o resultado de uma partida já
          finalizada.
        </MensagemEstado>
      )}

      {/* Seções dos Times */}
      <div className="space-y-6">
        {(['a', 'b'] as TimeId[]).map((t) => {
          const lista = participantesPorTime[t];
          const goleiros = lista.filter((p) => p.posicao === 'goleiro').length;
          const ehPreto = t === 'a';
          const outroTimeNome = ehPreto ? 'Branco' : 'Preto';

          return (
            <section key={t} className="space-y-2.5">
              {/* Header do Time */}
              <CabecalhoTime
                time={t}
                totalJogadores={lista.length}
                totalGoleiros={goleiros}
                variante="bloco-separado"
                acoes={
                  <button
                    type="button"
                    onClick={() => setModalTime(t)}
                    className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-display font-bold uppercase tracking-wider shadow-carimbo active:translate-y-px transition cursor-pointer ${
                      ehPreto
                        ? 'bg-superficie text-giz border border-borda hover:bg-superficie-2'
                        : 'bg-preto-time hover:bg-superficie-2 hover:text-giz text-branco-time border border-led-borda'
                    }`}
                  >
                    <UserPlus className="size-3.5 text-destaque-texto" />
                    <span>+ Adicionar</span>
                  </button>
                }
              />

              {/* Lista de Cards de Jogadores */}
              <div className="space-y-2">
                {lista.map((p) => (
                  <CartaoJogadorEdicao
                    key={p.jogador_id}
                    participante={p}
                    outroTimeNome={outroTimeNome}
                    onMover={moverTime}
                    onSolicitarRemover={tentarRemover}
                    onAjustar={ajustar}
                  />
                ))}

                {lista.length === 0 && (
                  <div className="rounded-[4px] border border-dashed border-borda p-6 text-center text-xs text-giz-fraco bg-superficie-2">
                    <p className="mb-2 font-mono">Nenhum jogador escalado no {TIMES[t].nome}.</p>
                    <button
                      type="button"
                      onClick={() => setModalTime(t)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-display font-bold uppercase tracking-wider bg-destaque text-destaque-tinta shadow-carimbo cursor-pointer"
                    >
                      <UserPlus className="size-3.5" />
                      <span>Adicionar primeiro jogador</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {erro && <MensagemEstado>{erro}</MensagemEstado>}
      {feedback && <MensagemEstado tipo="sucesso">{feedback}</MensagemEstado>}

      {/* Barra Fixa Inferior de Salvar */}
      <BarraAcaoInferior
        legenda={
          primeiraVez
            ? 'Publica o placar e abre a votação por 24 horas.'
            : 'Atualiza escalação, participantes e placar imediatamente.'
        }
      >
        <button
          onClick={() => setConfirmandoSalvar(true)}
          disabled={salvando}
          className="w-full min-h-[44px] rounded-[4px] bg-destaque hover:brightness-105 px-4 py-3 font-display font-bold uppercase tracking-wider text-destaque-tinta shadow-carimbo disabled:opacity-40 active:translate-y-px transition cursor-pointer text-xs"
        >
          {salvando
            ? 'Salvando alterações…'
            : primeiraVez
              ? 'Publicar resultado e escalação'
              : 'Salvar alterações da partida'}
        </button>
      </BarraAcaoInferior>

      {/* Modal para Adicionar Jogador com Busca e Filtros Rápidos */}
      {modalTime && (
        <ModalEscalarJogador
          timeDestino={modalTime}
          jogadoresAtivos={jogadoresAtivos}
          idsEscalados={new Set(participantes.map((p) => p.jogador_id))}
          onSelecionar={adicionarJogador}
          onClose={() => setModalTime(null)}
        />
      )}

      {/* Diálogo de Confirmação de Remoção */}
      <ConfirmDialog
        open={jogadorParaRemover != null}
        onClose={() => setJogadorParaRemover(null)}
        onConfirm={() => jogadorParaRemover && removerJogador(jogadorParaRemover.jogador_id)}
        titulo={`Remover ${jogadorParaRemover?.username ? `@${jogadorParaRemover.username}` : 'jogador'}?`}
        mensagem="Este jogador possui gols, assistências ou gols contra registrados. Se removê-lo da partida, essas estatísticas serão apagadas."
        textoConfirmar="Remover jogador"
        tomConfirmar="perigo"
      />

      {/* Diálogo de Confirmação de Salvamento */}
      <ConfirmDialog
        open={confirmandoSalvar}
        onClose={() => setConfirmandoSalvar(false)}
        onConfirm={salvar}
        titulo={primeiraVez ? 'Publicar resultado e escalação?' : 'Salvar alterações?'}
        mensagem={
          primeiraVez
            ? 'Isso grava a escalação definitiva, o placar e abre o período de votação.'
            : 'Atualiza os jogadores escalados, seus times e o placar oficial desta partida.'
        }
        textoConfirmar={primeiraVez ? 'Publicar' : 'Salvar'}
      />
    </div>
  );
}
