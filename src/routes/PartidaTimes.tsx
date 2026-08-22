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
  obterMediasNotasJogadores,
  type JogadorLista,
} from '../lib/jogadores';
import { type TimeId } from '../lib/times';
import { formatarDataCompleta, formatarDataMobile } from '../lib/formatacao';
import { Carregando, MensagemEstado } from '../components/Estado';
import { EscalacaoTimesEditor, LIMITE_POR_TIME } from '../components/EscalacaoTimesEditor';
import { voltar } from '../lib/navegacao';

export function PartidaTimes() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const partidaId = Number(id);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [jogadoresAtivos, setJogadoresAtivos] = useState<JogadorLista[]>([]);
  const [mediasNotas, setMediasNotas] = useState<Record<number, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Só os confirmados entram na escalação.
  const confirmadosIds = useMemo(
    () =>
      new Set(
        participantes.filter((p) => p.status_confirmacao === 'confirmado').map((p) => p.jogador_id)
      ),
    [participantes]
  );

  const confirmadosJogadores = useMemo(
    () =>
      jogadoresAtivos
        .filter((j) => confirmadosIds.has(j.id))
        .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '')),
    [jogadoresAtivos, confirmadosIds]
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
      obterMediasNotasJogadores(),
    ])
      .then(([p, parts, ativos, medias]) => {
        if (!ativo) return;
        setPartida(p);
        setParticipantes(parts);
        setJogadoresAtivos(ativos);
        setMediasNotas(medias);
        // Pré-carrega o time atual de cada confirmado.
        const init: Record<number, TimeId> = {};
        for (const part of parts) {
          if (part.status_confirmacao === 'confirmado' && part.time) {
            init[part.jogador_id] = part.time;
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

  const faltamConfirmados =
    confirmadosJogadores.length < LIMITE_POR_TIME * 2
      ? LIMITE_POR_TIME * 2 - confirmadosJogadores.length
      : 0;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setFeedback(null);
    try {
      const updates = participantes.map((p) => {
        const novoTime =
          p.status_confirmacao === 'confirmado' && times[p.jogador_id] ? times[p.jogador_id] : null;
        return supabase
          .from('partidas_participantes')
          .update({ time: novoTime })
          .eq('partida_id', partidaId)
          .eq('jogador_id', p.jogador_id);
      });
      const resultados = await Promise.all(updates);
      const falha = resultados.find((r) => r.error);
      if (falha?.error) throw falha.error;
      setFeedback('Times salvos.');
      setTimeout(() => navigate(`/partida/${partidaId}`, { replace: true }), 600);
    } catch (e) {
      setErro('Erro ao salvar times: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
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
            {confirmadosJogadores.length} confirmados — faltam {faltamConfirmados} para completar{' '}
            {LIMITE_POR_TIME * 2}. Adicione avulsos na partida para liberar a escalação completa.
          </MensagemEstado>
        ) : null
      }
      rotuloListaJogadores={`Confirmados (${confirmadosJogadores.length})`}
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
    />
  );
}
