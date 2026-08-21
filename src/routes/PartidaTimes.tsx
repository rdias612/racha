import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../hooks/useAdmin";
import {
  carregarPartida,
  carregarParticipantes,
  type Partida,
  type Participante,
} from "../lib/partidas";
import {
  listarJogadoresAtivos,
  obterMediasNotasJogadores,
  type JogadorLista,
} from "../lib/jogadores";
import { gerarEscalacaoAutomatica } from "../lib/escalacao";
import { type TimeId } from "../lib/times";
import { formatarDataCompleta, formatarDataMobile } from "../lib/formatacao";
import { Carregando, MensagemEstado } from "../components/Estado";
import {
  EscalacaoTimesEditor,
  LIMITE_POR_TIME,
} from "../components/EscalacaoTimesEditor";

export function PartidaTimes() {
  const isAdmin = useAdmin();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const partidaId = Number(id);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [jogadoresAtivos, setJogadoresAtivos] = useState<JogadorLista[]>([]);
  const [mediasNotas, setMediasNotas] = useState<Record<number, number>>({});
  const [times, setTimes] = useState<Record<number, TimeId>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!partidaId) return;
    setCarregando(true);
    setErro(null);
    Promise.all([
      carregarPartida(partidaId),
      carregarParticipantes(partidaId),
      listarJogadoresAtivos(),
      obterMediasNotasJogadores(),
    ])
      .then(([p, parts, ativos, medias]) => {
        setPartida(p);
        setParticipantes(parts);
        setJogadoresAtivos(ativos);
        setMediasNotas(medias);
        // Pré-carrega o time atual de cada confirmado.
        const init: Record<number, TimeId> = {};
        for (const part of parts) {
          if (part.status_confirmacao === "confirmado" && part.time) {
            init[part.jogador_id] = part.time;
          }
        }
        setTimes(init);
      })
      .catch((e) => setErro(e.message ?? String(e)))
      .finally(() => setCarregando(false));
  }, [partidaId]);

  // Só os confirmados entram na escalação.
  const confirmadosIds = useMemo(
    () =>
      new Set(
        participantes
          .filter((p) => p.status_confirmacao === "confirmado")
          .map((p) => p.jogador_id)
      ),
    [participantes]
  );

  const confirmadosJogadores = useMemo(
    () =>
      jogadoresAtivos
        .filter((j) => confirmadosIds.has(j.id))
        .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [jogadoresAtivos, confirmadosIds]
  );

  if (!isAdmin) return <Navigate to="/" replace />;
  if (carregando) return <Carregando>Carregando partida</Carregando>;
  if (!partida)
    return (
      <MensagemEstado tipo="info" className="mx-3 mt-4 sm:mx-auto sm:max-w-2xl">
        Partida não encontrada.
      </MensagemEstado>
    );
  if (partida.status !== "draft")
    return <Navigate to={`/partida/${partidaId}`} replace />;

  function atribuirTime(id: number, time: TimeId) {
    setFeedback(null);
    const jogador = confirmadosJogadores.find((j) => j.id === id);
    const ehGoleiro = jogador?.posicao === "goleiro";
    const atual = times[id];

    // Já está nesse time -> remove (sem time).
    if (atual && atual === time) {
      setTimes((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      return;
    }

    // Goleiro não pode entrar num time que já tem outro goleiro.
    const destinoTemGoleiro = Object.entries(times).some(
      ([jid, tm]) =>
        tm === time &&
        Number(jid) !== id &&
        confirmadosJogadores.find((x) => x.id === Number(jid))?.posicao === "goleiro"
    );
    if (ehGoleiro && destinoTemGoleiro) {
      setFeedback(
        `Cada time só pode ter 1 goleiro. ${jogador?.nome ?? ""} não pode ir para o ${
          time === "a" ? "Preto" : "Branco"
        }.`
      );
      return;
    }

    // Bloqueia se o time alvo já está cheio.
    const destinoCheio =
      Object.values(times).filter((tm) => tm === time).length >= LIMITE_POR_TIME;
    if (destinoCheio) return;

    setTimes((prev) => ({ ...prev, [id]: time }));
  }

  function autoEscalar() {
    setErro(null);
    setFeedback(null);
    if (confirmadosJogadores.length < LIMITE_POR_TIME * 2) {
      setFeedback(
        `Precisa de ${LIMITE_POR_TIME * 2} confirmados para gerar os times automaticamente.`
      );
      return;
    }
    const proposta = gerarEscalacaoAutomatica(confirmadosJogadores, mediasNotas);
    const novos: Record<number, TimeId> = {};
    for (const p of proposta) novos[p.jogador.id] = p.time;
    setTimes(novos);
    const a = proposta.filter((p) => p.time === "a");
    const b = proposta.filter((p) => p.time === "b");
    const avgA = a.length
      ? (a.reduce((s, p) => s + (p.media_nota ?? 6.0), 0) / a.length).toFixed(1)
      : "0.0";
    const avgB = b.length
      ? (b.reduce((s, p) => s + (p.media_nota ?? 6.0), 0) / b.length).toFixed(1)
      : "0.0";
    setFeedback(`Times equilibrados! (Preto ${avgA}★ vs Branco ${avgB}★)`);
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
          p.status_confirmacao === "confirmado" && times[p.jogador_id]
            ? times[p.jogador_id]
            : null;
        return supabase
          .from("partidas_participantes")
          .update({ time: novoTime })
          .eq("partida_id", partidaId)
          .eq("jogador_id", p.jogador_id);
      });
      const resultados = await Promise.all(updates);
      const falha = resultados.find((r) => r.error);
      if (falha?.error) throw falha.error;
      setFeedback("Times salvos.");
      setTimeout(() => navigate(`/partida/${partidaId}`, { replace: true }), 600);
    } catch (e) {
      setErro("Erro ao salvar times: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <EscalacaoTimesEditor
      titulo={`Escalar times · Partida #${partidaId}`}
      subtitulo={
        partida?.data_jogo ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 capitalize mt-1">
            <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
            <span className="hidden sm:inline">
              {formatarDataCompleta(partida.data_jogo)}
            </span>
          </p>
        ) : null
      }
      infoExtra={
        faltamConfirmados > 0 ? (
          <MensagemEstado tipo="info">
            {confirmadosJogadores.length} confirmados — faltam {faltamConfirmados}{" "}
            para completar {LIMITE_POR_TIME * 2}. Adicione avulsos na partida para
            liberar a escalação completa.
          </MensagemEstado>
        ) : null
      }
      rotuloListaJogadores={`Confirmados (${confirmadosJogadores.length})`}
      salvarRotulo="Salvar times"
      salvandoRotulo="Salvando…"
      onVoltar={() => navigate(`/partida/${partidaId}`)}
      jogadores={confirmadosJogadores}
      times={times}
      mediasNotas={mediasNotas}
      onAtribuirTime={atribuirTime}
      onAutoEscalar={autoEscalar}
      onSalvar={salvar}
      salvando={salvando}
      erro={erro}
      feedback={feedback}
    />
  );
}
