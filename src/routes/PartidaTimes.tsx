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
import { type TimeId } from "../lib/times";
import { formatarDataCompleta, formatarDataMobile } from "../lib/formatacao";
import { Carregando, MensagemEstado } from "../components/Estado";
import {
  EscalacaoTimesEditor,
  LIMITE_POR_TIME,
} from "../components/EscalacaoTimesEditor";

// Escalar/dividir os times de um draft JÁ EXISTENTE (partida automática semanal
// ou rascunho manual). Diferente do PartidaNovaTimes (que é etapa de criação),
// aqui os participantes vêm do DB e o salvamento é um UPDATE do `time` de cada
// um. Só entram na escalação os `confirmado` (o elenco que vai jogar).
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
      .catch((e: unknown) => {
        const err = e as { message?: string };
        setErro(err?.message ?? String(e));
      })
      .finally(() => setCarregando(false));
  }, [partidaId]);

  // Só os confirmados entram na escalação.
  const confirmadosIds = useMemo(
    () =>
      new Set(
        participantes
          .filter((p) => p.status_confirmacao === "confirmado")
          .map((p) => p.jogador_id),
      ),
    [participantes],
  );

  const confirmadosJogadores = useMemo(
    () =>
      jogadoresAtivos
        .filter((j) => confirmadosIds.has(j.id))
        .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [jogadoresAtivos, confirmadosIds],
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

  const faltamConfirmados =
    confirmadosJogadores.length < LIMITE_POR_TIME * 2
      ? LIMITE_POR_TIME * 2 - confirmadosJogadores.length
      : 0;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setFeedback(null);
    try {
      // Atualiza o time de todos os participantes: confirmado -> time escalado,
      // os demais -> NULL (não jogam). `abrir_partida` valida só confirmados.
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
    } catch (e: unknown) {
      const err = e as { message?: string };
      setErro("Erro ao salvar times: " + (err?.message ?? String(e)));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <EscalacaoTimesEditor
      titulo={`Escalar times · Partida #${partidaId}`}
      linkVoltar={`/partida/${partidaId}`}
      subtitulo={
        <p className="text-sm text-neutral-500 dark:text-neutral-400 capitalize mt-1">
          <span className="sm:hidden">{formatarDataMobile(partida.data_jogo)}</span>
          <span className="hidden sm:inline">
            {formatarDataCompleta(partida.data_jogo)}
          </span>
        </p>
      }
      jogadores={confirmadosJogadores}
      mediasNotas={mediasNotas}
      times={times}
      onTimesChange={setTimes}
      onSalvar={salvar}
      salvando={salvando}
      salvarRotulo="Salvar times"
      salvandoRotulo="Salvando…"
      erro={erro}
      onLimparErro={() => setErro(null)}
      feedbackExterno={feedback}
      rotuloListaJogadores={`Confirmados (${confirmadosJogadores.length})`}
      infoExtra={
        faltamConfirmados > 0 ? (
          <MensagemEstado tipo="info">
            {confirmadosJogadores.length} confirmados — faltam {faltamConfirmados}{" "}
            para completar {LIMITE_POR_TIME * 2}. Adicione avulsos na partida para
            liberar a escalação completa.
          </MensagemEstado>
        ) : null
      }
    />
  );
}
