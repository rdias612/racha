import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAdmin } from '../hooks/useAdmin';
import { useEscalacaoTimes } from '../hooks/useEscalacaoTimes';
import {
  carregarPartida,
  carregarParticipantes,
  type Partida,
  type Participante,
} from '../lib/partidas';
import {
  listarJogadoresAtivos,
  listarGoleiros,
  criarGoleiroRapido,
  obterMediasNotasJogadores,
  type JogadorLista,
} from '../lib/jogadores';
import { type TimeId } from '../lib/times';
import { formatarDataCompleta, formatarDataMobile } from '../lib/formatacao';
import { Carregando, MensagemEstado } from '../components/Estado';
import { EscalacaoTimesEditor, LIMITE_POR_TIME } from '../components/EscalacaoTimesEditor';
import { ModalNovoGoleiro } from '../components/ModalNovoGoleiro';
import { voltar } from '../lib/navegacao';

export function PartidaTimes() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const partidaId = Number(id);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [jogadoresAtivos, setJogadoresAtivos] = useState<JogadorLista[]>([]);
  const [goleirosDisponiveis, setGoleirosDisponiveis] = useState<JogadorLista[]>([]);
  const [mediasNotas, setMediasNotas] = useState<Record<number, number>>({});
  const [goleiroA, setGoleiroA] = useState<number | null>(null);
  const [goleiroB, setGoleiroB] = useState<number | null>(null);
  const [modalNovoGoleiroAberto, setModalNovoGoleiroAberto] = useState(false);
  const [timeParaNovoGoleiro, setTimeParaNovoGoleiro] = useState<TimeId>('a');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Só os confirmados que não são goleiros entram na escalação de linha.
  const confirmadosLinhaIds = useMemo(
    () =>
      new Set(
        participantes
          .filter((p) => p.status_confirmacao === 'confirmado' && p.posicao !== 'goleiro')
          .map((p) => p.jogador_id)
      ),
    [participantes]
  );

  const confirmadosJogadores = useMemo(
    () =>
      jogadoresAtivos
        .filter((j) => confirmadosLinhaIds.has(j.id))
        .sort((a, b) => (a.username ?? '').localeCompare(b.username ?? '')),
    [jogadoresAtivos, confirmadosLinhaIds]
  );

  const { times, setTimes, feedback, setFeedback, atribuirTime, autoEscalar } = useEscalacaoTimes({
    jogadores: confirmadosJogadores,
    mediasNotas,
  });

  useEffect(() => {
    if (!partidaId) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    Promise.all([
      carregarPartida(partidaId),
      carregarParticipantes(partidaId),
      listarJogadoresAtivos(),
      listarGoleiros(),
      obterMediasNotasJogadores(),
    ])
      .then(([p, parts, ativos, goleiros, medias]) => {
        if (!ativo) return;
        setPartida(p);
        setParticipantes(parts);
        setJogadoresAtivos(ativos);
        setGoleirosDisponiveis(goleiros);
        setMediasNotas(medias);

        // Pré-carrega o time atual de cada confirmado de linha
        const init: Record<number, TimeId> = {};
        for (const part of parts) {
          if (part.status_confirmacao === 'confirmado' && part.time && part.posicao !== 'goleiro') {
            init[part.jogador_id] = part.time;
          }
          if (part.posicao === 'goleiro') {
            if (part.time === 'a') setGoleiroA(part.jogador_id);
            if (part.time === 'b') setGoleiroB(part.jogador_id);
          }
        }
        setTimes(init);
      })
      .catch((e) => {
        if (ativo) setErro(e.message ?? String(e));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [partidaId, setTimes]);

  if (!isAdmin) return <Navigate to="/" replace />;
  if (carregando) return <Carregando>Carregando partida</Carregando>;
  if (!partida)
    return (
      <MensagemEstado tipo="info" className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Partida não encontrada.
      </MensagemEstado>
    );
  if (partida.status !== 'draft') return <Navigate to={`/partida/${partidaId}`} replace />;

  function handleAutoEscalar() {
    setErro(null);
    autoEscalar();
  }

  function handleAbrirModalNovoGoleiro(time: TimeId) {
    setTimeParaNovoGoleiro(time);
    setModalNovoGoleiroAberto(true);
  }

  async function handleSalvarNovoGoleiro(dados: {
    nome: string;
    telefone: string;
    chave_pix: string;
  }) {
    const novoId = await criarGoleiroRapido(dados);
    const listaAtualizada = await listarGoleiros();
    setGoleirosDisponiveis(listaAtualizada);
    if (timeParaNovoGoleiro === 'a') {
      setGoleiroA(novoId);
    } else {
      setGoleiroB(novoId);
    }
  }

  const faltamConfirmados =
    confirmadosJogadores.length < LIMITE_POR_TIME * 2
      ? LIMITE_POR_TIME * 2 - confirmadosJogadores.length
      : 0;

  async function salvar() {
    if (goleiroA === null || goleiroB === null) {
      setErro('Selecione os goleiros de ambos os times.');
      return;
    }
    if (goleiroA === goleiroB) {
      setErro('Os goleiros dos dois times devem ser diferentes.');
      return;
    }

    setSalvando(true);
    setErro(null);
    setFeedback(null);
    try {
      const payloadLinha = confirmadosJogadores
        .filter((j) => times[j.id])
        .map((j) => ({
          jogador_id: j.id,
          time: times[j.id],
        }));

      const { error: errRpc } = await supabase.rpc('salvar_times_e_goleiros_partida', {
        p_partida_id: partidaId,
        p_times_linha: payloadLinha,
        p_goleiro_a_id: goleiroA,
        p_goleiro_b_id: goleiroB,
      });

      if (errRpc) throw errRpc;

      setFeedback('Times e goleiros salvos com sucesso.');
      setTimeout(() => navigate(`/partida/${partidaId}`, { replace: true }), 600);
    } catch (e) {
      setErro('Erro ao salvar times: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <EscalacaoTimesEditor
        titulo={`Escalar times · Partida #${partidaId}`}
        subtitulo={
          partida?.data_jogo ? (
            <p className="text-sm text-giz-fraco font-mono capitalize mt-1">
              <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
              <span className="hidden sm:inline">{formatarDataCompleta(partida.data_jogo)}</span>
            </p>
          ) : null
        }
        infoExtra={
          faltamConfirmados > 0 ? (
            <MensagemEstado tipo="info">
              {confirmadosJogadores.length} confirmados de linha — faltam {faltamConfirmados} para
              completar {LIMITE_POR_TIME * 2}. Adicione avulsos na partida para liberar a escalação
              completa.
            </MensagemEstado>
          ) : null
        }
        rotuloListaJogadores={`Confirmados de Linha (${confirmadosJogadores.length})`}
        salvarRotulo="Salvar times"
        salvandoRotulo="Salvando…"
        onVoltar={() => voltar(navigate, `/partida/${partidaId}`)}
        jogadores={confirmadosJogadores}
        times={times}
        mediasNotas={mediasNotas}
        onAtribuirTime={atribuirTime}
        onAutoEscalar={handleAutoEscalar}
        onSalvar={salvar}
        salvando={salvando}
        erro={erro}
        feedback={feedback}
        goleirosDisponiveis={goleirosDisponiveis}
        goleiroA={goleiroA}
        goleiroB={goleiroB}
        onSelecionarGoleiroA={setGoleiroA}
        onSelecionarGoleiroB={setGoleiroB}
        onAbrirModalNovoGoleiro={handleAbrirModalNovoGoleiro}
      />

      <ModalNovoGoleiro
        open={modalNovoGoleiroAberto}
        onClose={() => setModalNovoGoleiroAberto(false)}
        onSalvar={handleSalvarNovoGoleiro}
      />
    </>
  );
}
